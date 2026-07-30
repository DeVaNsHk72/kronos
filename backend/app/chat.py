"""Grounded chat over the question bank.

Three steps, and only the first and last involve a model:

  1. parse  — the message becomes structured filters + a semantic query
  2. search — the existing filter/semantic machinery runs unchanged
  3. compose — a reply written strictly from the rows step 2 returned

The model never answers from its own knowledge. A fabricated "past question"
is worse than no answer here, because someone would revise from it, so every
sentence in the reply has to trace back to a retrieved row and retrieval
returning nothing means the reply says nothing.
"""

import datetime
import json
import re

from . import llm

# How many retrieved questions get shown to the composer. Enough to spot a
# pattern across years, small enough to stay cheap and inside the reply budget.
CONTEXT_ROWS = 12

_vocab = None


def vocab(con):
    """Canonical filter values, read once. Injected into the parse prompt so
    the model picks from what the corpus actually contains rather than
    inventing plausible-looking branch names."""
    global _vocab
    if _vocab is None:
        def col(c):
            return [r[0] for r in con.execute(
                f"SELECT DISTINCT {c} FROM questions WHERE {c} IS NOT NULL ORDER BY 1")]
        lo, hi = con.execute("SELECT MIN(year), MAX(year) FROM questions").fetchone()
        _vocab = {"branch": col("branch"), "exam_type": col("exam_type"),
                  "program": col("program"), "year_min": lo, "year_max": hi}
    return _vocab


INTENT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "kind": {"type": "string", "enum": ["find", "pattern", "other"]},
        "query": {"type": "string"},
        "course_hint": {"type": ["string", "null"]},
        "topic_hint": {"type": ["string", "null"]},
        "branch": {"type": ["string", "null"]},
        "exam_type": {"type": ["string", "null"]},
        "program": {"type": ["string", "null"]},
        "semester": {"type": ["integer", "null"]},
        "unit": {"type": ["integer", "null"]},
        "year_min": {"type": ["integer", "null"]},
        "year_max": {"type": ["integer", "null"]},
        "has_images": {"type": ["boolean", "null"]},
    },
    "required": ["kind", "query"],
}

PARSE_SYSTEM = """You convert a student's message into a search over a bank of \
past university exam questions. Return JSON only.

THE MAIN RULE: a field is null unless the user actually said it. Every filter \
you set removes questions. Setting one the user did not ask for hides the \
results they wanted and they cannot tell that happened. When in doubt, null.

kind:
  "find"    - they want to see past questions
  "pattern" - they ask what repeats, what is important, what tends to be asked
  "other"   - greeting or anything not answerable from exam questions

query: the subject matter only, as a short noun phrase. Strip years, branches, \
course names, and question words - those become filters, not search text. \
Empty string when kind is "other".

course_hint: the course as the user named it (a code like 22MA1BSMS1, or a name \
like "operating systems"). Never invent a course code.
topic_hint: only if they named a specific chapter or topic.

branch / exam_type / program: choose from the given lists, and only when the \
user names one. Do not infer a branch from the subject matter - many branches \
share subjects.

year_min/year_max: absolute ("in 2023" -> both 2023; "since 2020" -> min only) \
or relative ("last three years") using the current year below.

Examples:
"show me laplace transform questions from 2023"
{"kind":"find","query":"laplace transform","year_min":2023,"year_max":2023}

"deadlock questions for CSE sem 5"
{"kind":"find","query":"deadlock","branch":"Computer Science & Engineering","semester":5}

"what keeps repeating in operating systems deadlock questions?"
{"kind":"pattern","query":"deadlock","course_hint":"operating systems"}

"10 mark questions on beam deflection from the last 3 years with diagrams"
{"kind":"find","query":"beam deflection","year_min":<currentyear-2>,"has_images":true}

Note how every unmentioned field is simply absent."""


