"""Search endpoints: keyword+filter (/api/search) and semantic
(/api/search/semantic)."""

from fastapi import APIRouter, Depends, Query

from ..config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SEMANTIC_POOL
from ..db import get_db
from ..filters import Filters
from ..shape import SELECT, shape_rows
from .. import semantic

router = APIRouter(prefix="/api", tags=["search"])

SORTS = {
    "year_desc": "q.year DESC, q.course_code, q.qno",
    "year_asc": "q.year ASC, q.course_code, q.qno",
    "course": "q.course_code, q.year DESC, q.qno",
}


def _fts_match(term: str) -> str:
    # quote each token so punctuation in the query can't break FTS syntax
    toks = [t.replace('"', '""') for t in term.split() if t]
    return " ".join(f'"{t}"' for t in toks)


@router.get("/search")
def search(
    f: Filters = Depends(),
    q: str | None = Query(None, description="keyword query (FTS5)"),
    sort: str = Query("year_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    con=Depends(get_db),
):
    where, params = f.where("q")
    join = ""
    if q:
        join = ("JOIN questions_fts fts ON fts.rowid = q.id "
                "AND questions_fts MATCH ?")
        params = [_fts_match(q)] + params

    base = f"FROM questions q {join} WHERE 1=1 {where}"
    total = con.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]

    order = SORTS.get(sort, SORTS["year_desc"])
    rows = con.execute(
        f"SELECT {SELECT} {base} ORDER BY {order} LIMIT ? OFFSET ?",
        params + [page_size, (page - 1) * page_size],
    ).fetchall()

    return {
        "total": total, "page": page, "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": shape_rows(con, rows),
    }


@router.get("/search/semantic")
def semantic_search(
    f: Filters = Depends(),
    q: str = Query(..., min_length=2, description="natural-language query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    con=Depends(get_db),
):
    rows, score = semantic.search_rows(con, q, f, SELECT, SEMANTIC_POOL)
    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    scores = {r["id"]: score[r["text_hash"]] for r in page_rows}
    return {
        "total": total, "page": page, "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": shape_rows(con, page_rows, scores),
    }
