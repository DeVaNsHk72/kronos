"""Single-question detail, including its source paper and sibling questions."""

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..shape import SELECT, shape_rows

router = APIRouter(prefix="/api", tags=["questions"])


@router.get("/question/{qid}")
def question(qid: int, con=Depends(get_db)):
    row = con.execute(
        f"SELECT {SELECT} FROM questions q WHERE q.id = ?", (qid,)).fetchone()
    if not row:
        raise HTTPException(404, "question not found")
    data = shape_rows(con, [row])[0]

    paper = con.execute(
        "SELECT course_code, course_name, program, semester, year, exam_type, "
        "branch, max_marks, num_pages FROM p.papers WHERE sha = ?",
        (row["sha"],)).fetchone()
    data["paper"] = dict(paper) if paper else None
    data["all_course_codes"] = [
        r[0] for r in con.execute(
            "SELECT course_code FROM p.paper_courses WHERE sha = ?", (row["sha"],))]
    return data
