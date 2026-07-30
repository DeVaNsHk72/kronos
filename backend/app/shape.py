"""Turn question rows into API dicts, attaching images in one batched query
(no N+1). Column list is centralized so every endpoint returns the same shape.
"""

from .config import API_BASE_URL, PDF_BASE_URL

QCOLS = [
    "id", "sha", "unit", "qno", "subpart", "question_md", "marks", "co", "po",
    "parser", "confidence", "course_code", "course_name", "program", "semester",
    "year", "exam_type", "branch", "topic", "subtopic", "topic_id",
]

SELECT = ", ".join(f"q.{c}" for c in QCOLS)


def _images_for(con, ids):
    if not ids:
        return {}
    qmarks = ",".join("?" * len(ids))
    out = {}
    for qid, fn in con.execute(
        f"SELECT question_id, filename FROM question_images "
        f"WHERE question_id IN ({qmarks})", ids
    ):
        out.setdefault(qid, []).append(fn)
    return out


def shape_rows(con, rows, scores=None):
    """rows: sqlite Rows selecting QCOLS. scores: optional {id: float}."""
    ids = [r["id"] for r in rows]
    imgs = _images_for(con, ids)
    out = []
    for r in rows:
        d = {c: r[c] for c in QCOLS}
        d["images"] = [
            {"filename": fn,
             "url": f"{API_BASE_URL}/api/figures/{r['sha']}/{fn}"}
            for fn in imgs.get(r["id"], [])
        ]
        d["download_url"] = (
            f"{PDF_BASE_URL}/pdfs-{r['sha'][0]}/{r['sha']}.pdf" if PDF_BASE_URL
            else f"/api/download/{r['sha']}")
        if scores is not None:
            d["score"] = round(scores.get(r["id"], 0.0), 4)
        out.append(d)
    return out
