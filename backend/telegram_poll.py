"""Run the Telegram bot in long-polling mode (no webhook needed).

Usage:
    python -m backend.telegram_poll
    # or from repo root:
    .venv/bin/python backend/telegram_poll.py
"""
import time
import requests
from app.telegram import TELEGRAM_API, handle_update, available

if not available():
    raise SystemExit("TELEGRAM_BOT_TOKEN not set in .env")

# Clear any existing webhook so polling works
requests.post(f"{TELEGRAM_API}/deleteWebhook", timeout=10)
print("🤖 Kronos Telegram bot polling… Ctrl+C to stop.")

offset = 0
while True:
    try:
        r = requests.get(
            f"{TELEGRAM_API}/getUpdates",
            params={"offset": offset, "timeout": 30},
            timeout=35,
        )
        for update in r.json().get("result", []):
            offset = update["update_id"] + 1
            try:
                handle_update(update)
            except Exception as e:
                print(f"⚠️  Error handling update: {e}")
    except KeyboardInterrupt:
        print("\nStopped.")
        break
    except Exception as e:
        print(f"⚠️  Poll error: {e}")
        time.sleep(3)