def parse_intent(message: str, con, history=None) -> dict:
    """Message -> filter dict. Falls back to a plain semantic query if the
    model is unavailable or returns something unusable."""
    v = vocab(con)
    ctx = [
        f"Current year: {datetime.date.today().year}",
        f"Questions available for years {v['year_min']}-{v['year_max']}.",
        f"branch options: {json.dumps(v['branch'])}",
        f"exam_type options: {json.dumps(v['exam_type'])}",
        f"program options: {json.dumps(v['program'])}",
    ]
    if history:
        prior = "\n".join(f"{m['role']}: {m['content']}" for m in history[-4:])
        ctx.append(f"Earlier in this conversation:\n{prior}")
    ctx.append(f"\nMessage: {message}")

    try:
        raw = llm.complete(PARSE_SYSTEM, "\n".join(ctx),
                           schema=INTENT_SCHEMA, max_tokens=300)
        data = json.loads(raw)
    except Exception:
        return {"kind": "find", "query": message}

    # keep only values the corpus actually has; a hallucinated branch would
    # filter every row away and look like "no results" instead of an error
    for key in ("branch", "exam_type", "program"):
        if data.get(key) and data[key] not in v[key]:
            data[key] = None
    if not (data.get("query") or "").strip():
        data["query"] = message
    # weaker chat models often miss the course code in `course_hint`; the
    # pattern is unambiguous so pull it straight from the message as a fallback
    if not data.get("course_hint"):
        m = CODE_RE.search(message.upper())
        if m:
            data["course_hint"] = m.group(0)
    return data


CODE_RE = re.compile(r"\b\d{2}[A-Z]{2}[A-Z0-9]{6}\b")


def resolve_course(hint: str, con):
    """Turn a course phrase into a real course_code.

    The model is never asked to produce a code — with 3,296 of them it would
    invent ones that look right. It passes through what the user said and the
    database decides, so an unrecognised course yields no filter rather than a
    wrong one.
    """
    if not hint:
        return None, None
    hint = hint.strip()
    m = CODE_RE.search(hint.upper())
    if m:
        row = con.execute(
            "SELECT course_code, course_name FROM questions WHERE course_code=? LIMIT 1",
            (m.group(0),)).fetchone()
        if row:
            return row["course_code"], row["course_name"]
    row = con.execute(
        "SELECT course_code, course_name, COUNT(*) n FROM questions "
        "WHERE course_name LIKE ? GROUP BY course_code ORDER BY n DESC LIMIT 1",
        (f"%{hint}%",)).fetchone()
    if row:
        return row["course_code"], row["course_name"]
    return None, None


COMPOSE_SYSTEM = """You answer using ONLY the numbered past exam questions given \
to you. They are the complete evidence; you have no other knowledge of this \
course.

Citations are mandatory. Every sentence that states something about the \
questions must carry at least one bracketed marker naming the question it came \
from, like [3] or [2][7]. A sentence with no marker is not allowed, because the \
student cannot check it. Cite only numbers that appear in the list.

Also:
- Never invent a question, year, mark value, or topic that is not listed.
- Do not answer the exam questions themselves. Describe what has been asked.
- If the questions do not support an answer, say so plainly.
- Be brief: 2-4 sentences, or a short list. Mention repetition across years and \
typical mark values when the evidence shows them.
- Write plainly for a student revising. No preamble.

Shape of a good reply:
"Deadlock prevention is asked almost every year, usually for 8-10 marks \
[1][4][9]. The four necessary conditions come up as a short-answer question \
[3][7]." """


def format_rows(rows):
    """Number the retrieved rows for the composer and for citation mapping."""
    out = []
    for i, r in enumerate(rows, 1):
        text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", r["question_md"] or "")
        text = re.sub(r"\s+", " ", text).strip()[:300]
        meta = [r["course_code"], str(r["year"] or "?"), r["exam_type"] or ""]
        if r["unit"] is not None:
            meta.append(f"Unit {r['unit']}")
        if r["marks"] is not None:
            meta.append(f"{r['marks']} marks")
        if r["topic"]:
            meta.append(r["topic"])
        out.append(f"[{i}] ({', '.join(m for m in meta if m)}) {text}")
    return "\n".join(out)


def no_match_reply(intent) -> str:
    """What to say when there is nothing to ground an answer in.

    Silence reads as a broken app, so name the reason: an unrecognised course is
    a different problem from a subject the archive does not cover, and only the
    first one is worth rephrasing.
    """
    unresolved = intent.get("unresolved_course")
    if unresolved:
        return (f"I could not find a course matching “{unresolved}” in "
                "the archive. Try its course code, or the full name as it "
                "appears on the paper.")
    if intent.get("kind") == "other":
        return ("I can only answer from the past exam questions in this "
                "archive — ask me about a subject, course, or topic and I "
                "will show you what has been asked before.")
    return ("I could not find any past questions matching that. Try a broader "
            "wording, or drop one of the filters.")


def compose(message: str, rows, intent) -> str:
    if not rows:
        return no_match_reply(intent)
    user = (f"Student asked: {message}\n\n"
            f"Past questions found ({len(rows)} shown):\n{format_rows(rows)}")
    return llm.complete(COMPOSE_SYSTEM, user, max_tokens=400,
                        temperature=0.2).strip()
