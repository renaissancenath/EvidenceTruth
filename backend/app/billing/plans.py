"""Plans and monthly quota. One 'check' = one scan, citation list, document check, code or calculation check."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.clock import utcnow
from app.errors import ApiError
from app.store.models import Document, Usage, User


@dataclass(frozen=True)
class Plan:
    key: str
    name: str
    checks_per_month: int
    documents: int
    max_retention_days: int
    price_label: str


def plans() -> dict[str, Plan]:
    s = get_settings()
    return {
        "free": Plan("free", "Free", s.free_checks_per_month, s.free_documents, 30, "Free"),
        "pro": Plan("pro", "Pro", s.pro_checks_per_month, s.pro_documents, 365, s.pro_price_label),
    }


def plan_of(user: User) -> Plan:
    active = user.plan == "pro" and user.subscription_status in ("active", "trialing", "past_due")
    return plans()["pro" if active else "free"]


def period() -> str:
    return utcnow().strftime("%Y-%m")


def used(db: Session, user_id: int) -> int:
    row = db.scalar(select(Usage).where(Usage.user_id == user_id, Usage.period == period()))
    return row.checks if row else 0


def consume(db: Session, user: User, n: int = 1) -> None:
    """Count n checks, or raise 402 when the month's quota is used up."""
    p = plan_of(user)
    row = db.scalar(select(Usage).where(Usage.user_id == user.user_id, Usage.period == period()).with_for_update())
    if row is None:
        row = Usage(user_id=user.user_id, period=period(), checks=0)
        db.add(row)
    if row.checks + n > p.checks_per_month:
        raise ApiError(
            402, "QUOTA_EXCEEDED", f"You've used all {p.checks_per_month} checks for this month.", "Upgrade to Pro, or wait until next month." if p.key == "free" else "Your quota resets next month."
        )
    row.checks += n
    db.flush()


def assert_document_slot(db: Session, user: User) -> None:
    p = plan_of(user)
    count = len(db.scalars(select(Document.doc_id).where(Document.user_id == user.user_id)).all())
    if count >= p.documents:
        raise ApiError(402, "DOCUMENT_LIMIT", f"Your plan holds {p.documents} documents.", "Delete one, or upgrade to Pro.")
