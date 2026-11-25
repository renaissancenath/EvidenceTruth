"""Sign-in (magic link, Google), sign-out, account, sessions, extension pairing."""

from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.schemas import AuthConfigOut, ConfirmIn, MagicLinkIn, MePatch, PairCodeOut, PairIn, PairOut, SessionOut, UserOut, VerifyIn
from app.auth import emailer, google
from app.auth.deps import Principal, current, optional_principal
from app.auth.sessions import clear_cookies, create_session, revoke, revoke_all, set_cookies
from app.auth.tokens import new_token, sha256, six_digit_code
from app.billing import plans, stripe_billing
from app.config import get_settings
from app.core.clock import aware, utcnow
from app.db import get_db
from app.errors import ApiError
from app.security import client_ip, limiter, rate
from app.store import models as m

router = APIRouter(prefix="/v1", tags=["auth"])
MAGIC_TTL = timedelta(minutes=15)
PAIR_TTL = timedelta(minutes=2)


def user_out(db: Session, u: m.User) -> UserOut:
    p = plans.plan_of(u)
    return UserOut(
        user_id=u.user_id,
        email=u.email,
        display_name=u.display_name,
        plan=p.key,  # type: ignore[arg-type]
        subscription_status=u.subscription_status,
        current_period_end=u.current_period_end,
        retention_days=u.retention_days,
        onboarded=u.onboarded,
        checks_used=plans.used(db, u.user_id),
        checks_limit=p.checks_per_month,
        documents_limit=p.documents,
        is_admin=u.is_admin,
    )


@router.get("/auth/config", response_model=AuthConfigOut)
def auth_config() -> AuthConfigOut:
    s = get_settings()
    return AuthConfigOut(
        google=google.enabled(),
        billing=stripe_billing.enabled(),
        pro_price_label=s.pro_price_label,
        free_checks_per_month=s.free_checks_per_month,
        pro_checks_per_month=s.pro_checks_per_month,
        free_documents=s.free_documents,
        pro_documents=s.pro_documents,
    )


