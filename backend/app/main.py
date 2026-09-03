"""BMSCE Question Bank API — FastAPI app assembly."""

import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import semantic
from .config import CORS_ORIGINS
from .db import connection
from .routers import faculty, notes, search, meta, questions, files, chat, papers, telegram, voice

app = FastAPI(
    title="BMSCE Question Bank API",
    version="2.0",
    description="Keyword + semantic search over BMSCE exam questions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(meta.router)
app.include_router(questions.router)
app.include_router(files.router)
app.include_router(chat.router)
app.include_router(papers.router)
app.include_router(telegram.router)
app.include_router(voice.router)
app.include_router(faculty.router)
app.include_router(notes.router)


@app.on_event("startup")
def _warm_semantic():
    """Load the embedding matrix and query model off the request path.

    Both are lazy, so without this the first semantic search (or chat message)
    pays ~4 minutes of model load. Warming in a daemon thread keeps startup
    instant and keyword search usable throughout.
    """
    threading.Thread(target=semantic.warm, daemon=True,
                     name="semantic-warm").start()


@app.get("/api/health")
def health():
    with connection() as con:
        n = con.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    from . import semantic
    return {"status": "ok", "questions": n, "semantic_loaded": semantic.is_ready()}


_stats_cache: dict | None = None

@app.get("/api/stats")
def stats():
    global _stats_cache
    if _stats_cache is not None:
        return _stats_cache
    with connection() as con:
        def one(q):
            return con.execute(q).fetchone()[0]
        _stats_cache = {
            "questions": one("SELECT COUNT(*) FROM questions"),
            "papers": one("SELECT COUNT(DISTINCT sha) FROM questions"),
            "courses": one("SELECT COUNT(DISTINCT course_code) FROM questions"),
            "branches": one("SELECT COUNT(DISTINCT branch) FROM questions"),
            "topics": one("SELECT COUNT(*) FROM topics"),
            "year_range": list(con.execute(
                "SELECT MIN(year), MAX(year) FROM questions").fetchone()),
        }
        return _stats_cache
