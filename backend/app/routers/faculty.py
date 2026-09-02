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
    "distinctCos": (
        "List the distinct non-null course_outcome values for subject_key '{s}'. "
        "Return one column named course_outcome, ordered ascending."),
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
    "coAttainment": (
        "For subject_key '{s}', where sitting = 'Main' and course_outcome is not "
        "null and marks is not null: per course_outcome return columns "
        "course_outcome, questions (count), total_marks (sum of marks), and "
        "pct_of_paper (that outcome's marks as a percentage of all marks, one "
        "decimal). Order by course_outcome."),
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
    "bloomByCo": (
        "For subject_key '{s}' where sitting = 'Main' and course_outcome and "
        "bloom_level are both not null: per course_outcome and bloom_level "
        "return columns course_outcome, bloom_level, questions (count), "
        "marks (sum). Order by course_outcome."),
}


class GenieQueryReq(BaseModel):
    name: str
    subject_key: str
    cutoff_year: int | None = None


@router.post("/genie-query")
def genie_query(r: GenieQueryReq):
    """A named analytical question, answered by Genie rather than by our SQL.

    Falls back to the equivalent hand-written statement when Genie is
    unavailable or returns no rows, so a screen degrades to working-but-not-
    agentic rather than to blank. The response says which path produced it.
    """
    tmpl = ASKS.get(r.name)
    if not tmpl:
        raise HTTPException(400, f'no agent question for "{r.name}"')
    reason = "agent unavailable"
    # The supervisor is the agent; Genie is the tool it calls. Preferred over
    # talking to Genie directly so every screen goes through one entry point.
    if mas.available():
        try:
            res = mas.ask(tmpl.format(s=r.subject_key, y=r.cutoff_year or 0))
            if res.get("rows"):
                res["engine"] = "supervisor"
                res["sql"] = res.get("sql") or "\n".join(
                    f"-- {t.get('name')}: {t.get('arguments')}" for t in res.get("tools", []))
                return res
            reason = "supervisor returned no rows"
        except Exception as e:
            reason = str(e)
    if genie.available():
        try:
            res = genie.ask(tmpl.format(s=r.subject_key, y=r.cutoff_year or 0))
            if res.get("rows"):
                res["engine"] = "genie"
                res["fallback_reason"] = reason
                return res
            reason = res.get("error") or "Genie returned no rows"
        except Exception as e:
            reason = str(e)

    sql = Q.REGISTRY.get(r.name)
    if not sql:
        raise HTTPException(503, reason)
    out = dbx.query(sql, {"subject_key": r.subject_key})
    out["engine"] = "sql-fallback"
    out["fallback_reason"] = reason
    return out


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
    require_co: bool = True
    bloom_mix: dict = {}
    locked: dict = {}
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
    cos_seen: set[int] = set()

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

    co_rows, co_engine = _rows("distinctCos")
    all_cos = [int(x["course_outcome"]) for x in co_rows
               if x.get("course_outcome") is not None]

    # One call for the whole eligible pool, then select locally. Asking Genie
    # per slot would be ~15 round trips at ~20s each and the wording would vary
    # between them, so two runs of the same constraints could differ.
    pool_rows, pool_engine = _rows("candidates")
    units = _units
    if not units:
        raise HTTPException(422, "No questions with a unit for this subject.")

    bloom_order = [k for k, v in sorted(r.bloom_mix.items(), key=lambda kv: -kv[1]) if v > 0]

    def pick(unit, marks, bloom, want_co):
        rows = [c for c in pool_rows
                if int(c.get("unit_no") or -1) == unit
                and int(c.get("marks") or -1) == marks]
        pool = [c for c in rows if c["question_id"] not in used_ids
                and not (c.get("repeat_cluster_id") and c["repeat_cluster_id"] in used_clusters)]
        if not pool:
            return None
        def score(c):
            return ((0 if want_co is not None and c.get("course_outcome") == want_co else 100)
                    + (0 if bloom and c.get("bloom_level") == bloom else 10)
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
            want_co = next((c for c in all_cos if c not in cos_seen), None) if r.require_co else None

            q = pick(unit, sec["marks"], bloom, want_co)
            if not q:
                # The format fixes the marks, so relaxing the unit is the honest
                # trade — and it is reported.
                for u in sec_units:
                    if u == unit:
                        continue
                    q = pick(u, sec["marks"], bloom, want_co)
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
            if q.get("course_outcome") is not None:
                cos_seen.add(int(q["course_outcome"]))
            picks.append({"n": n, "marks": sec["marks"], "q": q})
        sections.append({**sec, "picks": picks})

    answerable = sum(s["answer"] * s["marks"] for s in fmt["sections"])
    printed = sum(s["slots"] * s["marks"] for s in fmt["sections"])
    empty = sum(1 for s in sections for p in s["picks"] if not p["q"])
    if r.require_co:
        missing = [c for c in all_cos if c not in cos_seen]
        if missing:
            warnings.append(
                f"CO coverage incomplete: CO {', '.join(map(str, missing))} could not be placed "
                f"in this format's {sum(s['slots'] for s in fmt['sections'])} slots.")

    achieved: dict = {}
    for s in sections:
        for p in s["picks"]:
            b = (p["q"] or {}).get("bloom_level")
            if b:
                achieved[b] = achieved.get(b, 0) + p["marks"]

    return {"subject_key": r.subject_key, "exam_type": r.exam_type, "basis": "declared",
            "format": fmt["name"], "instructions": fmt["instructions"], "sections": sections,
            "total_marks": answerable, "target_marks": answerable, "printed_marks": printed,
            "cos_required": all_cos, "cos_covered": sorted(cos_seen),
            "bloom_requested": r.bloom_mix, "bloom_achieved": achieved,
            "empty_slots": empty, "cutoff_year": cutoff, "warnings": warnings,
            "engine": pool_engine, "pool_size": len(pool_rows),
            "sql_used": Q.CANDIDATES}
