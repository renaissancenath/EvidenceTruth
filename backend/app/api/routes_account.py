"""History, dashboard, consents, billing, bug reports, client error intake, admin error list, health."""

from __future__ import annotations

import contextlib
from collections import Counter
from datetime import datetime, timedelta
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api import schemas as s
from app.auth import emailer
from app.auth.deps import Principal, admin, current, optional_principal
from app.billing import plans, stripe_billing
from app.checkers import consent
from app.config import get_settings
from app.core.clock import utcnow
from app.core.redact import redact
from app.db import get_db
from app.errors import ApiError
from app.security import rate
from app.store import models as m
from app.telemetry.monitor import fingerprint

router = APIRouter(prefix="/v1", tags=["account"])


@router.get("/health")
def health() -> dict[str, object]:
    from app.llm import provider
    from app.verifier import get_stance_model

    return {"status": "ok", "version": get_settings().version, "models": {"verifier": get_stance_model().revision, "llm": get_settings().llm_model if provider.enabled() else None}}


@router.get("/history", response_model=s.HistoryOut)
def history(page: int = 1, label: str | None = None, site: str | None = None, mode: str | None = None, p: Principal = Depends(current), db: Session = Depends(get_db)) -> s.HistoryOut:
    page = max(1, page)
    stmt = select(m.Scan).where(m.Scan.user_id == p.user.user_id)
    if site:
        stmt = stmt.where(m.Scan.site.contains(site))
    if mode:
        stmt = stmt.where(m.Scan.mode == mode)
    if label:
        stmt = stmt.where(m.Scan.scan_id.in_(select(m.Claim.scan_id).join(m.Verdict).where(m.Verdict.label == label, m.Claim.user_id == p.user.user_id)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(m.Scan.created_at.desc(), m.Scan.scan_id.desc()).offset((page - 1) * 25).limit(25)).all()
    items = []
    for sc in rows:
        counts = Counter(c.verdict.label for c in sc.claims if c.verdict)
        items.append(s.HistoryItem(scan_id=sc.scan_id, site=sc.site, mode=sc.mode, status=sc.status, created_at=sc.created_at, preview=sc.text_redacted[:160], counts=dict(counts)))
    return s.HistoryOut(items=items, page=page, total=total)


@router.delete("/history/{scan_id}", status_code=204)
def delete_scan(scan_id: int, p: Principal = Depends(current), db: Session = Depends(get_db)) -> None:
    sc = db.get(m.Scan, scan_id)
    if sc is None or sc.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "That check doesn't exist.", None)
    db.delete(sc)
    db.commit()


@router.delete("/history", status_code=204)
def delete_all_history(body: s.ConfirmIn, p: Principal = Depends(current), db: Session = Depends(get_db)) -> None:
    """Deletes the signed-in user's own history only (narrow WHERE user_id = ?)."""
    uid = p.user.user_id
    for sc in db.scalars(select(m.Scan).where(m.Scan.user_id == uid)).all():
        db.delete(sc)
    db.execute(delete(m.Attempt).where(m.Attempt.user_id == uid))
    db.execute(delete(m.LoopEvent).where(m.LoopEvent.user_id == uid))
    db.execute(delete(m.Feedback).where(m.Feedback.user_id == uid))
    db.commit()


@router.get("/dashboard", response_model=s.DashboardOut)
def dashboard(days: int = 30, p: Principal = Depends(current), db: Session = Depends(get_db)) -> s.DashboardOut:
    uid = p.user.user_id
    since = utcnow() - timedelta(days=max(1, min(days, 365)))
    rows = db.execute(
        select(m.Verdict.label, m.Scan.created_at)
        .join(m.Claim, m.Claim.claim_id == m.Verdict.claim_id)
        .join(m.Scan, m.Scan.scan_id == m.Claim.scan_id)
        .where(m.Claim.user_id == uid, m.Scan.created_at >= since)
    ).all()
    by_label = Counter(r[0] for r in rows)
    by_day: dict[str, Counter] = {}
    for label, ts in rows:
        by_day.setdefault(ts.date().isoformat(), Counter())[label] += 1
    cit = (
        db.scalar(
            select(func.count())
            .select_from(m.CitationCheck)
            .where(m.CitationCheck.user_id == uid, (m.CitationCheck.exists_flag.is_(False)) | (m.CitationCheck.link_ok.is_(False)) | (m.CitationCheck.year_match.is_(False)))
        )
        or 0
    )
    loops_n = db.scalar(select(func.count()).select_from(m.LoopEvent).where(m.LoopEvent.user_id == uid, m.LoopEvent.detected_at >= since)) or 0
    src = db.execute(
        select(m.Source.provider, func.count())
        .join(m.Evidence, m.Evidence.source_id == m.Source.source_id)
        .join(m.Claim, m.Claim.claim_id == m.Evidence.claim_id)
        .where(m.Claim.user_id == uid, m.Evidence.is_decisive.is_(True))
        .group_by(m.Source.provider)
    ).all()
    recent = db.execute(
        select(m.Claim.claim_id, m.Claim.text, m.Verdict.label, m.Scan.site, m.Scan.created_at, m.Scan.scan_id)
        .join(m.Verdict)
        .join(m.Scan)
        .where(m.Claim.user_id == uid, m.Verdict.label.in_(["contradicted", "partially_supported", "misleading", "outdated", "unsubstantiated"]))
        .order_by(m.Scan.created_at.desc())
        .limit(10)
    ).all()
    return s.DashboardOut(
        by_label=dict(by_label),
        claims_total=len(rows),
        by_day=[{"day": d, **dict(c)} for d, c in sorted(by_day.items())],
        citation_issues=cit,
        loop_events=loops_n,
        sources={k: v for k, v in src},
        recent_issues=[{"claim_id": r[0], "text": r[1], "label": r[2], "site": r[3], "created_at": r[4].isoformat(), "scan_id": r[5]} for r in recent],
    )


