"""Pydantic models for every request and response. The generated OpenAPI spec is the contract."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Label = Literal["supported", "contradicted", "partially_supported", "misleading", "outdated", "unsubstantiated", "insufficient_evidence", "not_checkable"]
ClaimType = Literal["fact", "opinion", "prediction", "hypothesis", "subjective", "math_technical"]
Mode = Literal["answer", "conversation", "selection", "citation", "code", "document", "tracked", "paste"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorOut(BaseModel):
    code: str
    message: str
    hint: str | None = None


# auth
class MagicLinkIn(Strict):
    email: EmailStr


class VerifyIn(Strict):
    token: str = Field(min_length=20, max_length=200)


class AuthConfigOut(BaseModel):
    google: bool
    billing: bool
    pro_price_label: str
    free_checks_per_month: int
    pro_checks_per_month: int
    free_documents: int
    pro_documents: int


class UserOut(BaseModel):
    user_id: int
    email: str
    display_name: str | None
    plan: Literal["free", "pro"]
    subscription_status: str | None
    current_period_end: datetime | None
    retention_days: int
    onboarded: bool
    checks_used: int
    checks_limit: int
    documents_limit: int
    is_admin: bool


class MePatch(Strict):
    display_name: str | None = Field(default=None, max_length=120)
    retention_days: int | None = Field(default=None, ge=1, le=365)
    onboarded: bool | None = None


class ConfirmIn(Strict):
    confirm: Literal["DELETE"]


class SessionOut(BaseModel):
    session_id: int
    kind: str
    label: str | None
    created_at: datetime
    last_used_at: datetime
    current: bool


class PairCodeOut(BaseModel):
    code: str
    expires_in_s: int


class PairIn(Strict):
    code: str = Field(pattern=r"^\d{6}$")
    label: str | None = Field(default=None, max_length=80)


class PairOut(BaseModel):
    token: str
    email: str


# scans
class ScanIn(Strict):
    site: str = Field(default="", max_length=255)
    mode: Mode = "paste"
    text: str = Field(min_length=1, max_length=60_000)


class SourceRef(BaseModel):
    url: str | None
    title: str | None
    publisher: str | None
    provider: str
    trust_tier: str
    published_at: str | None
    updated_at: str | None
    link_ok: bool | None


class EvidenceOut(BaseModel):
    evidence_id: int
    passage: str
    location: str | None
    stance: Literal["supports", "contradicts", "neutral"]
    score: float
    is_decisive: bool
    source: SourceRef


class ExplanationOut(BaseModel):
    text: str
    model: str


class ResearchProvider(BaseModel):
    name: str
    label: str
    status: Literal["searched", "failed", "unavailable", "not_allowed"]
    detail: str | None = None


class ResearchSummary(BaseModel):
    """How the claim was investigated. Never a claim of complete coverage."""

    depth: Literal["quick", "deep"]
    providers: list[ResearchProvider]
    queries: int
    documents_read: int
    independent_groups: int
    groups_used: int
    stop_reason: str


class ResearchQuery(BaseModel):
    text: str
    direction: str
    provider: str
    status: str
    hits: int


class ResearchDocument(BaseModel):
    url: str
    title: str | None
    provider: str
    tier: str | None
    group: int | None
    used: bool
    note: str | None


class ResearchOut(ResearchSummary):
    query_log: list[ResearchQuery]
    documents: list[ResearchDocument]
    budget: dict[str, object]


class ClaimOut(BaseModel):
    claim_id: int
    parent_id: int | None = None  # set on the atomic parts of a compound claim
    text: str
    span: tuple[int | None, int | None]
    claim_type: ClaimType
    status: Literal["checking", "done"]
    label: Label | None
    confidence: float | None
    abstained: bool
    partial_sources: bool
    evidence: list[EvidenceOut]
    explanation: ExplanationOut | None
    next_steps: list[str]
    verifier: str | None
    research: ResearchSummary | None = None  # absent for claims checked only against your documents


class ScanOut(BaseModel):
    scan_id: int
    site: str
    mode: str
    status: str
    created_at: datetime
    text: str
    claims: list[ClaimOut]
    consent_needed: list[str]


class FeedbackIn(Strict):
    action: Literal["wrong_flag", "helpful", "opened_source", "copied_correction"]


# citations
class CitationContext(Strict):
    reference_index: int = Field(ge=0)
    sentence: str = Field(max_length=2000)


class CitationsIn(Strict):
    references: list[str] = Field(min_length=1, max_length=50)
    context: list[CitationContext] = Field(default_factory=list)


class CitationOut(BaseModel):
    reference: str
    exists: bool | None
    link_ok: bool | None
    title_score: float | None
    authors_score: float | None
    year_match: bool | None
    supports_claim: str
    resolved: dict | None
    notes: list[str]


class CitationsOut(BaseModel):
    scan_id: int
    results: list[CitationOut]
    consent_needed: list[str]


# documents
class DocumentOut(BaseModel):
    doc_id: int
    filename: str
    title: str | None
    pages: int | None
    chunks: int
    in_kb: bool
    stale: bool
    added_at: datetime


class DocumentPatch(Strict):
    title: str | None = Field(default=None, max_length=255)
    origin_url: str | None = Field(default=None, max_length=2000)
    version: str | None = Field(default=None, max_length=64)
    in_kb: bool | None = None
    stale: bool | None = None


class DocCheckIn(Strict):
    text: str = Field(min_length=1, max_length=60_000)


class DocRowOut(BaseModel):
    statement: str
    status: Literal["in_document", "contradicts", "not_in_document", "number_mismatch"]
    passage: str | None
    page: int | None


class DocCheckOut(BaseModel):
    scan_id: int
    rows: list[DocRowOut]


# code / calc
class CodeIn(Strict):
    language: Literal["python", "javascript", "typescript"]
    code: str = Field(min_length=1, max_length=100_000)
    error_text: str | None = Field(default=None, max_length=20_000)


class CodeOut(BaseModel):
    scan_id: int
    language: str
    issues: list[dict]
    packages: list[dict]
    cause: str | None
    next_steps: list[str]
    error_signature: str | None
    consent_needed: list[str]


class CalcIn(Strict):
    text: str = Field(min_length=1, max_length=60_000)


class CalcRowOut(BaseModel):
    expression: str
    stated: float
    recomputed: float
    ok: bool
    kind: str


class CalcOut(BaseModel):
    scan_id: int
    results: list[CalcRowOut]


# attempts / loops
class AttemptIn(Strict):
    session_key: str = Field(min_length=1, max_length=80)
    prompt: str | None = Field(default=None, max_length=20_000)
    error_text: str | None = Field(default=None, max_length=20_000)
    change_region: str | None = Field(default=None, max_length=200)
    outcome: Literal["same_error", "new_error", "pass", "unknown"] = "unknown"


class AttemptOut(BaseModel):
    attempt_id: int
    ts: datetime
    error_signature: str | None
    change_region: str | None
    outcome: str


class LoopOut(BaseModel):
    loop_id: int
    signature: str | None
    attempts_count: int
    reasons: list[str]
    suggestions: list[str]
    detected_at: datetime
    user_feedback: str | None


class AttemptResult(BaseModel):
    loop_detected: bool
    loop: LoopOut | None
    attempts: list[AttemptOut]


class LoopFeedbackIn(Strict):
    feedback: Literal["helpful", "not_stuck", "ignored"]


# history / dashboard
class HistoryItem(BaseModel):
    scan_id: int
    site: str
    mode: str
    status: str
    created_at: datetime
    preview: str
    counts: dict[str, int]


class HistoryOut(BaseModel):
    items: list[HistoryItem]
    page: int
    total: int


class DashboardOut(BaseModel):
    by_label: dict[str, int]
    by_day: list[dict]
    citation_issues: int
    loop_events: int
    sources: dict[str, int]
    claims_total: int
    recent_issues: list[dict]


# consents
class ConsentOut(BaseModel):
    provider: str
    name: str
    decision: Literal["always", "never", "unset"]


class ConsentIn(Strict):
    provider: str = Field(max_length=32)
    decision: Literal["always", "never"]


# billing
class BillingOut(BaseModel):
    plan: str
    status: str | None
    current_period_end: datetime | None
    checks_used: int
    checks_limit: int
    billing_enabled: bool
    price_label: str


class UrlOut(BaseModel):
    url: str


# reports
class ReportIn(Strict):
    steps: str = Field(min_length=3, max_length=4000)
    expected: str = Field(default="", max_length=4000)
    error_code: str | None = Field(default=None, max_length=40)
    surface: Literal["web", "extension"] = "web"
    app_version: str | None = Field(default=None, max_length=32)
    browser: str | None = Field(default=None, max_length=80)
    contact_ok: bool = False


class ReportPreviewOut(BaseModel):
    payload: dict
    github_issue_url: str | None
    mailto_url: str | None


class ClientErrorIn(Strict):
    error_type: str = Field(max_length=120)
    message: str = Field(max_length=500)
    frames: list[str] = Field(default_factory=list, max_length=20)
    surface: Literal["web", "extension"]
    app_version: str = Field(max_length=32)
    route: str | None = Field(default=None, max_length=200)


# chat
class ChatIn(Strict):
    scan_id: int
    claim_id: int | None = None
    question: str = Field(min_length=1, max_length=1000)


class ChatOut(BaseModel):
    answer: str
    evidence_ids: list[int]
    based_on: Literal["stored_evidence", "no_evidence"]


class DesktopRelease(BaseModel):
    latest_version: str | None
    min_version: str
    download_url: str | None
    update_feed_url: str | None = None
    web_url: str | None = None  # where the website is (report links); may differ from the API address in development
