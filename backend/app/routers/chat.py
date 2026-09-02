"""Grounded chat: /api/chat.

Runs parse -> retrieve -> compose. Retrieval is the same semantic path the UI
uses, so a chat reply and a search for the same thing surface the same rows.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import chat as C
from .. import genie, llm, semantic
from .. import mas_client as mas
from ..config import SEMANTIC_POOL
from ..db import get_db
from ..filters import Filters
from ..ratelimit import limit
from ..shape import SELECT, shape_rows

router = APIRouter(prefix="/api", tags=["chat"])

# each chat message triggers an LLM parse + compose call — cap per IP so one
# visitor can't burn through the shared Groq quota for everyone else
_chat_limit = limit(max_requests=10, window_seconds=60)

MAX_RESULTS = 25


class Turn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: Optional[List[Turn]] = None
    compose: bool = True          # False -> retrieval only, no model call


def _retrieve(con, intent, course_code):
    def run(cc):
        # intent carries extra keys (kind, query, hints); Filters.of ignores them
        return semantic.search_rows(
            con, intent["query"], Filters.of({**intent, "course_code": cc}),
            SELECT, SEMANTIC_POOL)

    rows, score = run(course_code)
    if not rows and course_code:
        # course_code is matched fuzzily by name, so it is the likeliest wrong
        # filter ("CSE" resolves to "Chemistry for CSE Stream"). Answering from
        # a broader search beats answering nothing.
        intent["dropped_course"] = course_code
        rows, score = run(None)
    return rows[:MAX_RESULTS], score


@router.post("/chat", dependencies=[Depends(_chat_limit)])
def chat(body: ChatIn, con=Depends(get_db)):
    # --- Agent path: the supervisor reasons and calls Genie as a tool. -------
    # Preferred over talking to Genie directly, because the reply carries the
    # tool calls and the rows as well as the prose, and over the local RAG
    # pipeline, which answers from a local SQLite copy rather than the governed
    # Unity Catalog tables.
    if mas.available():
        try:
            out = mas.ask(body.message)
            if out.get("answer") or out.get("rows"):
                return {
                    "intent": {"kind": "agent", "query": body.message,
                               "tools": [t.get("name") for t in out.get("tools", [])]},
                    "answer": out.get("answer"),
                    "columns": out.get("columns", []),
                    "rows": out.get("rows", []),
                    "engine": "supervisor",
                    "results": [], "citations": [],
                }
        except Exception:
            pass  # fall through

    if genie.available():
        try:
            return {
                "intent": {"kind": "genie", "query": body.message},
                "answer": genie.ask(body.message),
                "engine": "genie",
                "results": [], "citations": [],
            }
        except Exception:
            pass

    # --- Local RAG pipeline (fallback) ---
    history = [t.model_dump() for t in (body.history or [])]
    intent = C.parse_intent(body.message, con, history)

    course_code, course_name = C.resolve_course(intent.get("course_hint"), con)
    if intent.get("course_hint") and not course_code:
        intent["unresolved_course"] = intent["course_hint"]
        return {
            "intent": {**intent, "course_code": None, "course_name": None},
            "answer": C.no_match_reply(intent),
            "results": [], "citations": [],
        }

    if intent.get("kind") == "other":
        return {
            "intent": {**intent, "course_code": course_code,
                       "course_name": course_name},
            "answer": C.no_match_reply(intent),
            "results": [], "citations": [],
        }

    rows, score = _retrieve(con, intent, course_code)
    cited = rows[:C.CONTEXT_ROWS]

    answer = None
    if body.compose and llm.available():
        try:
            answer = C.compose(body.message, cited, intent)
        except Exception as e:
            intent["compose_error"] = str(e)[:120]

    scores = {r["id"]: score.get(r["text_hash"], 0.0) for r in rows}
    results = shape_rows(con, rows, scores)
    return {
        "intent": {**intent, "course_code": course_code,
                   "course_name": course_name},
        "answer": answer,
        "citations": [
            {"n": i, "question_id": r["id"], "course_code": r["course_code"],
             "year": r["year"], "qno": r["qno"],
             "download_url": r["download_url"]}
            for i, r in enumerate(results[:C.CONTEXT_ROWS], 1)
        ],
        "results": results,
    }
