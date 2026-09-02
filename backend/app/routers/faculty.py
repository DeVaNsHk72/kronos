"""Faculty console API.

The browser names a query; it never sends SQL. Anything else would let a crafted
request run arbitrary statements against the warehouse with this server's own
credentials.
"""
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import databricks as dbx
from .. import genie_client as genie
from .. import mas_client as mas
from .. import faculty_sql as Q

router = APIRouter(prefix="/api/faculty", tags=["faculty"])


class QueryReq(BaseModel):
    name: str
    params: dict = {}


@router.get("/status")
def status():
    return {"databricks": dbx.available(), "genie": genie.available(),
            "agent": mas.available(), "catalog": dbx.CATALOG,
            "queries": sorted(Q.REGISTRY)}


class AskReq(BaseModel):
    question: str
    conversation_id: str | None = None


@router.post("/ask")
def ask(r: AskReq):
    """Ask the agent.

    Prefers the Multi-Agent Supervisor, which reasons about the question and
    calls Genie as a tool — so the reply carries the tool calls as well as the
    answer. Falls back to Genie directly if the supervisor is unreachable; the
    response says which answered.
    """
    if mas.available():
        try:
            out = mas.ask(r.question)
            out["engine"] = "supervisor"
            return out
        except Exception as e:
            supervisor_error = str(e)
    else:
        supervisor_error = "agent endpoint not configured"
    try:
        out = genie.ask(r.question, r.conversation_id)
        out["engine"] = "genie"
        out["fallback_reason"] = supervisor_error
        return out
    except Exception as e:
        raise HTTPException(503, f"supervisor: {supervisor_error} | genie: {e}")


# The questions each screen asks Genie. Phrased to name the columns wanted, so
# the answer is chartable — Genie picks its own aliases otherwise and a chart
# bound to fixed keys silently renders nothing.
ASKS = {
    "candidates": (
        "From fact_question where subject_key = '{s}' and sitting = 'Main' and "
        "marks is not null and unit_no is not null, list every question that is "
        "NOT in a repeat cluster asked in {y} or later. A question qualifies if "
        "repeat_cluster_id is null, or its repeat_cluster_id does not appear on "
        "any row of the same subject with exam_year >= {y}. Return columns "
        "question_id, question_text, marks, unit_no, course_outcome, "
        "program_outcome, bloom_level, exam_year, exam_session, source_file, "
        "repeat_cluster_id, topic_id. Return every qualifying row, no limit."),
    "markSlots": (
        "For subject_key '{s}' where sitting = 'Main' and marks is not null and "
        "unit_no is not null: per unit_no and marks return columns unit_no, "
        "marks, n (count). Order by unit_no, marks."),
    "overview": (
        "For subject_key '{s}': how many questions in total, how many distinct "
        "exam years, how many distinct source files, how many have a non-null "
        "marks value, and how many have a non-null course_outcome? "
        "Return one row with columns total_questions, years_covered, papers, "
        "with_marks, with_co, first_year, last_year."),
    "marksByUnit": (
        "For subject_key '{s}', total marks per unit_no, counting only rows "
        "where sitting = 'Main' and marks is not null. "
        "Return columns unit_no, marks, questions. Order by unit_no."),
    "unitDrift": (
        "For subject_key '{s}', total marks per exam_year and unit_no, only "
        "where sitting = 'Main' and marks is not null. "
        "Return columns exam_year, unit_no, marks. Order by exam_year, unit_no."),
    "coverageGap": (
        "For subject_key '{s}', join fact_question to dim_topic on topic_id and "
        "left join fact_note_coverage on topic_id. Per topic return columns "
        "topic_name, unit_no, marks_examined (sum of marks), years_appeared "
        "(count of distinct exam_year), questions (count), and notes_pages "
        "(sum of depth_score, 0 if none). Only rows where marks is not null. "
        "Order by marks_examined descending."),
    "repetition": (
        "For subject_key '{s}', group rows with a non-null repeat_cluster_id and "
        "return columns repeat_cluster_id, times_asked (count), first_asked (min "
        "exam_year), last_asked (max exam_year), example (any question_text), "
        "unit_no (any). Only groups asked 3 or more times. "
        "Order by times_asked descending. Limit 40."),
    "freshness": (
        "For subject_key '{s}' where sitting = 'Main' and unit_no is not null: "
        "per unit_no return columns unit_no, last_asked (max exam_year), "
        "questions (count), marks (sum), years (count of distinct exam_year). "
        "Order by unit_no."),
    # Mirrors Q.PRACTICE_POOL exactly. The two have to agree: whichever engine
    # answers, a set built from it must be the same kind of set.
    #
    # unit_no is spelled out because both tables have one and they are not the
    # same thing: fact_question.unit_no is the unit the question was set under,
    # dim_topic.unit_no is the unit the topic sits in under the current scheme.
    # They differ on 362 of 685 dbms rows. Left to itself Genie took dim_topic's,
    # which silently redefines what "Unit 2" means on the practice screen.
    "practicePool": (
        "From fact_question left joined to dim_topic on topic_id, for "
        "subject_key '{s}' where marks is not null and marks >= 4 and the "
        "character length of question_text is between 40 and 400: return "
        "columns question_id, question_text, marks, unit_no, bloom_level, "
        "exam_year, source_file, topic_id — all of these taken from "
        "fact_question, and in particular fact_question.unit_no and NOT "
        "dim_topic.unit_no — plus topic_name taken from dim_topic. "
        "Order by exam_year descending. Limit 400."),
}


