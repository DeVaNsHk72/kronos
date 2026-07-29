"""SQLite access. Opens questions_v2.db read-only with papers_v2.db attached as
`p`, so a single connection can reach questions, topics, paper_courses, and
paper_branches. Read-only + per-request connections scale fine for search."""

import sqlite3
from contextlib import contextmanager

from .config import QUESTIONS_DB, PAPERS_DB


def _ro_uri(path):
    return path.as_uri() + "?mode=ro"          # file:///E:/.../x.db?mode=ro


def _connect():
    con = sqlite3.connect(_ro_uri(QUESTIONS_DB), uri=True, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("ATTACH DATABASE ? AS p", (_ro_uri(PAPERS_DB),))
    con.execute("PRAGMA query_only = ON")
    # The rebuild scripts rewrite these files in place while the server is up.
    # With memory-mapped I/O a reader that touches a page invalidated by that
    # rewrite dies with SIGSEGV instead of raising; reading through the pager
    # costs little at our query shapes and fails cleanly.
    con.execute("PRAGMA mmap_size = 0")
    return con


@contextmanager
def connection():
    con = _connect()
    try:
        yield con
    finally:
        con.close()


def get_db():
    """FastAPI dependency."""
    with connection() as con:
        yield con
