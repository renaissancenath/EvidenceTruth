"""Error monitor: groups runtime failures by fingerprint in error_events, and forwards scrubbed events to
Sentry/GlitchTip when ET_SENTRY_DSN is set. Never records request bodies, page text, documents or tokens."""

from __future__ import annotations

import hashlib
import logging
import re
import traceback
from typing import Any

import structlog
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import utcnow
from app.core.redact import redact
from app.store.models import ErrorEvent

log = structlog.get_logger()
APP_ROOT = "app/"


def configure_logging() -> None:
    structlog.configure(
        processors=[structlog.processors.add_log_level, structlog.processors.TimeStamper(fmt="iso"), structlog.processors.JSONRenderer()],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    )


def our_frames(exc: BaseException) -> list[str]:
    frames = []
    for fs in traceback.extract_tb(exc.__traceback__):
        path = fs.filename.replace("\\", "/")
        if "/app/" in path and "site-packages" not in path:
            rel = path[path.rfind("/app/") + 1 :]
            frames.append(f"{rel}:{fs.lineno} in {fs.name}")
    return frames[-8:]


def fingerprint(error_type: str, frames: list[str]) -> str:
    top = [re.sub(r":\d+ in", " in", f) for f in frames[-3:]]  # line numbers shift between releases
    return hashlib.sha256((error_type + "|" + "|".join(top)).encode()).hexdigest()[:32]


def scrub_message(msg: str) -> str:
    return redact(msg).text[:300]


def capture(db: Session, exc: BaseException, route: str | None, error_code: str | None = None) -> str:
    etype = type(exc).__name__
    frames = our_frames(exc)
    fp = fingerprint(etype, frames)
    try:
        row = db.get(ErrorEvent, fp)
        if row:
            row.count += 1
            row.last_seen = utcnow()
            if row.status == "resolved":
                row.status = "new"  # regression: reopen
        else:
            db.add(ErrorEvent(fingerprint=fp, error_type=etype, message=scrub_message(str(exc)), frames=frames, route=route, error_code=error_code, app_version=get_settings().version))
        db.commit()
    except Exception:  # noqa: BLE001 - the monitor must never break the request path
        db.rollback()
    log.error("unhandled_error", error_type=etype, fingerprint=fp, route=route, frames=frames)
    return fp


def sentry_before_send(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any] | None:
    req = event.get("request") or {}
    for k in ("data", "cookies", "query_string", "headers"):
        req.pop(k, None)
    event["request"] = req
    event.pop("breadcrumbs", None)
    event.pop("user", None)
    for exc in (event.get("exception") or {}).get("values", []):
        if isinstance(exc.get("value"), str):
            exc["value"] = scrub_message(exc["value"])
        for fr in (exc.get("stacktrace") or {}).get("frames", []):
            fr.pop("vars", None)
    return event


def init_sentry() -> None:
    dsn = get_settings().sentry_dsn
    if not dsn:
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        release=f"evidencetruth@{get_settings().version}",
        environment=get_settings().env,
        send_default_pii=False,
        max_breadcrumbs=0,
        before_send=sentry_before_send,  # type: ignore[arg-type]
        traces_sample_rate=0.0,
    )
