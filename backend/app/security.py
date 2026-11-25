"""HTTP hardening: security headers, body size limits, origin allowlist, per-route rate limits."""

from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.config import get_settings
from app.errors import ApiError

MAX_JSON = 512 * 1024
MAX_UPLOAD = 25 * 1024 * 1024

CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://checkout.stripe.com; "
    "object-src 'none'"
)
DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"
)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        length = request.headers.get("content-length")
        limit = MAX_UPLOAD if request.url.path.startswith("/v1/documents") else MAX_JSON
        if request.url.path == "/v1/billing/webhook":
            limit = MAX_JSON
        if length and length.isdigit() and int(length) > limit:
            return JSONResponse({"code": "TOO_LARGE", "message": "That is too large to check.", "hint": "Select a shorter part of the page."}, status_code=413)
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()"
        resp.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if request.url.path.startswith("/v1/docs"):
            # Swagger UI (development only; disabled in production) loads its script and styles from jsDelivr and
            # starts with an inline script, which the app-wide policy blocks (the page was blank).
            resp.headers.setdefault("Content-Security-Policy", DOCS_CSP)
        elif not request.url.path.startswith("/v1/"):
            resp.headers.setdefault("Content-Security-Policy", CSP)
        if get_settings().is_prod:
            resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        if request.url.path.startswith("/v1/"):
            resp.headers.setdefault("Cache-Control", "no-store")
        return resp


class OriginCheck(BaseHTTPMiddleware):
    """Unsafe requests must come from our web app or an allowed extension (blocks cross-site form posts)."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path != "/v1/billing/webhook":
            origin = request.headers.get("origin")
            s = get_settings()
            allowed = {s.public_url.rstrip("/")} | s.allowed_extension_origins
            if not s.is_prod:
                allowed |= {"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://testserver"}
            if origin and origin not in allowed and not (not s.is_prod and origin.startswith("chrome-extension://")):
                return JSONResponse({"code": "ORIGIN", "message": "Requests from this site are not allowed.", "hint": None}, status_code=403)
        return await call_next(request)


class RateLimiter:
    """In-process sliding window. One instance is fine for a single server; use a shared store if you scale out."""

    def __init__(self) -> None:
        self.hits: dict[str, list[float]] = defaultdict(list)
        self.lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: float = 60.0) -> None:
        now = time.monotonic()
        with self.lock:
            q = [t for t in self.hits[key] if now - t < window_s]
            if len(q) >= limit:
                retry = int(window_s - (now - q[0])) + 1
                self.hits[key] = q
                raise ApiError(429, "RATE_LIMIT", "Too many requests. Please wait a moment.", f"Try again in {retry} s.", {"Retry-After": str(retry)})
            q.append(now)
            self.hits[key] = q

    def reset(self) -> None:
        with self.lock:
            self.hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd and get_settings().is_prod:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate(name: str, limit: int):  # FastAPI dependency factory
    def dep(request: Request) -> None:
        limiter.check(f"{name}:{client_ip(request)}", limit)

    return dep


def _version_tuple(v: str) -> tuple[int, ...]:
    parts = []
    for x in v.split(".")[:3]:
        digits = "".join(ch for ch in x if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts + [0] * (3 - len(parts)))


class ClientVersionCheck(BaseHTTPMiddleware):
    """Desktop apps send `X-ET-Client: desktop/<version>`. Versions older than ET_DESKTOP_MIN_VERSION get HTTP 426 with
    a plain message, so an outdated app asks the user to update instead of failing in confusing ways. The release info
    endpoint and health check stay open to every version."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client = request.headers.get("x-et-client", "")
        if client.startswith("desktop/") and request.url.path not in ("/v1/clients/desktop", "/v1/health"):
            minimum = get_settings().desktop_min_version or "0.0.0"
            if _version_tuple(client.split("/", 1)[1]) < _version_tuple(minimum):
                return JSONResponse(
                    {"code": "UPDATE_REQUIRED", "message": f"This version of the desktop app is too old (needs {minimum} or newer).", "hint": "Download the latest version from the website."},
                    status_code=426,
                )
        return await call_next(request)
