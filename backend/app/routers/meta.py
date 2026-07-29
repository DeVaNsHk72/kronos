"""Metadata for driving the UI: filter option lists, contextual facet counts,
course list, and per-course topics."""

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..filters import Filters

router = APIRouter(prefix="/api", tags=["meta"])

FACET_COLS = ["branch", "program", "exam_type", "semester", "year"]

# Not real branches/programmes — buckets of subjects shared by every branch.
# Filters.where() folds their questions into whichever branch/programme is
# selected, so offering them as options would only duplicate results.
SHARED = {"branch": ("Common", "Elective"), "program": ("Kannada", "Mathematics")}


def _hide_shared(col, alias=""):
    vals = SHARED.get(col)
    if not vals:
        return ""
    quoted = ", ".join(f"'{v}'" for v in vals)
    return f" AND {alias}{col} NOT IN ({quoted})"

# Page numbers occasionally land in the marks column (990, 985, 960…). Anything
# above this is parse debris: the bound keeps 99% of rows and stops one bogus
# 385 from dragging a topic's average from 6 marks to 17.
MARKS_MAX = 25


@router.get("/filters")
def filter_options(con=Depends(get_db)):
    """All distinct values per filter dimension (static option lists)."""
    out = {}
    for col in FACET_COLS:
        out[col] = [r[0] for r in con.execute(
            f"SELECT DISTINCT {col} FROM questions WHERE {col} IS NOT NULL"
            f"{_hide_shared(col)} ORDER BY {col}")]
    return out


@router.get("/facets")
def facets(f: Filters = Depends(), con=Depends(get_db)):
    """Value -> count per dimension, honouring the currently applied filters
    (so the UI can show how many results each option would yield)."""
    where, params = f.where("q")
    base = f"FROM questions q WHERE 1=1 {where}"
    out = {}
    for col in FACET_COLS:
        out[col] = {
            str(r[0]): r[1] for r in con.execute(
                f"SELECT q.{col}, COUNT(*) {base} AND q.{col} IS NOT NULL"
                f"{_hide_shared(col, 'q.')} GROUP BY q.{col} ORDER BY 2 DESC", params)
        }
    out["total"] = con.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
    return out


@router.get("/courses")
def courses(
    q: str | None = Query(None, description="filter by code or name substring"),
    limit: int = Query(500, le=5000),
    con=Depends(get_db),
):
    sql = ("SELECT course_code, course_name, COUNT(*) n FROM questions "
           "WHERE course_code IS NOT NULL ")
    params = []
    if q:
        sql += "AND (course_code LIKE ? OR course_name LIKE ?) "
        params += [f"%{q}%", f"%{q}%"]
    sql += "GROUP BY course_code, course_name ORDER BY course_code LIMIT ?"
    params.append(limit)
    return [{"course_code": r[0], "course_name": r[1], "question_count": r[2]}
            for r in con.execute(sql, params)]


@router.get("/topics")
def topics(f: Filters = Depends(), con=Depends(get_db)):
    """Topic -> its subtopics (with question counts).

    Takes the full filter set rather than just course_code, so the same
    endpoint serves the picker and any year-narrowed view.
    """
    where, params = f.where("q")
    rows = con.execute(
        f"SELECT q.topic, q.subtopic, COUNT(*) n FROM questions q "
        f"WHERE q.topic IS NOT NULL {where} GROUP BY 1, 2 ORDER BY 1, 2", params
    ).fetchall()
    out = {}
    for topic, sub, n in rows:
        t = out.setdefault(topic, {"topic": topic, "count": 0, "subtopics": []})
        t["count"] += n
        t["subtopics"].append({"subtopic": sub, "count": n})
    return list(out.values())


@router.get("/stats/course")
def course_stats(f: Filters = Depends(), con=Depends(get_db)):
    """Revision stats for the current filter selection.

    Ranks topics by how often they are asked, and carries per-year counts so
    the UI can show whether a topic is still current — a topic asked 20 times
    but not since 2018 is worth less than one asked 10 times including 2024.
    """
    where, params = f.where("q")
    base = f"FROM questions q WHERE 1=1 {where}"

    # one pass gives topic totals, per-year spread and mark weight.
    # AVG skips NULLs, so the CASE bounds the average to believable marks
    # without dropping the question from COUNT(*).
    agg = {}
    for topic, year, n, avg_marks in con.execute(
            f"SELECT q.topic, q.year, COUNT(*), "
            f"AVG(CASE WHEN q.marks BETWEEN 1 AND {MARKS_MAX} THEN q.marks END) "
            f"{base} AND q.topic IS NOT NULL GROUP BY 1, 2", params):
        t = agg.setdefault(topic, {"topic": topic, "count": 0, "by_year": {},
                                   "_marks": []})
        t["count"] += n
        if year:
            t["by_year"][str(year)] = n
        if avg_marks:
            t["_marks"].append((avg_marks, n))

    topics = []
    for t in agg.values():
        m = t.pop("_marks")
        # weight by question count so a rare 20-mark outlier does not dominate
        t["avg_marks"] = (round(sum(a * w for a, w in m) / sum(w for _, w in m), 1)
                          if m else None)
        t["last_asked"] = max((int(y) for y in t["by_year"]), default=None)
        topics.append(t)
    topics.sort(key=lambda t: -t["count"])

    by_year = {}
    for t in topics:                       # topic is 100% populated, so this
        for y, n in t["by_year"].items():  # totals every question in scope
            by_year[y] = by_year.get(y, 0) + n

    marks = {str(int(k)): v for k, v in con.execute(
        f"SELECT q.marks, COUNT(*) {base} AND q.marks BETWEEN 1 AND {MARKS_MAX} "
        f"GROUP BY 1 ORDER BY 1", params)}

    # verbatim repeats: same normalized text in more than one year. The length
    # guard drops parser debris ("Service time (sec) 3") that repeats trivially.
    repeats = [
        {"n": n, "years": sorted(int(y) for y in yrs.split(",")),
         "marks": mk, "text": txt}
        for n, yrs, mk, txt in con.execute(
            f"SELECT COUNT(*) n, GROUP_CONCAT(DISTINCT q.year), MAX(q.marks), "
            f"MIN(q.question_md) {base} AND length(q.question_md) > 40 "
            f"GROUP BY q.text_hash HAVING COUNT(DISTINCT q.year) > 1 "
            f"ORDER BY n DESC, q.year DESC LIMIT 20", params)
    ]

    return {"total": sum(by_year.values()), "by_year": by_year,
            "topics": topics, "marks": marks, "repeats": repeats}