class GenieQueryReq(BaseModel):
    name: str
    subject_key: str
    cutoff_year: int | None = None


def agent_rows(name: str, subject_key: str, cutoff_year: int | None = None,
               require: tuple[str, ...] = (), bulk: bool = False) -> dict:
    """Answer a named question through the agent, falling back to our own SQL.

    Supervisor -> Genie -> the equivalent hand-written statement. A screen
    degrades to working-but-not-agentic rather than to blank, and the result
    says which path produced it.

    `require` names columns the caller indexes directly. An agent answer that
    is missing one is rejected rather than returned: text-to-SQL picks its own
    aliases, and a caller reading `row["question_id"]` would 500 on an answer
    that is otherwise perfectly good prose.

    `bulk` asks Genie first. The supervisor answers in prose with the rows as a
    markdown table, and on a question that returns hundreds of rows it writes
    two tables — Genie's raw output and its own short summary of it — which the
    parser in mas_client cannot tell apart, so it returns whichever came first.
    Measured on applied_physics: the supervisor spends ~40s and yields 3 rows
    under summary headings, then Genie is asked anyway and returns all 287.
    For row retrieval there is nothing the supervisor adds, so it goes second.
    Analytical questions, which it answers well, are unaffected.
    """
    tmpl = ASKS.get(name)
    if not tmpl:
        raise HTTPException(400, f'no agent question for "{name}"')
    question = tmpl.format(s=subject_key, y=cutoff_year or 0)

    def usable(res: dict) -> bool:
        rows = res.get("rows") or []
        return bool(rows) and all(k in rows[0] for k in require)

    def missing(res: dict, who: str) -> str:
        if not res.get("rows"):
            return f"{who} returned no rows"
        return f"{who} returned rows missing {sorted(set(require) - set(res['rows'][0]))}"

    # The supervisor is the agent; Genie is the tool it calls. Preferred over
    # talking to Genie directly so every screen goes through one entry point —
    # except for bulk row retrieval, see above.
    def via_supervisor():
        res = mas.ask(question)
        if usable(res):
            res["engine"] = "supervisor"
            res["sql"] = res.get("sql") or "\n".join(
                f"-- {t.get('name')}: {t.get('arguments')}" for t in res.get("tools", []))
            return res, None
        return None, missing(res, "supervisor")

    def via_genie():
        res = genie.ask(question)
        if usable(res):
            res["engine"] = "genie"
            return res, None
        return None, res.get("error") or missing(res, "Genie")

    chain = [(genie.available, via_genie), (mas.available, via_supervisor)] if bulk \
        else [(mas.available, via_supervisor), (genie.available, via_genie)]

    reason = "agent unavailable"
    for is_available, attempt in chain:
        if not is_available():
            continue
        try:
            res, why = attempt()
        except Exception as e:
            reason = str(e)
            continue
        if res is not None:
            res["fallback_reason"] = reason if reason != "agent unavailable" else None
            return res
        reason = why

    sql = Q.REGISTRY.get(name)
    if not sql:
        raise HTTPException(503, reason)
    out = dbx.query(sql, {"subject_key": subject_key})
    out["engine"] = "sql-fallback"
    out["fallback_reason"] = reason
    return out


