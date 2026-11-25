"""Request authentication. Cookie sessions need a CSRF header on unsafe methods; bearer tokens don't."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.auth.sessions import CSRF_COOKIE, SESSION_COOKIE, lookup
from app.auth.tokens import equal
from app.db import get_db
from app.errors import ApiError
from app.store.models import AuthSession, User

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


@dataclass
class Principal:
    user: User
    session: AuthSession
    via: str  # cookie | bearer


def _bearer(request: Request) -> str | None:
    h = request.headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else None


def optional_principal(request: Request, db: Session = Depends(get_db)) -> Principal | None:
    token = _bearer(request)
    if token:
        found = lookup(db, token, kind="extension")
        if not found:
            raise ApiError(401, "AUTH_INVALID", "Your extension is no longer connected.", "Connect it again from Settings.")
        return Principal(found[0], found[1], "bearer")
    cookie = request.cookies.get(SESSION_COOKIE)
    if not cookie:
        return None
    found = lookup(db, cookie, kind="web")
    if not found:
        return None
    if request.method in UNSAFE:
        header = request.headers.get("x-et-csrf", "")
        cookie_csrf = request.cookies.get(CSRF_COOKIE, "")
        if not header or not cookie_csrf or not equal(header, cookie_csrf):
            raise ApiError(403, "CSRF", "This request was blocked for your safety.", "Reload the page and try again.")
    return Principal(found[0], found[1], "cookie")


def current(p: Principal | None = Depends(optional_principal)) -> Principal:
    if p is None:
        raise ApiError(401, "AUTH_REQUIRED", "Sign in to continue.", "Go to the sign-in page.")
    return p


def admin(p: Principal = Depends(current)) -> Principal:
    if not p.user.is_admin:
        raise ApiError(403, "FORBIDDEN", "This page is for administrators.", None)
    return p
