"""SQLite access. Opens questions_v2.db read-only with papers_v2.db attached as
`p`, so a single connection can reach questions, topics, paper_courses, and
paper_branches. A single shared connection avoids the cost of re-opening and
re-attaching on every request — significant when the files live on an external
or network drive that sleeps between accesses."""

import sqlite3
import threading
from contextlib import contextmanager

from .config import QUESTIONS_DB, PAPERS_DB


def _ro_uri(path):
    return path.as_uri() + "?mode=ro"          # file:///E:/.../x.db?mode=ro


def _connect():
    con = sqlite3.connect(_ro_uri(QUESTIONS_DB), uri=True, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("ATTACH DATABASE ? AS p", (_ro_uri(PAPERS_DB),))
    con.execute("PRAGMA query_only = ON")
    con.execute("PRAGMA mmap_size = 0")
    return con


_lock = threading.Lock()
_shared: sqlite3.Connection | None = None


def _get_shared() -> sqlite3.Connection:
    global _shared
    if _shared is not None:
        try:
            _shared.execute("SELECT 1")
            return _shared
        except Exception:
            try:
                _shared.close()
            except Exception:
                pass
            _shared = None
    _shared = _connect()
    return _shared


@contextmanager
def connection():
    with _lock:
        yield _get_shared()


def get_db():
    """FastAPI dependency."""
    with connection() as con:
        yield con