@router.get("/consents", response_model=list[s.ConsentOut])
def list_consents(p: Principal = Depends(current), db: Session = Depends(get_db)) -> list[s.ConsentOut]:
    rows = {r.provider: r.decision for r in db.scalars(select(m.Consent).where(m.Consent.user_id == p.user.user_id))}
    return [s.ConsentOut(provider=k, name=v, decision=rows.get(k, "unset")) for k, v in consent.PROVIDERS.items()]  # type: ignore[arg-type]


@router.put("/consents", response_model=list[s.ConsentOut])
def put_consent(body: s.ConsentIn, p: Principal = Depends(current), db: Session = Depends(get_db)) -> list[s.ConsentOut]:
    try:
        consent.set_decision(db, p.user.user_id, body.provider, body.decision)
    except ValueError as exc:
        raise ApiError(400, "BAD_PROVIDER", "Unknown source.", None) from exc
    db.commit()
    return list_consents(p, db)


@router.get("/billing", response_model=s.BillingOut)
def billing(p: Principal = Depends(current), db: Session = Depends(get_db)) -> s.BillingOut:
    pl = plans.plan_of(p.user)
    return s.BillingOut(
        plan=pl.key,
        status=p.user.subscription_status,
        current_period_end=p.user.current_period_end,
        checks_used=plans.used(db, p.user.user_id),
        checks_limit=pl.checks_per_month,
        billing_enabled=stripe_billing.enabled(),
        price_label=get_settings().pro_price_label,
    )


@router.post("/billing/checkout", response_model=s.UrlOut)
def checkout(p: Principal = Depends(current), db: Session = Depends(get_db)) -> s.UrlOut:
    if p.via != "cookie":
        raise ApiError(403, "FORBIDDEN", "Upgrade from the web app.", None)
    u = db.get(m.User, p.user.user_id)
    assert u is not None
    url = stripe_billing.checkout_url(db, u)
    db.commit()
    return s.UrlOut(url=url)


@router.post("/billing/portal", response_model=s.UrlOut)
def portal(p: Principal = Depends(current)) -> s.UrlOut:
    return s.UrlOut(url=stripe_billing.portal_url(p.user))


@router.post("/billing/webhook", include_in_schema=False)
async def webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    payload = await request.body()
    return {"received": stripe_billing.handle_webhook(db, payload, request.headers.get("stripe-signature", ""))}


def _report_payload(body: s.ReportIn, p: Principal | None) -> dict[str, object]:
    return {
        "app_version": body.app_version or get_settings().version,
        "surface": body.surface,
        "browser": body.browser,
        "error_code": body.error_code,
        "steps": redact(body.steps).text,
        "expected": redact(body.expected).text,
        "plan": p.user.plan if p else None,
        "reply_to_account": bool(p and body.contact_ok),
    }


def _links(payload: dict[str, object]) -> tuple[str | None, str | None]:
    s_ = get_settings()
    gh = None
    if s_.github_repo:
        gh = f"https://github.com/{s_.github_repo}/issues/new?" + urlencode(
            {
                "template": "bug_report.yml",
                "labels": "needs-triage",
                "version": payload["app_version"],
                "code": payload["error_code"] or "",
                "steps": payload["steps"],
                "expected": payload["expected"],
                "title": f"[bug] {payload['error_code'] or 'Problem report'}",
            }
        )
    mail = None
    if s_.support_email:
        body = "\n".join(f"{k}: {v}" for k, v in payload.items())
        mail = f"mailto:{s_.support_email}?subject={quote('EvidenceTruth problem report')}&body={quote(body)}"
    return gh, mail