@router.post("/genie-query")
def genie_query(r: GenieQueryReq):
    """A named analytical question, answered by Genie rather than by our SQL."""
    return agent_rows(r.name, r.subject_key, r.cutoff_year)


@router.post("/query")
def run_query(req: QueryReq):
    sql = Q.REGISTRY.get(req.name)
    if not sql:
        raise HTTPException(400, f'unknown query "{req.name}"')
    params = {k: v for k, v in req.params.items() if k in Q.ALLOWED_PARAMS}
    try:
        return dbx.query(sql, params)
    except Exception as e:
        raise HTTPException(500, str(e))


class BankReq(BaseModel):
    subject_key: str
    q: str | None = None
    unit: int | None = None
    marks: int | None = None
    co: int | None = None
    bloom: str | None = None
    year: int | None = None
    sitting: str | None = "Main"
    limit: int = 50
    offset: int = 0


@router.post("/bank")
def bank(b: BankReq):
    """Filters are composed from a fixed set of clauses and always bound as
    parameters, so no user input reaches the statement text."""
    where = ["subject_key = :subject_key"]
    params: dict = {"subject_key": b.subject_key}
    for col, key, val in [("unit_no", "unit_no", b.unit), ("marks", "marks", b.marks),
                          ("course_outcome", "co_v", b.co), ("exam_year", "year_v", b.year),
                          ("bloom_level", "bloom_v", b.bloom), ("sitting", "sitting_v", b.sitting)]:
        if val not in (None, "", "all"):
            where.append(f"{col} = :{key}")
            params[key] = val
    if b.q:
        where.append("LOWER(question_text) LIKE :qtext")
        params["qtext"] = f"%{b.q.lower()}%"

    clause = "\n  AND ".join(where)
    limit = max(1, min(b.limit, 500))
    offset = max(0, b.offset)
    C = dbx.CATALOG
    sql = f"""
SELECT question_id, question_text, marks, unit_no, course_outcome, program_outcome,
       bloom_level, exam_year, exam_session, sitting, repeat_cluster_id,
       source_file, source_page, topic_id
FROM {C}.fact_question
WHERE {clause}
ORDER BY exam_year DESC, unit_no, question_id
LIMIT {limit} OFFSET {offset}"""
    try:
        res = dbx.query(sql, params)
        cnt = dbx.query(f"SELECT COUNT(*) AS n FROM {C}.fact_question WHERE {clause}", params)
        res["total"] = cnt["rows"][0]["n"] if cnt["rows"] else 0
        res["limit"], res["offset"] = limit, offset
        return res
    except Exception as e:
        raise HTTPException(500, str(e))


class SimilarReq(BaseModel):
    subject_key: str
    probe: str


@router.post("/similar")
def similar(r: SimilarReq):
    if len(r.probe.strip()) < 8:
        raise HTTPException(400, "Type a bit more of the question first.")
    try:
        return dbx.query(Q.SIMILAR, {"subject_key": r.subject_key, "probe": r.probe})
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------- generator --
class Section(BaseModel):
    label: str
    note: str = ""
    slots: int          # questions printed
    answer: int         # questions the student answers
    marks: int          # marks per question
    units: list[int] | None = None   # restrict this section to these units


class GenerateReq(BaseModel):
    subject_key: str
    exam_type: str = "CIE"
    exclude_years: int = 3
    bloom_mix: dict = {}
    # A blueprint supplied by the department beats anything inferred. When this
    # is set it is authoritative and nothing is scaled; without it only the
    # declared CIE format is available, because averaging real papers gives unit
    # totals of 155 or 201 that then have to be fudged onto the target.
    blueprint: list[Section] | None = None
    instructions: list[str] = []