@router.post("/auth/magic-link", status_code=202, dependencies=[Depends(rate("magic", 10))])
def request_magic_link(body: MagicLinkIn, request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    email = body.email.lower()
    limiter.check(f"magic-email:{sha256(email)}", 3, 600)  # 3 links per address per 10 minutes
    token = new_token()
    db.add(m.MagicLink(email=email, token_sha256=sha256(token), expires_at=utcnow() + MAGIC_TTL))
    db.add(m.AuditLog(action="magic_link_requested", detail={"ip_hash": sha256(client_ip(request))[:16]}))
    db.commit()
    link = f"{get_settings().public_url.rstrip('/')}/auth/verify?token={token}"
    emailer.send(
        email,
        "Your EvidenceTruth sign-in link",
        f"Use this link to sign in to EvidenceTruth. It works once and expires in 15 minutes.\n\n{link}\n\nIf you didn't ask for it, you can ignore this email.",
    )
    # Same answer whether or not the address has an account (no account enumeration).
    s = get_settings()
    if s.email_backend == "console" and not s.is_prod:
        # Local development only: no mail is sent, so hand the link to the login page. Never in production.
        return {"status": "sent", "dev_link": link}
    return {"status": "sent"}


def _sign_in(db: Session, email: str, name: str | None = None, google_sub: str | None = None) -> m.User:
    user = db.scalar(select(m.User).where(m.User.email == email))
    if user is None:
        user = m.User(email=email, display_name=name or None, google_sub=google_sub)
        db.add(user)
        db.flush()
        db.add(m.AuditLog(user_id=user.user_id, action="account_created", detail={"via": "google" if google_sub else "email"}))
    elif google_sub and not user.google_sub:
        user.google_sub = google_sub
    return user


@router.post("/auth/verify", response_model=UserOut, dependencies=[Depends(rate("verify", 20))])
def verify_magic_link(body: VerifyIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    link = db.scalar(select(m.MagicLink).where(m.MagicLink.token_sha256 == sha256(body.token)).with_for_update())
    if link is None or link.used_at is not None or aware(link.expires_at) < utcnow():
        raise ApiError(400, "LINK_INVALID", "This sign-in link has expired or was already used.", "Ask for a new link.")
    link.used_at = utcnow()
    user = _sign_in(db, link.email)
    token = create_session(db, user)
    db.add(m.AuditLog(user_id=user.user_id, action="signed_in", detail={"via": "email"}))
    db.commit()
    set_cookies(response, token)
    return user_out(db, user)


@router.get("/auth/google/start", include_in_schema=False)
def google_start() -> Response:
    if not google.enabled():
        raise ApiError(404, "GOOGLE_OFF", "Google sign-in is not set up.", "Use the email link instead.")
    url, cookie = google.start()
    resp = RedirectResponse(url, status_code=302)
    resp.set_cookie(google.STATE_COOKIE, cookie, max_age=600, httponly=True, samesite="lax", secure=get_settings().public_url.startswith("https"), path="/v1/auth/google")
    return resp


@router.get("/auth/google/callback", include_in_schema=False)
def google_callback(request: Request, code: str = "", state: str = "", db: Session = Depends(get_db)) -> Response:
    base = get_settings().public_url.rstrip("/")
    try:
        info = google.finish(code, state, request.cookies.get(google.STATE_COOKIE))
    except Exception:  # noqa: BLE001 - any failure means "sign-in did not complete"
        return RedirectResponse(f"{base}/login?error=google", status_code=302)
    user = db.scalar(select(m.User).where(m.User.google_sub == info["sub"])) or _sign_in(db, info["email"], info["name"], info["sub"])
    token = create_session(db, user)
    db.add(m.AuditLog(user_id=user.user_id, action="signed_in", detail={"via": "google"}))
    db.commit()
    resp = RedirectResponse(f"{base}/app", status_code=302)
    set_cookies(resp, token)
    resp.delete_cookie(google.STATE_COOKIE, path="/v1/auth/google")
    return resp


@router.post("/auth/logout", status_code=204)
def logout(response: Response, p: Principal | None = Depends(optional_principal), db: Session = Depends(get_db)) -> Response:
    if p:
        revoke(db, p.session)
        db.commit()
    clear_cookies(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(p: Principal = Depends(current), db: Session = Depends(get_db)) -> UserOut:
    return user_out(db, p.user)


@router.patch("/me", response_model=UserOut)
def patch_me(body: MePatch, p: Principal = Depends(current), db: Session = Depends(get_db)) -> UserOut:
    u = db.get(m.User, p.user.user_id)
    assert u is not None
    if body.display_name is not None:
        u.display_name = body.display_name.strip() or None
    if body.retention_days is not None:
        if body.retention_days > plans.plan_of(u).max_retention_days:
            raise ApiError(402, "RETENTION_LIMIT", f"Your plan keeps history for up to {plans.plan_of(u).max_retention_days} days.", "Upgrade to Pro for longer history.")
        u.retention_days = body.retention_days
    if body.onboarded is not None:
        u.onboarded = body.onboarded
    db.commit()
    return user_out(db, u)


@router.get("/me/export")
def export_me(p: Principal = Depends(current), db: Session = Depends(get_db)) -> Response:
    uid = p.user.user_id
    scans = db.scalars(select(m.Scan).where(m.Scan.user_id == uid)).all()
    data = {
        "account": {"email": p.user.email, "plan": p.user.plan, "created_at": p.user.created_at.isoformat()},
        "scans": [
            {
                "scan_id": s.scan_id,
                "site": s.site,
                "mode": s.mode,
                "created_at": s.created_at.isoformat(),
                "text_redacted": s.text_redacted,
                "claims": [
                    {
                        "text": c.text,
                        "type": c.claim_type,
                        "label": c.verdict.label if c.verdict else None,
                        "evidence": [{"passage": e.passage, "url": e.source.url, "stance": e.stance} for e in c.evidence],
                    }
                    for c in s.claims
                ],
            }
            for s in scans
        ],
        "documents": [{"filename": d.filename, "added_at": d.added_at.isoformat()} for d in db.scalars(select(m.Document).where(m.Document.user_id == uid))],
        "consents": [{"provider": c.provider, "decision": c.decision} for c in db.scalars(select(m.Consent).where(m.Consent.user_id == uid))],
    }
    return Response(json.dumps(data, indent=2), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="evidencetruth-export.json"'})


@router.delete("/me", status_code=204)
def delete_me(body: ConfirmIn, response: Response, p: Principal = Depends(current), db: Session = Depends(get_db)) -> Response:
    """Delete the account and every row it owns (cascade). Cancels a paid subscription first."""
    u = db.get(m.User, p.user.user_id)
    assert u is not None
    if u.stripe_subscription_id and stripe_billing.enabled():
        try:
            stripe_billing.client().v1.subscriptions.cancel(u.stripe_subscription_id)
        except Exception:  # noqa: BLE001
            raise ApiError(502, "BILLING_CANCEL_FAILED", "We couldn't cancel your subscription.", "Try again, or cancel it from Billing first.") from None
    db.add(m.AuditLog(user_id=None, action="account_deleted", detail={"user_hash": sha256(u.email)[:16]}))
    for model in (m.Evidence,):
        db.execute(delete(model).where(model.claim_id.in_(select(m.Claim.claim_id).where(m.Claim.user_id == u.user_id))))
    for model in (m.Verdict,):
        db.execute(delete(model).where(model.claim_id.in_(select(m.Claim.claim_id).where(m.Claim.user_id == u.user_id))))
    for model in (m.CitationCheck, m.CodeCheck, m.Claim):
        db.execute(delete(model).where(model.user_id == u.user_id))  # type: ignore[attr-defined]
    for model in (m.Scan, m.DocChunk, m.Document, m.Attempt, m.LoopEvent, m.Consent, m.Feedback, m.Usage, m.PairingCode, m.AuthSession):
        db.execute(delete(model).where(model.user_id == u.user_id))  # type: ignore[attr-defined]
    db.execute(delete(m.MagicLink).where(m.MagicLink.email == u.email))
    db.delete(u)
    db.commit()
    clear_cookies(response)
    response.status_code = 204
    return response


@router.get("/me/sessions", response_model=list[SessionOut])
def sessions(p: Principal = Depends(current), db: Session = Depends(get_db)) -> list[SessionOut]:
    rows = db.scalars(
        select(m.AuthSession).where(m.AuthSession.user_id == p.user.user_id, m.AuthSession.revoked.is_(False), m.AuthSession.expires_at > utcnow()).order_by(m.AuthSession.last_used_at.desc())
    ).all()
    return [SessionOut(session_id=r.session_id, kind=r.kind, label=r.label, created_at=r.created_at, last_used_at=r.last_used_at, current=r.session_id == p.session.session_id) for r in rows]


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke_session(session_id: int, p: Principal = Depends(current), db: Session = Depends(get_db)) -> Response:
    row = db.get(m.AuthSession, session_id)
    if row is None or row.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "That session doesn't exist.", None)
    row.revoked = True
    db.commit()
    return Response(status_code=204)


@router.post("/me/sessions/revoke-all", status_code=204)
def revoke_all_sessions(response: Response, p: Principal = Depends(current), db: Session = Depends(get_db)) -> Response:
    revoke_all(db, p.user.user_id)
    db.commit()
    clear_cookies(response)
    response.status_code = 204
    return response


# extension pairing: signed-in web user gets a 6-digit code, types it into the extension
@router.post("/extension/pair-code", response_model=PairCodeOut, dependencies=[Depends(rate("paircode", 10))])
def pair_code(p: Principal = Depends(current), db: Session = Depends(get_db)) -> PairCodeOut:
    if p.via != "cookie":
        raise ApiError(403, "FORBIDDEN", "Create pairing codes from the web app.", None)
    db.execute(delete(m.PairingCode).where(m.PairingCode.user_id == p.user.user_id))
    for _ in range(10):  # avoid colliding with another user's live code
        code = six_digit_code()
        clash = db.scalar(select(func.count()).select_from(m.PairingCode).where(m.PairingCode.code_sha256 == sha256(code), m.PairingCode.used.is_(False), m.PairingCode.expires_at > utcnow()))
        if not clash:
            break
    db.add(m.PairingCode(user_id=p.user.user_id, code_sha256=sha256(code), expires_at=utcnow() + PAIR_TTL))
    db.commit()
    return PairCodeOut(code=code, expires_in_s=int(PAIR_TTL.total_seconds()))


@router.post("/extension/pair", response_model=PairOut)
def pair(body: PairIn, request: Request, db: Session = Depends(get_db)) -> PairOut:
    ip = client_ip(request)
    try:
        limiter.check(f"pair-fail:{ip}", 5, 600)  # 5 tries, then a 10-minute lockout
    except ApiError as exc:
        raise ApiError(429, "PAIR_LOCKED", "Too many wrong codes. Pairing is paused for 10 minutes.", None, exc.headers) from None
    row = db.scalar(select(m.PairingCode).where(m.PairingCode.code_sha256 == sha256(body.code), m.PairingCode.used.is_(False)))
    if row is None or aware(row.expires_at) < utcnow():
        raise ApiError(409, "PAIR_INVALID", "That code is wrong or has expired.", "Make a new code in Settings, then type it within 2 minutes.")
    row.used = True
    user = db.get(m.User, row.user_id)
    assert user is not None
    token = create_session(db, user, kind="extension", label=body.label or "Browser extension")
    db.add(m.AuditLog(user_id=user.user_id, action="extension_paired", detail={}))
    db.commit()
    limiter.hits.pop(f"pair-fail:{ip}", None)
    return PairOut(token=token, email=user.email)
