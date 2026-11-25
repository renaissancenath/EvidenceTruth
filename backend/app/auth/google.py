"""Google sign-in: OAuth 2.0 authorization code flow with PKCE and state, done with plain HTTPS calls.

State, PKCE verifier and nonce live in a short-lived signed cookie (itsdangerous).
The user's email is taken from Google's userinfo endpoint and must be verified.
"""

from __future__ import annotations

import base64
import hashlib
from urllib.parse import urlencode

import httpx
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.auth.tokens import new_token
from app.config import get_settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 - a URL, not a secret
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
STATE_COOKIE = "et_oauth"


def enabled() -> bool:
    s = get_settings()
    return bool(s.google_client_id and s.google_client_secret)


def _signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().secret_key, salt="google-oauth")


def redirect_uri() -> str:
    return f"{get_settings().public_url.rstrip('/')}/v1/auth/google/callback"


def start() -> tuple[str, str]:
    """Returns (url to redirect to, signed cookie value)."""
    state, verifier, nonce = new_token(16), new_token(48), new_token(16)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    params = {
        "client_id": get_settings().google_client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    cookie = _signer().dumps({"state": state, "verifier": verifier})
    return f"{AUTH_URL}?{urlencode(params)}", cookie


def finish(code: str, state: str, cookie: str | None) -> dict[str, str]:
    if not cookie:
        raise ValueError("missing state")
    try:
        data = _signer().loads(cookie, max_age=600)
    except BadSignature as exc:
        raise ValueError("bad state") from exc
    if data.get("state") != state:
        raise ValueError("state mismatch")
    s = get_settings()
    tok = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
            "code_verifier": data["verifier"],
        },
        timeout=10,
    )
    tok.raise_for_status()
    access = tok.json()["access_token"]
    info = httpx.get(USERINFO_URL, headers={"Authorization": f"Bearer {access}"}, timeout=10)
    info.raise_for_status()
    u = info.json()
    if not u.get("email") or not u.get("email_verified"):
        raise ValueError("email not verified")
    return {"sub": str(u["sub"]), "email": str(u["email"]).lower(), "name": str(u.get("name") or "")}