# The CIE shape is printed on the papers themselves ("PART -A / Total 5 Marks
# (No Choice)", "Internal choice is provided in Part C", "Maximum Marks: 40"), so
# it is declared rather than inferred. A declared blueprint beats an observed
# average: averaging real papers gives unit totals of 155 or 201, which then have
# to be scaled — a fudge a known format does not need.
def _see_format(units: list[int]) -> dict:
    """SEE: every unit carries 20 marks, made of 10-mark questions.

    Internal choice is per unit — the printed paper offers two complete
    questions and the student answers one. Modelled here as four 10-mark slots
    per unit of which two are answered, which fills the same shape from the same
    pool; the difference only matters if a student could mix halves of the two
    alternatives, which the printed instruction forbids.
    """
    roman = ["", "I", "II", "III", "IV", "V", "VI", "VII"]
    return {
        "name": "Semester End Examination",
        "instructions": [
            "All units have internal choice, answer one complete question from each unit."
        ],
        "sections": [
            {"label": f"UNIT - {roman[u] if u < len(roman) else u}",
             "note": "20 marks · internal choice · 10 marks per question",
             "slots": 4, "answer": 2, "marks": 10, "units": [u]}
            for u in units
        ],
    }


FORMATS = {
    "CIE": {
        "name": "Internal Assessment",
        "instructions": ["Internal choice is provided in Part C."],
        "sections": [
            {"label": "PART - A", "note": "Total 5 Marks (No Choice)", "slots": 1, "answer": 1, "marks": 5},
            {"label": "PART - B", "note": "Total 15 Marks (No Choice)", "slots": 3, "answer": 3, "marks": 5},
            {"label": "PART - C", "note": "Total 20 Marks (Answer any 2 of 3)", "slots": 3, "answer": 2, "marks": 10},
        ],
    }
}


