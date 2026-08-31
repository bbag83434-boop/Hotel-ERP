from __future__ import annotations
import hashlib, hmac
from typing import Optional
import httpx
from app.core.config import settings

class WhatsAppError(RuntimeError):
    pass

def configured() -> bool:
    return bool(settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)

def verify_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    if not settings.WHATSAPP_APP_SECRET or not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(settings.WHATSAPP_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, f"sha256={expected}")

async def _call(payload: dict, timeout: Optional[float] = None) -> dict:
    if not configured():
        raise WhatsAppError("WhatsApp Cloud API is not configured.")
    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=timeout or settings.WHATSAPP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)
            data = response.json()
    except Exception as exc:
        raise WhatsAppError(f"WhatsApp request failed: {exc}") from exc
    if response.status_code >= 400 or data.get("error"):
        raise WhatsAppError((data.get("error") or {}).get("message", f"WhatsApp API returned {response.status_code}"))
    return data

async def send_text(to: str, text: str, timeout: Optional[float] = None) -> dict:
    return await _call({"messaging_product":"whatsapp","recipient_type":"individual","to":to,"type":"text","text":{"preview_url":False,"body":text}}, timeout)
