"""Databricks SQL Statement Execution client.

This lives in the backend, not the browser. The faculty console is a SPA served
as static files, so anything it could read is public — the warehouse token has to
stay on this side and the SPA calls named queries instead of sending SQL.
"""
import os
import time

import requests

HOST = (os.getenv("DATABRICKS_HOST") or "").rstrip("/")
TOKEN = os.getenv("DATABRICKS_TOKEN") or ""
WAREHOUSE = os.getenv("DATABRICKS_WAREHOUSE_ID") or ""
# Must match the catalog the Genie space is configured against, or the Ask panel
# answers about a different dataset than every other screen.
CATALOG = os.getenv("DATABRICKS_CATALOG") or "hackathon_project.default"

_POLL = 1.5
_MAX_POLLS = 60


def available() -> bool:
    return bool(HOST and TOKEN and WAREHOUSE)


def _headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _coerce(v):
    """Databricks returns every cell as a string; restore numbers and nulls."""
    if v is None or v == "":
        return None if v is None else ""
    try:
        if v.lstrip("-").isdigit():
            return int(v)
        f = float(v)
        return f
    except (ValueError, AttributeError):
        return v


def query(sql: str, params: dict | None = None) -> dict:
    """Run a statement with bound parameters. Never interpolate user input."""
    if not available():
        raise RuntimeError("Databricks is not configured on this server.")
    t0 = time.time()
    body = {
        "statement": sql,
        "warehouse_id": WAREHOUSE,
        "wait_timeout": "50s",
        "on_wait_timeout": "CONTINUE",
        "parameters": [
            {"name": k, "value": None if v is None else str(v),
             "type": "INT" if isinstance(v, int) and not isinstance(v, bool) else "STRING"}
            for k, v in (params or {}).items()
        ],
    }
    r = requests.post(f"{HOST}/api/2.0/sql/statements", headers=_headers(),
                      json=body, timeout=60)
    r.raise_for_status()
    j = r.json()
    sid = j["statement_id"]

    # A cold warehouse returns PENDING and takes seconds to spin up.
    guard = 0
    while j.get("status", {}).get("state") in ("PENDING", "RUNNING") and guard < _MAX_POLLS:
        time.sleep(_POLL)
        guard += 1
        j = requests.get(f"{HOST}/api/2.0/sql/statements/{sid}",
                         headers=_headers(), timeout=60).json()

    state = j.get("status", {}).get("state")
    if state != "SUCCEEDED":
        msg = j.get("status", {}).get("error", {}).get("message", state)
        raise RuntimeError(f"Databricks: {msg}")

    cols = [c["name"] for c in j.get("manifest", {}).get("schema", {}).get("columns", [])]
    data = j.get("result", {}).get("data_array", []) or []
    rows = [dict(zip(cols, (_coerce(v) for v in arr))) for arr in data]
    return {
        "rows": rows,
        "columns": cols,
        "sql": sql,
        "ms": int((time.time() - t0) * 1000),
        "truncated": j.get("manifest", {}).get("truncated", False),
    }
