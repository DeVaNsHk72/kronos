"""Telegram bot logic — hits the Databricks serving endpoint.

Each Telegram user gets conversation history so context carries
across messages. Sessions live in memory (fine for single-process).
"""

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
DATABRICKS_HOST = (os.getenv("DATABRICKS_HOST") or "").rstrip("/")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN")
SERVING_ENDPOINT = os.getenv("DATABRICKS_SERVING_ENDPOINT",
                             "mas-4d3338c9-endpoint")

# telegram_user_id -> list of {role, content} dicts
_sessions: dict[int, list[dict]] = {}

TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def available() -> bool:
    return bool(BOT_TOKEN and DATABRICKS_HOST and DATABRICKS_TOKEN)


# ── Telegram helpers ──────────────────────────────────────────────

def send_message(chat_id: int, text: str, reply_markup=None):
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    requests.post(f"{TELEGRAM_API}/sendMessage", json=payload, timeout=15)


def send_typing(chat_id: int):
    requests.post(f"{TELEGRAM_API}/sendChatAction",
                  json={"chat_id": chat_id, "action": "typing"}, timeout=5)


# ── Databricks serving endpoint ──────────────────────────────────

def ask_databricks(user_id: int, question: str) -> str:
    """Send question to Databricks serving endpoint with conversation history."""
    history = _sessions.setdefault(user_id, [])
    history.append({"role": "user", "content": question})

    # keep last 10 messages to avoid token limits
    msgs = history[-10:]

    try:
        r = requests.post(
            f"{DATABRICKS_HOST}/serving-endpoints/{SERVING_ENDPOINT}/invocations",
            headers={"Authorization": f"Bearer {DATABRICKS_TOKEN}",
                     "Content-Type": "application/json"},
            json={"input": msgs},
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()

        # extract text from response
        answer = ""
        for output in data.get("output", []):
            if output.get("type") == "message":
                for content in output.get("content", []):
                    if content.get("type") == "output_text":
                        answer += content["text"]

        if not answer:
            answer = "No response from Databricks."

        # save assistant reply to history
        history.append({"role": "assistant", "content": answer})
        _sessions[user_id] = history[-10:]

        return answer

    except Exception as e:
        return f"⚠️ Error: {str(e)[:300]}"


# ── Command handlers ──────────────────────────────────────────────

WELCOME = """👋 *Welcome to Kronos!*

I help you study smarter using previous-year question papers.

*Commands:*
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
            _sessions.pop(user_id, None)
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
    answer = ask_databricks(user_id, question)
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
