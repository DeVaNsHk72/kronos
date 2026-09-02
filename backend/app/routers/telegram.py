"""Telegram webhook endpoint."""

from fastapi import APIRouter, Request

from .. import telegram as tg

router = APIRouter(tags=["telegram"])


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    update = await request.json()
    tg.handle_update(update)
    return {"ok": True}


@router.get("/telegram/set-webhook")
async def set_webhook(url: str):
    """Hit this once to register your webhook with Telegram.
    Example: /telegram/set-webhook?url=https://your-domain.com"""
    import requests
    r = requests.post(
        f"{tg.TELEGRAM_API}/setWebhook",
        json={"url": f"{url.rstrip('/')}/telegram/webhook"},
        timeout=10,
    )
    return r.json()
