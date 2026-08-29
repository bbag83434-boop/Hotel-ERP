from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol

from app.core.config import settings


@dataclass
class AIResponse:
    text: str
    provider: str
    model: str
    usage: Dict[str, Any]
    request_id: Optional[str] = None


class AIProviderError(RuntimeError):
    pass


class AIProvider(Protocol):
    name: str
    model: str

    def generate(self, messages: List[Dict[str, str]], temperature: float = 0.2, max_tokens: int = 800) -> AIResponse:
        ...


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key, self.model, self.base_url = api_key, model, base_url.rstrip("/")

    def generate(self, messages, temperature=0.2, max_tokens=800):
        payload = {"model": self.model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        data = _post_json(f"{self.base_url}/chat/completions", payload, {"Authorization": f"Bearer {self.api_key}"})
        choice = (data.get("choices") or [{}])[0]
        text = ((choice.get("message") or {}).get("content") or "").strip()
        if not text:
            raise AIProviderError("OpenAI returned an empty response")
        return AIResponse(text, self.name, self.model, data.get("usage") or {}, data.get("id"))


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key, self.model, self.base_url = api_key, model, base_url.rstrip("/")

    def generate(self, messages, temperature=0.2, max_tokens=800):
        contents = []
        for message in messages:
            role = "model" if message.get("role") == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": message.get("content", "")} ]})
        payload = {"contents": contents, "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}}
        data = _post_json(f"{self.base_url}/v1beta/models/{self.model}:generateContent?key={self.api_key}", payload, {})
        candidates = data.get("candidates") or []
        parts = ((candidates[0].get("content") if candidates else {}) or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            raise AIProviderError("Gemini returned an empty response")
        usage = data.get("usageMetadata") or {}
        return AIResponse(text, self.name, self.model, usage, None)


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key, self.model, self.base_url = api_key, model, base_url.rstrip("/")

    def generate(self, messages, temperature=0.2, max_tokens=800):
        system = ""
        body = []
        for message in messages:
            if message.get("role") == "system":
                system = message.get("content", "")
            else:
                body.append({"role": "assistant" if message.get("role") == "assistant" else "user", "content": message.get("content", "")})
        payload = {"model": self.model, "messages": body, "max_tokens": max_tokens, "temperature": temperature}
        if system:
            payload["system"] = system
        data = _post_json(f"{self.base_url}/v1/messages", payload, {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"})
        blocks = data.get("content") or []
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        if not text:
            raise AIProviderError("Anthropic returned an empty response")
        return AIResponse(text, self.name, self.model, data.get("usage") or {}, data.get("id"))


def _post_json(url: str, payload: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    request = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), method="POST")
    request.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise AIProviderError(f"Provider HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise AIProviderError(f"Provider request failed: {exc}") from exc


def get_configured_providers() -> Dict[str, AIProvider]:
    providers: Dict[str, AIProvider] = {}
    if settings.OPENAI_API_KEY:
        providers["openai"] = OpenAIProvider(settings.OPENAI_API_KEY, settings.OPENAI_MODEL, settings.OPENAI_BASE_URL)
    if settings.GEMINI_API_KEY:
        providers["gemini"] = GeminiProvider(settings.GEMINI_API_KEY, settings.GEMINI_MODEL, settings.GEMINI_BASE_URL)
    if settings.ANTHROPIC_API_KEY:
        providers["anthropic"] = AnthropicProvider(settings.ANTHROPIC_API_KEY, settings.ANTHROPIC_MODEL, settings.ANTHROPIC_BASE_URL)
    return providers


def get_provider_status() -> Dict[str, Any]:
    configured = get_configured_providers()
    default = settings.AI_DEFAULT_PROVIDER.lower()
    return {
        "default_provider": default,
        "configured_providers": [name for name in ("openai", "gemini", "anthropic") if name in configured],
        "available": bool(configured),
        "timeout_seconds": settings.AI_PROVIDER_TIMEOUT_SECONDS,
    }


def get_provider(name: Optional[str] = None) -> AIProvider:
    providers = get_configured_providers()
    selected = (name or settings.AI_DEFAULT_PROVIDER).lower()
    if selected not in providers:
        raise AIProviderError(f"AI provider '{selected}' is not configured")
    return providers[selected]