@router.post("/reports/preview", response_model=s.ReportPreviewOut)
def report_preview(body: s.ReportIn, p: Principal | None = Depends(optional_principal)) -> s.ReportPreviewOut:
    payload = _report_payload(body, p)
    gh, mail = _links(payload)
    return s.ReportPreviewOut(payload=payload, github_issue_url=gh, mailto_url=mail)


@router.post("/reports", status_code=201, dependencies=[Depends(rate("reports", 5))])
def report_send(body: s.ReportIn, p: Principal | None = Depends(optional_principal), db: Session = Depends(get_db)) -> dict[str, int]:
    """Stores the report (label needs-triage) and emails the support address. Sends exactly the previewed payload."""
    payload = _report_payload(body, p)
    row = m.BugReport(user_id=p.user.user_id if p else None, payload=payload)
    db.add(row)
    db.commit()
    s_ = get_settings()
    if s_.support_email:
        with contextlib.suppress(emailer.EmailError):  # stored anyway; triage reads the table
            emailer.send(
                s_.support_email, f"[needs-triage] EvidenceTruth report #{row.report_id}", "\n".join(f"{k}: {v}" for k, v in payload.items()), reply_to=p.user.email if p and body.contact_ok else None
            )
    return {"report_id": row.report_id}


@router.post("/client-errors", status_code=202, dependencies=[Depends(rate("clienterr", 30))])
def client_error(body: s.ClientErrorIn, db: Session = Depends(get_db)) -> dict[str, str]:
    """Runtime errors from the web app and extension (type, scrubbed message, our own frames only)."""
    frames = [f[:200] for f in body.frames if "chrome-extension://" in f or "/assets/" in f or f.startswith("src/")][:10]
    etype = f"{body.surface}:{body.error_type}"[:120]
    fp = fingerprint(etype, frames)
    row = db.get(m.ErrorEvent, fp)
    if row:
        row.count += 1
        row.last_seen = utcnow()
        if row.status == "resolved":
            row.status = "new"
    else:
        db.add(m.ErrorEvent(fingerprint=fp, error_type=etype, message=redact(body.message).text[:300], frames=frames, route=body.route, app_version=body.app_version))
    db.commit()
    return {"fingerprint": fp}


@router.get("/admin/errors")
def admin_errors(status: str | None = None, _: Principal = Depends(admin), db: Session = Depends(get_db)) -> list[dict[str, object]]:
    stmt = select(m.ErrorEvent).order_by(m.ErrorEvent.last_seen.desc()).limit(200)
    if status:
        stmt = stmt.where(m.ErrorEvent.status == status)
    return [
        {
            "fingerprint": e.fingerprint,
            "error_type": e.error_type,
            "message": e.message,
            "frames": e.frames,
            "route": e.route,
            "count": e.count,
            "app_version": e.app_version,
            "status": e.status,
            "first_seen": e.first_seen.isoformat(),
            "last_seen": e.last_seen.isoformat(),
            "issue_url": e.issue_url,
        }
        for e in db.scalars(stmt)
    ]


def purge_expired(db: Session) -> int:
    """Retention job: delete each user's scans past their expiry (narrow WHERE on expires_at)."""
    now = utcnow()
    n = 0
    for sc in db.scalars(select(m.Scan).where(m.Scan.expires_at < now).limit(1000)).all():
        db.delete(sc)
        n += 1
    db.execute(delete(m.MagicLink).where(m.MagicLink.expires_at < now - timedelta(days=1)))
    db.execute(delete(m.PairingCode).where(m.PairingCode.expires_at < now - timedelta(hours=1)))
    db.execute(delete(m.HttpCache).where(m.HttpCache.fetched_at < now - timedelta(days=30)))
    db.commit()
    return n


_ = datetime  # keep import for type checkers


@router.get("/clients/desktop", response_model=s.DesktopRelease)
def desktop_release() -> s.DesktopRelease:
    """Public: the latest desktop app version and where to download it. Set by the operator after publishing a release."""
    st = get_settings()
    return s.DesktopRelease(
        latest_version=st.desktop_latest_version or None,
        min_version=st.desktop_min_version or "0.0.0",
        download_url=st.desktop_download_url or None,
        update_feed_url=st.desktop_update_feed_url or None,
        web_url=st.public_url.rstrip("/") or None,
    )
