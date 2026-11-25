"""Outgoing mail: magic links and bug reports. Backends: console (dev), SMTP, Resend HTTP API."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

import httpx
import structlog

from app.config import get_settings

log = structlog.get_logger()
OUTBOX: list[dict[str, str]] = []  # console backend keeps messages here (dev and tests only)


class EmailError(Exception):
    pass


def send(to: str, subject: str, text: str, reply_to: str | None = None) -> None:
    s = get_settings()
    if s.email_backend == "console":
        if s.is_prod:
            raise EmailError("console email backend is not allowed in production")
        OUTBOX.append({"to": to, "subject": subject, "text": text})
        del OUTBOX[:-50]
        print(f"\n--- email to {to}: {subject}\n{text}\n---\n", flush=True)  # dev only: shows the magic link
        return
    if s.email_backend == "resend":
        payload: dict[str, object] = {"from": s.email_from, "to": [to], "subject": subject, "text": text}
        if reply_to:
            payload["reply_to"] = reply_to
        r = httpx.post("https://api.resend.com/emails", json=payload, headers={"Authorization": f"Bearer {s.resend_api_key}"}, timeout=10)
        if r.status_code >= 300:
            log.error("email_send_failed", backend="resend", status=r.status_code)
            raise EmailError("could not send email")
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.email_from, to, subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException) as exc:
        log.error("email_send_failed", backend="smtp", error=type(exc).__name__)
        raise EmailError("could not send email") from exc
