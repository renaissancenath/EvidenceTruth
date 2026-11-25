"""ORM models. Every user-owned row carries user_id; queries always filter by it (store/repo.py).

Migrations in store/migrations are the source of truth; docs/DATABASE.md mirrors them.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    from app.core.clock import utcnow

    return utcnow()


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    plan: Mapped[str] = mapped_column(String(16), default="free")  # free | pro
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subscription_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retention_days: Mapped[int] = mapped_column(Integer, default=30)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    session_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    token_sha256: Mapped[str] = mapped_column(String(64), unique=True)
    kind: Mapped[str] = mapped_column(String(16), default="web")  # web | extension
    label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class MagicLink(Base):
    __tablename__ = "magic_links"
    link_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    token_sha256: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PairingCode(Base):
    __tablename__ = "pairing_codes"
    pairing_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    code_sha256: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Usage(Base):
    __tablename__ = "usage"
    __table_args__ = (UniqueConstraint("user_id", "period", name="uq_usage_user_period"),)
    usage_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    period: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    checks: Mapped[int] = mapped_column(Integer, default=0)


class Scan(Base):
    __tablename__ = "scans"
    scan_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    site: Mapped[str] = mapped_column(String(255))
    mode: Mapped[str] = mapped_column(String(16))
    text_redacted: Mapped[str] = mapped_column(Text)
    text_sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="checking")  # checking | done | error
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.doc_id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    claims: Mapped[list[Claim]] = relationship(back_populates="scan", cascade="all, delete-orphan", order_by="Claim.claim_id")


class Claim(Base):
    __tablename__ = "claims"
    claim_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.scan_id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    # set on the atomic parts of a compound claim; the parent's verdict is combined from its parts
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("claims.claim_id", ondelete="CASCADE"), nullable=True, index=True)
    text: Mapped[str] = mapped_column(Text)
    span_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    span_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claim_type: Mapped[str] = mapped_column(String(16))
    scan: Mapped[Scan] = relationship(back_populates="claims")
    verdict: Mapped[Verdict | None] = relationship(back_populates="claim", cascade="all, delete-orphan", uselist=False)
    evidence: Mapped[list[Evidence]] = relationship(back_populates="claim", cascade="all, delete-orphan", order_by="Evidence.evidence_id")
    research: Mapped[ResearchRun | None] = relationship(cascade="all, delete-orphan", uselist=False)


class Source(Base):
    """Public source records (shared, contain no user content)."""

    __tablename__ = "sources"
    source_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(32))
    trust_tier: Mapped[str] = mapped_column(String(16))
    published_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    updated_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Evidence(Base):
    __tablename__ = "evidence"
    evidence_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.claim_id", ondelete="CASCADE"), index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.source_id"))
    passage: Mapped[str] = mapped_column(Text)  # verbatim
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stance: Mapped[str] = mapped_column(String(16))
    score: Mapped[float] = mapped_column(Float)
    is_decisive: Mapped[bool] = mapped_column(Boolean, default=False)
    claim: Mapped[Claim] = relationship(back_populates="evidence")
    source: Mapped[Source] = relationship()


class Verdict(Base):
    __tablename__ = "verdicts"
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.claim_id", ondelete="CASCADE"), primary_key=True)
    label: Mapped[str] = mapped_column(String(32), index=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    abstained: Mapped[bool] = mapped_column(Boolean, default=False)
    partial_sources: Mapped[bool] = mapped_column(Boolean, default=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)  # model/template-written, separate from evidence
    explanation_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    next_steps: Mapped[list[str]] = mapped_column(JSON, default=list)
    verifier_rev: Mapped[str] = mapped_column(String(64))
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    claim: Mapped[Claim] = relationship(back_populates="verdict")


class CitationCheck(Base):
    __tablename__ = "citation_checks"
    check_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.scan_id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    raw_reference: Mapped[str] = mapped_column(Text)
    exists_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    link_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    title_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    authors_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    year_match: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    supports_claim: Mapped[str] = mapped_column(String(16), default="not_checked")
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class CodeCheck(Base):
    __tablename__ = "code_checks"
    check_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.scan_id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(16))
    check_type: Mapped[str] = mapped_column(String(24))
    passed: Mapped[bool] = mapped_column(Boolean)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)


class Document(Base):
    __tablename__ = "documents"
    doc_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64))
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    origin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    in_kb: Mapped[bool] = mapped_column(Boolean, default=True)  # used as evidence in normal scans
    stale: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    __table_args__ = (UniqueConstraint("user_id", "sha256", name="uq_documents_user_sha"),)


class DocChunk(Base):
    __tablename__ = "doc_chunks"
    chunk_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    doc_id: Mapped[int] = mapped_column(ForeignKey("documents.doc_id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text)


class Attempt(Base):
    __tablename__ = "attempts"
    attempt_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    session_key: Mapped[str] = mapped_column(String(80))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    prompt_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_shingles: Mapped[list[str]] = mapped_column(JSON, default=list)  # hashed trigrams, not text
    error_signature: Mapped[str | None] = mapped_column(String(200), nullable=True)
    change_region: Mapped[str | None] = mapped_column(String(200), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16))
    __table_args__ = (Index("ix_attempts_user_session", "user_id", "session_key", "ts"),)


class LoopEvent(Base):
    __tablename__ = "loop_events"
    loop_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    session_key: Mapped[str] = mapped_column(String(80))
    signature: Mapped[str | None] = mapped_column(String(200), nullable=True)
    attempts_count: Mapped[int] = mapped_column(Integer)
    reasons: Mapped[list[str]] = mapped_column(JSON)
    suggestions: Mapped[list[str]] = mapped_column(JSON)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    user_feedback: Mapped[str | None] = mapped_column(String(16), nullable=True)


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_consents_user_provider"),)
    consent_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String(32))
    decision: Mapped[str] = mapped_column(String(8))  # always | never
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Feedback(Base):
    __tablename__ = "feedback"
    feedback_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    target: Mapped[str] = mapped_column(String(16))
    target_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(24))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class HttpCache(Base):
    """Cache of public source responses keyed by URL hash. Holds no user identifiers."""

    __tablename__ = "http_cache"
    url_sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[int] = mapped_column(Integer)
    body: Mapped[str] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class BugReport(Base):
    __tablename__ = "bug_reports"
    report_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="needs-triage")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ErrorEvent(Base):
    """Grouped runtime failures (the built-in error monitor). No request bodies, no page text."""

    __tablename__ = "error_events"
    fingerprint: Mapped[str] = mapped_column(String(64), primary_key=True)
    error_type: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)
    frames: Mapped[list[str]] = mapped_column(JSON)
    route: Mapped[str | None] = mapped_column(String(200), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    app_version: Mapped[str] = mapped_column(String(32))
    count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    status: Mapped[str] = mapped_column(String(16), default="new")  # new | triaged | resolved
    triage_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    audit_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(48))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ResearchRun(Base):
    """The auditable record of how one claim was investigated (providers, queries, documents, groups, budget).

    Query texts derive from the user's (already redacted) claim, so the row is user-owned and deleted with the claim.
    """

    __tablename__ = "research_runs"
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.claim_id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    depth: Mapped[str] = mapped_column(String(8))
    record: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