@router.post("/generate")
def generate(r: GenerateReq):
    """Paper generation is constraint satisfaction over real past questions.

    No language model runs here. Every question on the output is a row from
    fact_question carrying its question_id, source PDF and year, so a paper can
    be defended line by line. Where a constraint cannot be met it is RELAXED AND
    REPORTED — a paper that quietly misses a CO is worse than one that says so.
    """
    # Units are needed before an SEE format can be built, so read them first.
    _slots = dbx.query(Q.MARK_SLOTS, {"subject_key": r.subject_key})["rows"]
    _units = sorted({int(x["unit_no"]) for x in _slots
                     if x.get("unit_no") is not None})

    if r.blueprint:
        fmt = {"name": f"{r.exam_type} (blueprint supplied)",
               "instructions": r.instructions or [],
               "sections": [s.model_dump() for s in r.blueprint]}
    elif r.exam_type == "SEE":
        # Only the five real syllabus units; 6 and 7 are parser artifacts.
        fmt = _see_format([u for u in _units if u <= 5] or _units)
    else:
        fmt = FORMATS.get(r.exam_type)
    if not fmt:
        raise HTTPException(422, f"No declared format for {r.exam_type}, and no "
                                 "blueprint supplied. Send a blueprint, or use CIE.")
    warnings: list[str] = []
    cutoff = date.today().year - r.exclude_years
    used_ids: set[str] = set()
    used_clusters: set[str] = set()

    def _rows(name: str, **fmt):
        """Ask Genie; fall back to the equivalent statement if it cannot answer.

        Returns (rows, engine) so the caller can report which produced the paper.
        """
        tmpl = ASKS.get(name)
        if tmpl and mas.available():
            try:
                out = mas.ask(tmpl.format(s=r.subject_key, y=cutoff))
                if out.get("rows"):
                    return out["rows"], "supervisor"
            except Exception:
                pass
        if tmpl and genie.available():
            try:
                out = genie.ask(tmpl.format(s=r.subject_key, y=cutoff))
                if out.get("rows"):
                    return out["rows"], "genie"
            except Exception:
                pass
        sql = Q.REGISTRY.get(name)
        if not sql:
            return [], "none"
        params = {"subject_key": r.subject_key}
        if ":cutoff_year" in sql:
            params["cutoff_year"] = cutoff
        return dbx.query(sql, params)["rows"], "sql-fallback"

    # One call for the whole eligible pool, then select locally. Asking Genie
    # per slot would be ~15 round trips at ~20s each and the wording would vary
    # between them, so two runs of the same constraints could differ.
    pool_rows, pool_engine = _rows("candidates")
    units = _units
    if not units:
        raise HTTPException(422, "No questions with a unit for this subject.")

    bloom_order = [k for k, v in sorted(r.bloom_mix.items(), key=lambda kv: -kv[1]) if v > 0]

    def pick(unit, marks, bloom):
        rows = [c for c in pool_rows
                if int(c.get("unit_no") or -1) == unit
                and int(c.get("marks") or -1) == marks]
        pool = [c for c in rows if c["question_id"] not in used_ids
                and not (c.get("repeat_cluster_id") and c["repeat_cluster_id"] in used_clusters)]
        if not pool:
            return None
        def score(c):
            # Requested Bloom level first, then oldest — an older question reads
            # as fresher to a student who has seen recent papers.
            return ((0 if bloom and c.get("bloom_level") == bloom else 10)
                    + (int(c.get("exam_year") or 2000) - 2000) * 0.01)
        return sorted(pool, key=score)[0]

    n = 0
    sections = []
    for sec in fmt["sections"]:
        picks = []
        for i in range(sec["slots"]):
            n += 1
            bloom = bloom_order[i % len(bloom_order)] if bloom_order else ""
            sec_units = [u for u in (sec.get("units") or units) if u in units] or units
            unit = sec_units[(n - 1) % len(sec_units)]

            q = pick(unit, sec["marks"], bloom)
            if not q:
                # The format fixes the marks, so relaxing the unit is the honest
                # trade — and it is reported.
                for u in sec_units:
                    if u == unit:
                        continue
                    q = pick(u, sec["marks"], bloom)
                    if q:
                        warnings.append(
                            f"{sec['label']} Q{n}: no unused {sec['marks']}-mark question left "
                            f"in unit {unit}; took one from unit {u} instead.")
                        break
            if not q:
                warnings.append(
                    f"{sec['label']} Q{n}: no unused {sec['marks']}-mark question remains in any "
                    f"unit after excluding everything asked since {cutoff}. Slot empty.")
                picks.append({"n": n, "marks": sec["marks"], "q": None})
                continue
            used_ids.add(q["question_id"])
            if q.get("repeat_cluster_id"):
                used_clusters.add(q["repeat_cluster_id"])
            picks.append({"n": n, "marks": sec["marks"], "q": q})
        sections.append({**sec, "picks": picks})

    answerable = sum(s["answer"] * s["marks"] for s in fmt["sections"])
    printed = sum(s["slots"] * s["marks"] for s in fmt["sections"])
    empty = sum(1 for s in sections for p in s["picks"] if not p["q"])

    achieved: dict = {}
    for s in sections:
        for p in s["picks"]:
            b = (p["q"] or {}).get("bloom_level")
            if b:
                achieved[b] = achieved.get(b, 0) + p["marks"]

    return {"subject_key": r.subject_key, "exam_type": r.exam_type, "basis": "declared",
            "format": fmt["name"], "instructions": fmt["instructions"], "sections": sections,
            "total_marks": answerable, "target_marks": answerable, "printed_marks": printed,
            "bloom_requested": r.bloom_mix, "bloom_achieved": achieved,
            "empty_slots": empty, "cutoff_year": cutoff, "warnings": warnings,
            "engine": pool_engine, "pool_size": len(pool_rows),
            "sql_used": Q.CANDIDATES}


# ---------------------------------------------------------------- practice --
class PracticeReq(BaseModel):
    subject_key: str
    scope: str = "subject"        # subject | unit | topic
    unit_no: int | None = None
    topic_id: str | None = None
    count: int = 10
    refresh: bool = False         # re-ask the agent instead of using the cache


# The pool is the same for every set built from a subject, and the agent takes
# ~30s to answer. Without this, "New set" — an instant re-roll today — would
# cost a Genie round trip each time. Cached per subject; a set is still a fresh
# random sample of it.
_POOL_TTL = 900.0
_pool_cache: dict[str, tuple[float, dict]] = {}


