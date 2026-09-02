"""Databricks Genie client.

Sends a question to a Genie Space and polls until it responds.
Falls back gracefully if credentials are missing.
"""

import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")

HOST = (os.getenv("DATABRICKS_HOST") or "").rstrip("/")
TOKEN = os.getenv("DATABRICKS_TOKEN")
SPACE_ID = os.getenv("GENIE_SPACE_ID")

_POLL_INTERVAL = 1.5
_MAX_POLLS = 40  # ~60s max wait


def available() -> bool:
    return bool(HOST and TOKEN and SPACE_ID)


def _headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def ask(question: str) -> str:
    """Send a question to Genie and return the text answer."""
    # 1. start conversation
    r = requests.post(
        f"{HOST}/api/2.0/genie/spaces/{SPACE_ID}/start-conversation",
        headers=_headers(),
        json={"content": question},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    conv_id = data["conversation_id"]
    msg_id = data["message_id"]

    # 2. poll until completed
    for _ in range(_MAX_POLLS):
        time.sleep(_POLL_INTERVAL)
        r = requests.get(
            f"{HOST}/api/2.0/genie/spaces/{SPACE_ID}/conversations/{conv_id}/messages/{msg_id}",
            headers=_headers(),
            timeout=30,
        )
        r.raise_for_status()
        msg = r.json()
        status = msg.get("status")
        if status == "COMPLETED":
            return _extract_answer(msg)
        if status in ("FAILED", "CANCELLED"):
            return f"Genie returned status: {status}"

    return "Genie timed out waiting for a response."


def _extract_answer(msg: dict) -> str:
    """Pull the text answer from a completed Genie message."""
    # Genie responses can have attachments with query results and a text body
    attachments = msg.get("attachments", [])
    parts = []

    # text body
    body = msg.get("content", "")
    if body:
        parts.append(body)

    # attachment text (query descriptions, results)
    for att in attachments:
        if att.get("text", {}).get("content"):
            parts.append(att["text"]["content"])
        # query result attachment
        if att.get("query", {}).get("description"):
            parts.append(att["query"]["description"])

    return "\n\n".join(parts) if parts else "Genie returned no content."
