"""Genie conversation client returning structured results.

The existing genie.py returns prose for the chat path. The console needs the
rows and the generated SQL as well, because every faculty screen shows the query
behind its numbers — the characteristic text-to-SQL failure is not a crash but
confidently answering a subtly different question, and the SQL is the only place
that shows.
"""
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")

HOST = (os.getenv("DATABRICKS_HOST") or "").rstrip("/")
TOKEN = os.getenv("DATABRICKS_TOKEN") or ""
SPACE = os.getenv("DATABRICKS_GENIE_SPACE_ID") or os.getenv("GENIE_SPACE_ID") or ""

# Genie is asynchronous. Every non-terminal state has to be waited on: an early
# client omitted SUBMITTED, returned immediately, and echoed the user's own
# question back as the answer — with no error to reveal it.
PENDING = {"SUBMITTED", "IN_PROGRESS", "PENDING", "FILTERING_CONTEXT",
           "ASKING_AI", "EXECUTING_QUERY", "FETCHING_METADATA",
           "PENDING_WAREHOUSE", "QUERY_RESULT_EXPIRED"}
_POLL = 2.0
_MAX_POLLS = 60


def available() -> bool:
    return bool(HOST and TOKEN and SPACE)


def _h():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _coerce(v):
    if v is None:
        return None
    try:
        if isinstance(v, str) and v.lstrip("-").isdigit():
            return int(v)
        return float(v) if isinstance(v, str) and "." in v else v
    except ValueError:
        return v


def ask(question: str, conversation_id: str | None = None) -> dict:
    """Ask Genie. Returns answer text, the SQL it wrote, and the rows."""
    if not available():
        raise RuntimeError("Genie is not configured (DATABRICKS_GENIE_SPACE_ID).")
    base = f"{HOST}/api/2.0/genie/spaces/{SPACE}"
    t0 = time.time()

    if conversation_id:
        r = requests.post(f"{base}/conversations/{conversation_id}/messages",
                          headers=_h(), json={"content": question}, timeout=60)
    else:
        r = requests.post(f"{base}/start-conversation",
                          headers=_h(), json={"content": question}, timeout=60)
    r.raise_for_status()
    j = r.json()
    conv = j.get("conversation_id") or (j.get("conversation") or {}).get("id") or conversation_id
    mid = j.get("message_id") or j.get("id") or (j.get("message") or {}).get("id")
    msg = j.get("message") or j

    guard = 0
    while msg.get("status") in PENDING and guard < _MAX_POLLS:
        time.sleep(_POLL)
        guard += 1
        msg = requests.get(f"{base}/conversations/{conv}/messages/{mid}",
                           headers=_h(), timeout=60).json()

    texts, sql, rows, cols = [], None, [], []
    for a in msg.get("attachments", []) or []:
        if (a.get("text") or {}).get("content"):
            texts.append(a["text"]["content"])
        q = a.get("query") or {}
        if q.get("query"):
            sql = q["query"]
            if q.get("description"):
                texts.append(q["description"])
            res = requests.get(
                f"{base}/conversations/{conv}/messages/{mid}/attachments/"
                f"{a.get('attachment_id')}/query-result", headers=_h(), timeout=60)
            if res.ok:
                sr = (res.json() or {}).get("statement_response", {})
                cols = [c["name"] for c in
                        sr.get("manifest", {}).get("schema", {}).get("columns", [])]
                rows = [dict(zip(cols, (_coerce(v) for v in arr)))
                        for arr in sr.get("result", {}).get("data_array", []) or []]

    return {
        "conversation_id": conv,
        "status": msg.get("status"),
        "answer": "\n\n".join(texts) or msg.get("content") or "",
        "sql": sql,
        "rows": rows,
        "columns": cols,
        "ms": int((time.time() - t0) * 1000),
        "error": (msg.get("error") or {}).get("message"),
    }
