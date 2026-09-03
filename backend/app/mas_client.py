"""Databricks Multi-Agent Supervisor endpoint.

The supervisor is the agent; Genie is a tool it calls. A question goes in, and
the response carries the supervisor's reasoning, the tool calls it made, and the
rows Genie returned — so the chain is inspectable end to end rather than just
the final prose.

Task type is `agent/v1/responses`, so the payload is the Responses API shape
(`input`), not chat completions (`messages`).
"""
import json
import math
import os
import re

import requests

ENDPOINT = (os.getenv("DATABRICKS_AGENT_ENDPOINT") or "").strip()
TOKEN = (os.getenv("DATABRICKS_AGENT_TOKEN") or os.getenv("DATABRICKS_TOKEN") or "").strip()
TIMEOUT = float(os.getenv("DATABRICKS_AGENT_TIMEOUT") or 180)


def available() -> bool:
    return bool(ENDPOINT and TOKEN)


def _parse_markdown_table(text: str) -> tuple[list[str], list[dict]]:
    """Genie's results arrive as a markdown table inside the agent's prose.

    Parsed back into rows so the UI can render a real table and chart it, rather
    than showing a wall of pipes. The leading index column pandas emits is
    dropped.
    """
    lines = [l for l in text.splitlines() if l.strip().startswith("|")]
    if len(lines) < 2:
        return [], []

    def split_row(line: str) -> list[str]:
        # NOT strip("|"): the header arrives as "||col_a|col_b|" and stripping
        # collapses the doubled pipe, leaving a header one cell short of every
        # row — which then discards the whole table as a length mismatch. Drop
        # exactly one empty cell at each end instead, preserving the leading
        # blank that marks the dataframe index.
        parts = line.strip().split("|")
        if parts and parts[0] == "":
            parts = parts[1:]
        if parts and parts[-1] == "":
            parts = parts[:-1]
        return [p.strip() for p in parts]

    cells = [split_row(l) for l in lines]
    header = cells[0]
    body = [r for r in cells[1:] if not all(set(c) <= {"-", ":", ""} for c in r)]
    # a blank first header cell is the dataframe index
    drop_first = header and header[0] == ""
    if drop_first:
        header = header[1:]
        body = [r[1:] for r in body]

    def num(v: str):
        # The supervisor formats numbers for a human reader, so a count arrives
        # as "1,571" and a null as "NaN". Both break something downstream:
        # "1,571" reaches the UI as a string that Number() turns into NaN, so a
        # dashboard tile renders the literal text NaN; float("NaN") reaches
        # JSONResponse, which renders with allow_nan=False and fails the whole
        # request with a 500. Normalise here, where every cell already passes.
        s = v.replace(",", "").strip()
        if s.lower() in ("nan", "inf", "-inf", "infinity", "none", "null"):
            return None
        try:
            if s.lstrip("-").isdigit():
                return int(s)
            f = float(s)
        except ValueError:
            return v            # ordinary text: hand back the cell untouched
        return f if math.isfinite(f) else None

    rows = [dict(zip(header, (num(c) for c in r))) for r in body if len(r) == len(header)]
    return header, rows


def ask(question: str) -> dict:
    """Put a question to the supervisor. Returns prose, tool calls, and rows."""
    if not available():
        raise RuntimeError("Agent endpoint is not configured (DATABRICKS_AGENT_ENDPOINT).")
    r = requests.post(
        ENDPOINT,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        json={"input": [{"role": "user", "content": question}]},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    payload = r.json()

    texts: list[str] = []
    tools: list[dict] = []
    columns: list[str] = []
    rows: list[dict] = []

    for item in payload.get("output", []) or []:
        if item.get("type") == "function_call":
            args = item.get("arguments")
            try:
                args = json.loads(args) if isinstance(args, str) else args
            except json.JSONDecodeError:
                pass
            tools.append({"name": item.get("name"), "arguments": args})
            continue
        for part in item.get("content", []) or []:
            t = (part.get("text") or "").strip()
            if not t:
                continue
            # the tool-name echo the supervisor emits is plumbing, not an answer
            if re.fullmatch(r"<name>.*</name>", t):
                continue
            if t.startswith("|") or "\n|" in t:
                cols, parsed = _parse_markdown_table(t)
                if parsed:
                    columns, rows = cols, parsed
                    continue
            texts.append(t)

    return {
        "answer": "\n\n".join(texts),
        "tools": tools,
        "columns": columns,
        "rows": rows,
        "raw_id": payload.get("id"),
    }
