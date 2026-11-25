"""Server-side sessions. Web: HttpOnly cookie. Extension: bearer token from the pairing flow."""

from __future__ import annotations

from datetime import timedelta

from fastapi import Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.tokens import new_token, sha256
from app.config import get_settings
from app.core.clock import aware, utcnow
from app.store.models import AuthSession, User

SESSION_COOKIE = "et_session"
CSRF_COOKIE = "et_csrf"
WEB_TTL = timedelta(days=30)
EXT_TTL = timedelta(days=90)


def create_session(db: Session, user: User, kind: str = "web", label: str | None = None) -> str:
    token = new_token()
    db.add(AuthSession(user_id=user.user_id, token_sha256=sha256(token), kind=kind, label=label, expires_at=utcnow() + (WEB_TTL if kind == "web" else EXT_TTL)))
    user.last_login_at = utcnow()
    db.flush()
    return token


def lookup(db: Session, token: str | None, kind: str | None = None) -> tuple[User, AuthSession] | None:
    if not token or len(token) > 200:
        return None
    sess = db.scalar(select(AuthSession).where(AuthSession.token_sha256 == sha256(token)))
    if sess is None or sess.revoked or aware(sess.expires_at) < utcnow() or (kind and sess.kind != kind):
        return None
    user = db.get(User, sess.user_id)
    if user is None:
        return None
    if utcnow() - aware(sess.last_used_at) > timedelta(minutes=5):
        sess.last_used_at = utcnow()
        db.commit()
    return user, sess


def revoke(db: Session, sess: AuthSession) -> None:
    sess.revoked = True


def revoke_all(db: Session, user_id: int) -> None:
    db.execute(update(AuthSession).where(AuthSession.user_id == user_id).values(revoked=True))


def set_cookies(resp: Response, token: str) -> None:
    secure = get_settings().is_prod or get_settings().public_url.startswith("https")
    resp.set_cookie(SESSION_COOKIE, token, max_age=int(WEB_TTL.total_seconds()), httponly=True, secure=secure, samesite="lax", path="/")
    resp.set_cookie(CSRF_COOKIE, new_token(16), max_age=int(WEB_TTL.total_seconds()), httponly=False, secure=secure, samesite="strict", path="/")


def clear_cookies(resp: Response) -> None:
    resp.delete_cookie(SESSION_COOKIE, path="/")
    resp.delete_cookie(CSRF_COOKIE, path="/")
