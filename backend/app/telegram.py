"""Telegram bot logic — queries Kronos via Genie.

Each Telegram user gets a Genie conversation_id so context carries
across messages. Sessions live in memory (fine for single-process).
"""

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# telegram_user_id -> genie conversation_id
_conversations: dict[int, str] = {}

TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def available() -> bool:
    return bool(BOT_TOKEN)


# ── Text cleaning ────────────────────────────────────────────────
import re

def _clean(text: str) -> str:
    """Strip LaTeX, markdown formatting, and OCR junk for plain-text Telegram."""
    if not text:
        return ""
    # remove $...$ and $$...$$ LaTeX
    text = re.sub(r'\$\$(.+?)\$\$', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'\$(.+?)\$', r'\1', text)
    # remove \text{...}, \frac{...}{...}, etc — keep inner text
    text = re.sub(r'\\(?:text|mathrm|mathbf|textbf|textit)\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\frac\{([^}]*)\}\{([^}]*)\}', r'\1/\2', text)
    text = re.sub(r'\\(?:int|sum|prod|lim|sqrt|log|ln|sin|cos|tan|ext)\b', '', text)
    # remove remaining backslash commands
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    # remove markdown bold/italic markers
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)
    # collapse whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# ── Telegram helpers ──────────────────────────────────────────────

def send_message(chat_id: int, text: str, reply_markup=None):
    """Send plain text — no parse_mode, so nothing needs escaping."""
    payload = {
        "chat_id": chat_id,
        "text": text,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    requests.post(f"{TELEGRAM_API}/sendMessage", json=payload, timeout=15)


def send_typing(chat_id: int):
    requests.post(f"{TELEGRAM_API}/sendChatAction",
                  json={"chat_id": chat_id, "action": "typing"}, timeout=5)


# ── Genie ────────────────────────────────────────────────────────

def ask_kronos(user_id: int, question: str) -> str:
    """Ask Genie via the local backend and format the answer for Telegram."""
    from . import genie_client as genie

    if not genie.available():
        return "⚠️ Genie is not configured on this server."

    conv_id = _conversations.get(user_id)
    try:
        res = genie.ask(question, conv_id)
    except Exception as e:
        return f"⚠️ Error: {str(e)[:300]}"

    # persist conversation for follow-ups
    if res.get("conversation_id"):
        _conversations[user_id] = res["conversation_id"]

    parts: list[str] = []

    # text answer — strip markdown/LaTeX that Telegram can't render
    answer = _clean(res.get("answer") or "")
    if answer:
        parts.append(answer)

    # format rows as a readable list
    rows = res.get("rows") or []
    if rows:
        parts.append(f"\n📋 {len(rows)} questions found:\n")
        for i, row in enumerate(rows[:8]):
            q_text = _clean(row.get("question_text") or "")[:150]
            marks = row.get("marks")
            year = row.get("exam_year")
            topic = row.get("topic_name") or ""
            # marks as int if whole number
            m = int(marks) if marks and marks == int(marks) else marks
            meta = " · ".join(filter(None, [
                f"{m} marks" if m else None,
                str(int(year)) if year else None,
                topic,
            ]))
            parts.append(f"  {i+1}. {q_text}")
            if meta:
                parts.append(f"      ↳ {meta}")
            parts.append("")  # blank line between items
        if len(rows) > 8:
            parts.append(f"...and {len(rows) - 8} more on kronos")

    if not parts:
        return "No results found. Try rephrasing your question."

    return "\n".join(parts)


# ── Command handlers ──────────────────────────────────────────────

WELCOME = """👋 Welcome to Kronos!

I help you study smarter using previous-year question papers.

Commands:
📚 /plan — Get a study recommendation
📝 /quiz — Practice questions
📖 /topics — Browse topics
🔄 /reset — Start fresh conversation
❓ /help — Show this message

Or just ask me anything about your course!"""


def handle_update(update: dict):
    """Route a Telegram update to the right handler."""
    msg = update.get("message")
    callback = update.get("callback_query")

    if callback:
        _handle_callback(callback)
        return

    if not msg or not msg.get("text"):
        return

    chat_id = msg["chat"]["id"]
    user_id = msg["from"]["id"]
    text = msg["text"].strip()

    if text.startswith("/"):
        cmd = text.split()[0].lower().split("@")[0]
        arg = text[len(cmd):].strip()

        if cmd in ("/start", "/help"):
            send_message(chat_id, WELCOME)
        elif cmd == "/reset":
            _conversations.pop(user_id, None)
            send_message(chat_id, "🔄 Conversation reset. Ask me anything!")
        elif cmd == "/plan":
            _ask(chat_id, user_id,
                 arg or "What should I study? Give me a priority list based on exam importance.")
        elif cmd == "/topics":
            _ask(chat_id, user_id,
                 "List all topics grouped by unit with their exam frequency.")
        elif cmd == "/quiz":
            _ask(chat_id, user_id,
                 arg or "Give me a practice question from the most important topic.")
        else:
            send_message(chat_id, "Unknown command. Type /help for options.")
    else:
        _ask(chat_id, user_id, text)


def _ask(chat_id: int, user_id: int, question: str):
    send_typing(chat_id)
    answer = ask_kronos(user_id, question)
    # Telegram 4096 char limit
    if len(answer) > 4000:
        for i in range(0, len(answer), 4000):
            send_message(chat_id, answer[i:i + 4000])
    else:
        send_message(chat_id, answer)


def _handle_callback(callback: dict):
    chat_id = callback["message"]["chat"]["id"]
    data = callback.get("data", "")
    requests.post(f"{TELEGRAM_API}/answerCallbackQuery",
                  json={"callback_query_id": callback["id"]}, timeout=5)
    send_message(chat_id, f"You selected: {data}")
