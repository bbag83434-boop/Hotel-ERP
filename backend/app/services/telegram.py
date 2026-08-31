from __future__ import annotations
from typing import Optional
import httpx
from app.core.config import settings

class TelegramError(RuntimeError):
    pass

def configured() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN)

def _api_url(method: str) -> str:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramError('Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN on the server.')
    return f'https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}'

async def _call(method: str, payload: dict, timeout: Optional[float] = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout or settings.TELEGRAM_TIMEOUT_SECONDS) as client:
            response = await client.post(_api_url(method), json=payload)
        data = response.json()
    except Exception as exc:
        raise TelegramError(f'Telegram request failed: {exc}') from exc
    if response.status_code >= 400 or not data.get('ok'):
        raise TelegramError(data.get('description', f'Telegram API returned {response.status_code}'))
    return data

async def send_message(chat_id: str, text: str, timeout: Optional[float] = None) -> dict:
    return await _call('sendMessage', {'chat_id': chat_id, 'text': text, 'disable_web_page_preview': True}, timeout)

async def set_webhook(url: str, secret_token: Optional[str] = None, timeout: Optional[float] = None) -> dict:
    payload = {'url': url, 'drop_pending_updates': False}
    if secret_token:
        payload['secret_token'] = secret_token
    return await _call('setWebhook', payload, timeout)

async def delete_webhook(timeout: Optional[float] = None) -> dict:
    return await _call('deleteWebhook', {'drop_pending_updates': False}, timeout)