def _practice_pool(subject_key: str, refresh: bool = False) -> dict:
    import time
    hit = _pool_cache.get(subject_key)
    if hit and not refresh and time.time() - hit[0] < _POOL_TTL:
        out = dict(hit[1])
        out["cached"] = True
        return out
    # question_id and question_text are indexed directly below; topic_name is
    # the answer key. An agent answer without them is not usable as a pool.
    res = agent_rows("practicePool", subject_key, bulk=True,
                     require=("question_id", "question_text", "topic_name"))
    _pool_cache[subject_key] = (time.time(), res)
    out = dict(res)
    out["cached"] = False
    return out


@router.post("/practice")
def practice(r: PracticeReq):
    """Build an MCQ practice set from real past questions.

    The pool is selected by the agent — the supervisor calling Genie, falling
    back to our own statement — so the set carries the SQL behind it like every
    other screen. Assembly stays deterministic Python on purpose: the stem is a
    question that was actually asked, and the distractors are OTHER real topics
    from the same subject. No model rephrases a stem or invents an option.
    """
    import random

    pool = _practice_pool(r.subject_key, refresh=r.refresh)
    # topic_name is the answer key, so a question with no topic cannot become a
    # usable item — it would make a literal em dash the correct option. The
    # LEFT JOIN keeps unmapped questions in the pool; they are dropped here.
    rows = [x for x in pool.get("rows", [])
            if x.get("question_id") and x.get("question_text") and x.get("topic_name")]
    if r.scope == "unit" and r.unit_no is not None:
        rows = [x for x in rows if x.get("unit_no") == r.unit_no]
    elif r.scope == "topic" and r.topic_id:
        rows = [x for x in rows if x.get("topic_id") == r.topic_id]
    if len(rows) < 4:
        raise HTTPException(422, "Not enough questions in this scope to build a set. "
                                 "Widen to the whole unit or subject.")

    by_topic: dict[str, list[dict]] = {}
    for x in rows:
        by_topic.setdefault(x.get("topic_name") or "—", []).append(x)

    n = max(1, min(r.count, 25))
    picked = random.sample(rows, min(n, len(rows)))
    items = []
    for q in picked:
        right = q["topic_name"]
        # Distractors are other real topics from the same subject: a plausible
        # wrong answer here is one a student could genuinely confuse it with.
        others = [t for t in by_topic if t != right and t != "—"]
        random.shuffle(others)
        options = [right] + others[:3]
        if len(options) < 2:
            continue
        random.shuffle(options)
        items.append({
            "question_id": q["question_id"],
            "stem": q["question_text"],
            "prompt": "Which topic is this question testing?",
            "options": options,
            "answer": right,
            "marks": q.get("marks"),
            "unit_no": q.get("unit_no"),
            "bloom_level": q.get("bloom_level"),
            "exam_year": q.get("exam_year"),
            "source_file": q.get("source_file"),
        })
    return {"subject_key": r.subject_key, "scope": r.scope,
            "count": len(items), "pool_size": len(rows), "items": items,
            # same provenance fields every other screen returns, so the set can
            # show the statement that chose the questions in it
            "engine": pool.get("engine"), "sql": pool.get("sql"),
            "ms": pool.get("ms"), "cached": pool.get("cached"),
            "fallback_reason": pool.get("fallback_reason")}


@router.get("/units")
def units(subject_key: str):
    """Units and topics available for scoping a practice set."""
    C = dbx.CATALOG
    rows = dbx.query(
        f"SELECT DISTINCT unit_no FROM {C}.fact_question "
        "WHERE subject_key = :subject_key AND unit_no IS NOT NULL ORDER BY unit_no",
        {"subject_key": subject_key})["rows"]
    topics = dbx.query(
        f"SELECT topic_id, topic_name, unit_no FROM {C}.dim_topic "
        "WHERE subject_key = :subject_key ORDER BY unit_no, topic_name",
        {"subject_key": subject_key})["rows"]
    return {"units": [int(x["unit_no"]) for x in rows if x.get("unit_no") is not None],
            "topics": topics}
