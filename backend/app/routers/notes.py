"""Notes and past-paper PDFs, listed and served.

The index is built from the OCR manifest, so a document appears here only if it
was actually read — the list never offers a file the rest of the system has no
text for. Files stay on disk under EXNOTE_ROOT rather than in the repo; they are
2 GB of PDFs.
"""
import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/notes", tags=["notes"])

# routers/ is one level deeper than app/, so this is parents[3], not the
# parents[2] the modules in app/ use.
REPO = Path(__file__).resolve().parents[3]
INDEX = REPO / "backend" / "data" / "notes_index.json"
# The PDFs live outside the repo; src paths in the index are relative to this.
EXNOTE_ROOT = Path(os.getenv("EXNOTE_ROOT") or REPO.parent).resolve()

_index: list[dict] | None = None


def index() -> list[dict]:
    global _index
    if _index is None:
        _index = json.loads(INDEX.read_text()) if INDEX.exists() else []
    return _index


@router.get("")
def list_documents(subject: str | None = None, asset: str | None = None,
                   branch: str | None = None, q: str | None = None):
    rows = index()
    if subject:
        rows = [r for r in rows if r["subject"] == subject]
    if asset:
        rows = [r for r in rows if r["asset"] == asset]
    if branch:
        rows = [r for r in rows if branch in (r.get("branches") or [])]
    if q:
        t = q.lower()
        rows = [r for r in rows
                if t in r["subject"].lower() or t in r["file"].lower()]
    return {"count": len(rows), "documents": rows}


@router.get("/subjects")
def subjects():
    """Subjects that actually have documents, with what is available for each."""
    out: dict[str, dict] = {}
    for r in index():
        s = out.setdefault(r["subject"], {
            "subject": r["subject"], "notes": 0, "papers": 0,
            "pages": 0, "branches": set(), "sems": set(), "code": r.get("code"),
        })
        s["notes" if r["asset"] == "notes" else "papers"] += 1
        s["pages"] += r.get("pages") or 0
        s["branches"].update(r.get("branches") or [])
        s["sems"].update(r.get("sems") or [])
    return {"subjects": sorted(
        ({**v, "branches": sorted(v["branches"]), "sems": sorted(v["sems"])}
         for v in out.values()),
        key=lambda x: -(x["notes"] + x["papers"]))}


@router.get("/file/{sha}")
def file(sha: str, download: bool = Query(False)):
    row = next((r for r in index() if r["sha"] == sha), None)
    if not row:
        raise HTTPException(404, "unknown document")
    path = (EXNOTE_ROOT / row["src"]).resolve()
    # The sha comes from our own index, but resolve-and-check anyway: a path
    # that escapes the root must never be served, whatever produced it.
    if not str(path).startswith(str(EXNOTE_ROOT)) or not path.exists():
        raise HTTPException(404, f"file not on disk: {row['file']}")
    return FileResponse(
        path, media_type="application/pdf",
        filename=f"{row['subject']} — {row['file']}" if download else None,
        content_disposition_type="attachment" if download else "inline",
    )
