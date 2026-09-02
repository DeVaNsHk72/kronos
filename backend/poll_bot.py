"""Telegram polling mode — no ngrok needed. Run alongside uvicorn."""

import os, time, requests, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
API = f"https://api.telegram.org/bot{TOKEN}"

# import the handler from the app
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.telegram import handle_update

offset = 0
print("🤖 Kronos bot polling... Send /start on Telegram")

while True:
    try:
        r = requests.get(f"{API}/getUpdates",
                         params={"offset": offset, "timeout": 30}, timeout=35)
        updates = r.json().get("result", [])
        for u in updates:
            offset = u["update_id"] + 1
            print(f"← {u.get('message', {}).get('text', '(no text)')}")
            try:
                handle_update(u)
                print("  → responded")
            except Exception as e:
                print(f"  ✗ {e}")
    except KeyboardInterrupt:
        print("\nStopped.")
        break
    except Exception as e:
        print(f"Poll error: {e}")
        time.sleep(3)
