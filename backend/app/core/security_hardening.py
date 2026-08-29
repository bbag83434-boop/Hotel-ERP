"""Small, dependency-free security middleware used by Part 32.

This is intentionally conservative: it adds headers, rejects oversized requests,
and rate-limits authentication/webhook abuse without changing business logic.
"""
from collections import defaultdict, deque
from time import monotonic
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        response.headers.setdefault("Cache-Control", "no-store" if request.url.path.startswith("/api/") else "no-cache")
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int = 12 * 1024 * 1024):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: Callable):
        value = request.headers.get("content-length")
        if value:
            try:
                if int(value) > self.max_bytes:
                    return JSONResponse(status_code=413, content={"success": False, "error": {"code": "REQUEST_TOO_LARGE", "message": "Request payload is too large."}})
            except ValueError:
                return JSONResponse(status_code=400, content={"success": False, "error": {"code": "INVALID_CONTENT_LENGTH", "message": "Invalid Content-Length header."}})
        return await call_next(request)


class AbuseRateLimitMiddleware(BaseHTTPMiddleware):
    """Process-local limiter for high-risk endpoints.

    It is a safety layer, not a distributed quota system. Production deployments
    with multiple workers should also enforce rate limits at the edge/proxy.
    """
    def __init__(self, app, limit: int = 30, window_seconds: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        protected = request.method.upper() == "POST" and (
            path.endswith("/auth/login") or
            path.endswith("/auth/refresh") or
            path.endswith("/telegram/webhook") or
            path.endswith("/whatsapp/webhook")
        )
        if not protected:
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        key = f"{client}:{path}"
        now = monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        if len(hits) >= self.limit:
            return JSONResponse(status_code=429, headers={"Retry-After": str(self.window_seconds)}, content={"success": False, "error": {"code": "RATE_LIMITED", "message": "Too many requests. Please try again later."}})
        hits.append(now)
        return await call_next(request)
