"""Stripe Checkout, customer portal and webhooks. Uses StripeClient.v1.* (the current API, checked in the installed SDK)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import ApiError
from app.store.models import AuditLog, User


def enabled() -> bool:
    s = get_settings()
    return bool(s.stripe_secret_key and s.stripe_price_pro)


def client() -> stripe.StripeClient:
    if not enabled():
        raise ApiError(503, "BILLING_OFF", "Payments are not set up yet.", "Try again later.")
    return stripe.StripeClient(get_settings().stripe_secret_key)


def checkout_url(db: Session, user: User) -> str:
    c = client()
    base = get_settings().public_url.rstrip("/")
    if not user.stripe_customer_id:
        cust = c.v1.customers.create(params={"email": user.email, "metadata": {"user_id": str(user.user_id)}})
        user.stripe_customer_id = cust.id
        db.flush()
    session = c.v1.checkout.sessions.create(
        params={
            "mode": "subscription",
            "customer": user.stripe_customer_id,
            "line_items": [{"price": get_settings().stripe_price_pro, "quantity": 1}],
            "success_url": f"{base}/app/billing?checkout=success",
            "cancel_url": f"{base}/app/billing?checkout=cancelled",
            "client_reference_id": str(user.user_id),
            "allow_promotion_codes": True,
        }
    )
    return str(session.url)


def portal_url(user: User) -> str:
    if not user.stripe_customer_id:
        raise ApiError(400, "NO_CUSTOMER", "You don't have a paid plan yet.", None)
    s = client().v1.billing_portal.sessions.create(params={"customer": user.stripe_customer_id, "return_url": f"{get_settings().public_url.rstrip('/')}/app/billing"})
    return str(s.url)


def _apply_subscription(db: Session, sub: dict[str, Any]) -> None:
    user = db.scalar(select(User).where(User.stripe_customer_id == sub.get("customer")))
    if user is None:
        return
    status = sub.get("status")
    user.stripe_subscription_id = sub.get("id")
    user.subscription_status = status
    items = (sub.get("items") or {}).get("data") or []
    end = sub.get("current_period_end") or (items[0].get("current_period_end") if items else None)
    user.current_period_end = datetime.fromtimestamp(end, UTC) if end else None
    user.plan = "pro" if status in ("active", "trialing", "past_due") else "free"
    db.add(AuditLog(user_id=user.user_id, action="subscription_update", detail={"status": status}))


def handle_webhook(db: Session, payload: bytes, sig: str) -> str:
    secret = get_settings().stripe_webhook_secret
    if not secret:
        raise ApiError(503, "BILLING_OFF", "Payments are not set up yet.", None)
    try:
        event = stripe.StripeClient(get_settings().stripe_secret_key or "sk_unused").construct_event(payload, sig, secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise ApiError(400, "BAD_SIGNATURE", "Webhook signature is invalid.", None) from exc
    obj = event.data.object
    data: dict[str, Any] = obj.to_dict() if isinstance(obj, stripe.StripeObject) else dict(obj)  # to_dict() is recursive in stripe 17
    if event.type in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        _apply_subscription(db, data)
    elif event.type == "checkout.session.completed" and data.get("subscription"):
        sub = client().v1.subscriptions.retrieve(str(data["subscription"]))
        _apply_subscription(db, sub.to_dict())
    db.commit()
    return event.type
