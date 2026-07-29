"""OpenAI client for the chat endpoint.

The key lives in .env (gitignored) and is read once at import. If it is absent
the module still imports — `available()` is False and the chat router degrades
to retrieval-only rather than failing at startup.
"""

import os
import threading
from pathlib import Path

from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")

API_KEY = (os.getenv("LLM_API_KEY") or os.getenv("OPEN_AI_API_KEY")
           or os.getenv("OPENAI_API_KEY"))
BASE_URL = os.getenv("LLM_BASE_URL")  # e.g. https://api.groq.com/openai/v1
MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")

_lock = threading.Lock()
_client = None


def available() -> bool:
    return bool(API_KEY)


def client():
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                from openai import OpenAI
                # short timeout: this sits on a request path, and a stalled
                # connection should surface as a degraded reply, not a hang
                kwargs = {"api_key": API_KEY, "timeout": 30.0, "max_retries": 1}
                if BASE_URL:
                    kwargs["base_url"] = BASE_URL
                _client = OpenAI(**kwargs)
    return _client


def complete(system: str, user: str, *, schema=None, max_tokens=800,
             temperature=0.0) -> str:
    """One-shot completion. With `schema`, the reply is JSON matching it."""
    kwargs = {}
    if schema is not None:
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "reply", "strict": False, "schema": schema},
        }
    r = client().chat.completions.create(
        model=MODEL, temperature=temperature, max_tokens=max_tokens,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        **kwargs,
    )
    return r.choices[0].message.content
