"""Faculty console API.

The browser names a query; it never sends SQL. Anything else would let a crafted
request run arbitrary statements against the warehouse with this server's own
credentials.
"""
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import databricks as dbx
from .. import faculty_sql as Q

router = APIRouter(prefix="/api/faculty", tags=["faculty"])


class QueryReq(BaseModel):
    name: str
    params: dict = {}


@router.get("/status")
def status():
    return {"databricks": dbx.available(), "catalog": dbx.CATALOG,
            "queries": sorted(Q.REGISTRY)}


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
class GenerateReq(BaseModel):
    subject_key: str
    exam_type: str = "CIE"
    exclude_years: int = 3
    require_co: bool = True
    bloom_mix: dict = {}
    locked: dict = {}


# The CIE shape is printed on the papers themselves ("PART -A / Total 5 Marks
# (No Choice)", "Internal choice is provided in Part C", "Maximum Marks: 40"), so
# it is declared rather than inferred. A declared blueprint beats an observed
# average: averaging real papers gives unit totals of 155 or 201, which then have
# to be scaled — a fudge a known format does not need.
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
    fmt = FORMATS.get(r.exam_type)
    if not fmt:
        raise HTTPException(422, f"No declared format for {r.exam_type}. "
                                 "Only CIE is declared; SEE blueprints are observed only.")
    warnings: list[str] = []
    cutoff = date.today().year - r.exclude_years
    used_ids: set[str] = set()
    used_clusters: set[str] = set()
    cos_seen: set[int] = set()

    all_cos = [int(x["course_outcome"]) for x in
               dbx.query(Q.DISTINCT_COS, {"subject_key": r.subject_key})["rows"]
               if x.get("course_outcome") is not None]
    slots = dbx.query(Q.MARK_SLOTS, {"subject_key": r.subject_key})["rows"]
    units = sorted({int(x["unit_no"]) for x in slots if x.get("unit_no") is not None})
    if not units:
        raise HTTPException(422, "No questions with a unit for this subject.")

    bloom_order = [k for k, v in sorted(r.bloom_mix.items(), key=lambda kv: -kv[1]) if v > 0]

    def pick(unit, marks, bloom, want_co):
        rows = dbx.query(Q.CANDIDATES, {
            "subject_key": r.subject_key, "unit_no": unit, "marks": marks,
            "cutoff_year": cutoff, "target_bloom": bloom or ""})["rows"]
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
            unit = units[(n - 1) % len(units)]
            want_co = next((c for c in all_cos if c not in cos_seen), None) if r.require_co else None

            q = pick(unit, sec["marks"], bloom, want_co)
            if not q:
                # The format fixes the marks, so relaxing the unit is the honest
                # trade — and it is reported.
                for u in units:
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
            "sql_used": Q.CANDIDATES}
