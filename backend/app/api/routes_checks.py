"""Checks: scan, claims, citations, documents, code, calculations, attempts/loops, chat. Routes stay thin."""

from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import schemas as s
from app.auth.deps import Principal, current
from app.billing import plans
from app.checkers import citations, code, consent, documents, verify
from app.core import loops
from app.core.calc import check_calculations
from app.core.redact import redact
from app.db import SessionLocal, get_db
from app.errors import ApiError
from app.security import MAX_UPLOAD, limiter
from app.store import models as m

router = APIRouter(prefix="/v1", tags=["checks"])
SCAN_PROVIDERS = ["wikipedia", "semanticscholar", "arxiv"]


def limit(name: str, per_min: int):
    def dep(p: Principal = Depends(current)) -> Principal:
        limiter.check(f"{name}:u{p.user.user_id}", per_min)
        return p

    return dep


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _bg_scan(scan_id: int) -> None:
    db = SessionLocal()
    try:
        verify.run_scan(db, scan_id)
    except Exception as exc:  # noqa: BLE001 - recorded by the error monitor, scan marked as error
        from app.telemetry.monitor import capture

        capture(db, exc, "/v1/scan (background)", "SCAN_FAILED")
    finally:
        db.close()


def claim_out(c: m.Claim) -> s.ClaimOut:
    v = c.verdict
    ev = [
        s.EvidenceOut(
            evidence_id=e.evidence_id,
            passage=e.passage,
            location=e.location,
            stance=e.stance,  # type: ignore[arg-type]
            score=e.score,
            is_decisive=e.is_decisive,
            source=s.SourceRef(
                url=e.source.url,
                title=e.source.title,
                publisher=e.source.publisher,
                provider=e.source.provider,
                trust_tier=e.source.trust_tier,
                published_at=e.source.published_at,
                updated_at=e.source.updated_at,
                link_ok=(e.source.http_status < 400) if e.source.http_status else None,
            ),
        )
        for e in sorted(c.evidence, key=lambda e: (not e.is_decisive, -e.score))
    ]
    return s.ClaimOut(
        claim_id=c.claim_id,
        parent_id=c.parent_id,
        text=c.text,
        span=(c.span_start, c.span_end),
        claim_type=c.claim_type,  # type: ignore[arg-type]
        status="done" if v else "checking",
        label=v.label if v else None,  # type: ignore[arg-type]
        confidence=v.confidence if v else None,
        abstained=v.abstained if v else False,
        partial_sources=v.partial_sources if v else False,
        evidence=ev if v else [],
        explanation=s.ExplanationOut(text=v.explanation, model=v.explanation_model or "template") if v and v.explanation else None,
        next_steps=list(v.next_steps or []) if v else [],
        verifier=v.verifier_rev if v else None,
        research=research_summary(c.research.record) if v and c.research else None,
    )


def research_summary(r: dict) -> s.ResearchSummary:
    return s.ResearchSummary(
        depth=r.get("depth", "quick"),
        providers=[s.ResearchProvider(name=k, label=x["label"], status=x["status"], detail=x.get("detail")) for k, x in r.get("providers", {}).items()],
        queries=len(r.get("queries", [])),
        documents_read=sum(1 for d in r.get("documents", []) if d.get("group") is not None),
        independent_groups=r.get("independent_groups", 0),
        groups_used=r.get("groups_used", 0),
        stop_reason=r.get("stop_reason", "done"),
    )


def _own_scan(db: Session, scan_id: int, user_id: int) -> m.Scan:
    scan = db.get(m.Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        raise ApiError(404, "NOT_FOUND", "That check doesn't exist.", None)
    return scan


def scan_out(db: Session, scan: m.Scan) -> s.ScanOut:
    return s.ScanOut(
        scan_id=scan.scan_id,
        site=scan.site,
        mode=scan.mode,
        status=scan.status,
        created_at=scan.created_at,
        text=scan.text_redacted,
        claims=[claim_out(c) for c in scan.claims],
        consent_needed=consent.pending(db, scan.user_id, SCAN_PROVIDERS),
    )


@router.post("/scan", response_model=s.ScanOut, status_code=201)
def create_scan(body: s.ScanIn, bg: BackgroundTasks, p: Principal = Depends(limit("scan", 30)), db: Session = Depends(get_db)) -> s.ScanOut:
    plans.consume(db, p.user)
    red = redact(body.text)
    scan = verify.create_scan(db, p.user.user_id, body.site, body.mode, red.text, _sha(body.text), p.user.retention_days)
    if not scan.claims:
        scan.status = "done"
    db.commit()
    if scan.claims:
        bg.add_task(_bg_scan, scan.scan_id)
    return scan_out(db, scan)


@router.get("/scan/{scan_id}", response_model=s.ScanOut)
def get_scan(scan_id: int, p: Principal = Depends(limit("read", 240)), db: Session = Depends(get_db)) -> s.ScanOut:
    return scan_out(db, _own_scan(db, scan_id, p.user.user_id))


@router.post("/scan/{scan_id}/recheck", response_model=s.ScanOut)
def recheck(scan_id: int, bg: BackgroundTasks, p: Principal = Depends(limit("scan", 30)), db: Session = Depends(get_db)) -> s.ScanOut:
    """Re-run verification after the user allowed more sources. Counts as a check."""
    scan = _own_scan(db, scan_id, p.user.user_id)
    plans.consume(db, p.user)
    for c in scan.claims:
        for e in list(c.evidence):
            db.delete(e)
        if c.verdict:
            db.delete(c.verdict)
    scan.status = "checking"
    db.commit()
    db.expire_all()
    bg.add_task(_bg_scan, scan.scan_id)
    return scan_out(db, _own_scan(db, scan_id, p.user.user_id))


@router.get("/scan/{scan_id}/events")
async def scan_events(scan_id: int, request: Request, p: Principal = Depends(current)) -> StreamingResponse:
    """Server-Sent Events: one `claim_result` per finished claim, then `done`."""
    uid = p.user.user_id

    async def gen() -> AsyncIterator[str]:
        sent: set[int] = set()
        for _ in range(600):
            if await request.is_disconnected():
                return
            db = SessionLocal()
            try:
                scan = _own_scan(db, scan_id, uid)
                for c in scan.claims:
                    if c.verdict and c.claim_id not in sent:
                        sent.add(c.claim_id)
                        yield f"event: claim_result\ndata: {claim_out(c).model_dump_json()}\n\n"
                if scan.status != "checking":
                    yield f"event: done\ndata: {json.dumps({'status': scan.status})}\n\n"
                    return
            finally:
                db.close()
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@router.get("/claims/{claim_id}", response_model=s.ClaimOut)
def get_claim(claim_id: int, p: Principal = Depends(limit("read", 240)), db: Session = Depends(get_db)) -> s.ClaimOut:
    c = db.get(m.Claim, claim_id)
    if c is None or c.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "That claim doesn't exist.", None)
    return claim_out(c)


@router.get("/claims/{claim_id}/research", response_model=s.ResearchOut)
def get_claim_research(claim_id: int, p: Principal = Depends(limit("read", 240)), db: Session = Depends(get_db)) -> s.ResearchOut:
    """The full research record: every query, provider status, document examined and why it was or wasn't used."""
    c = db.get(m.Claim, claim_id)
    if c is None or c.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "That claim doesn't exist.", None)
    run = db.get(m.ResearchRun, claim_id)
    if run is None or run.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "This claim has no research record (it was checked only against your documents, or isn't checkable).", None)
    r = run.record
    return s.ResearchOut(
        **research_summary(r).model_dump(),
        query_log=[s.ResearchQuery(**q) for q in r.get("queries", [])],
        documents=[s.ResearchDocument(**d) for d in r.get("documents", [])],
        budget=r.get("budget", {}),
    )


@router.post("/claims/{claim_id}/feedback", status_code=204)
def claim_feedback(claim_id: int, body: s.FeedbackIn, p: Principal = Depends(current), db: Session = Depends(get_db)) -> None:
    c = db.get(m.Claim, claim_id)
    if c is None or c.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "That claim doesn't exist.", None)
    db.add(m.Feedback(user_id=p.user.user_id, target="claim", target_id=claim_id, action=body.action))
    db.commit()


@router.post("/citations/check", response_model=s.CitationsOut)
def check_citations(body: s.CitationsIn, p: Principal = Depends(limit("citations", 20)), db: Session = Depends(get_db)) -> s.CitationsOut:
    plans.consume(db, p.user)
    refs = [redact(r).text[:2000] for r in body.references]
    scan = m.Scan(
        user_id=p.user.user_id,
        site="",
        mode="citation",
        text_redacted="\n".join(refs),
        text_sha256=_sha("\n".join(body.references)),
        status="done",
        expires_at=verify.utcnow() + verify.timedelta(days=p.user.retention_days),
    )
    db.add(scan)
    db.flush()
    allowed = consent.allowed(db, p.user.user_id)
    ctx = {c.reference_index: redact(c.sentence).text for c in body.context}
    results = []
    for i, ref in enumerate(refs):
        r = citations.check_reference(db, ref, ctx.get(i), allowed)
        db.add(
            m.CitationCheck(
                scan_id=scan.scan_id,
                user_id=p.user.user_id,
                raw_reference=ref,
                exists_flag=r.exists,
                link_ok=r.link_ok,
                title_score=r.title_score,
                authors_score=r.authors_score,
                year_match=r.year_match,
                supports_claim=r.supports_claim,
                details={"notes": r.notes, "resolved": r.resolved},
            )
        )
        results.append(s.CitationOut(**citations.as_dict(r)))
    db.commit()
    return s.CitationsOut(scan_id=scan.scan_id, results=results, consent_needed=consent.pending(db, p.user.user_id, ["crossref", "links"]))


@router.post("/documents", response_model=s.DocumentOut, status_code=201)
async def upload_document(file: UploadFile = File(...), title: str | None = Form(default=None), p: Principal = Depends(limit("documents", 10)), db: Session = Depends(get_db)) -> s.DocumentOut:
    plans.assert_document_slot(db, p.user)
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise ApiError(413, "TOO_LARGE", "Documents can be up to 25 MB.", None)
    sha = hashlib.sha256(data).hexdigest()
    existing = db.scalar(select(m.Document).where(m.Document.user_id == p.user.user_id, m.Document.sha256 == sha))
    if existing:
        raise ApiError(409, "DUPLICATE", "You already added this document.", f"It is saved as {existing.filename}.")
    name = (file.filename or "document.txt").replace("\\", "/").rsplit("/", 1)[-1][:255]
    try:
        pages = await asyncio.to_thread(documents.parse_document, name, data)
    except documents.DocumentError as exc:
        raise ApiError(400, "DOC_UNREADABLE", str(exc), None) from exc
    chunks = documents.chunk_pages(pages)
    doc = m.Document(user_id=p.user.user_id, filename=name, sha256=sha, pages=len(pages), title=(title or name)[:255])
    db.add(doc)
    db.flush()
    for page, text in chunks:
        db.add(m.DocChunk(doc_id=doc.doc_id, user_id=p.user.user_id, page=page, text=redact(text).text))
    db.commit()
    return s.DocumentOut(doc_id=doc.doc_id, filename=doc.filename, title=doc.title, pages=doc.pages, chunks=len(chunks), in_kb=doc.in_kb, stale=doc.stale, added_at=doc.added_at)


def _doc_out(db: Session, d: m.Document) -> s.DocumentOut:
    n = len(db.scalars(select(m.DocChunk.chunk_id).where(m.DocChunk.doc_id == d.doc_id)).all())
    return s.DocumentOut(doc_id=d.doc_id, filename=d.filename, title=d.title, pages=d.pages, chunks=n, in_kb=d.in_kb, stale=d.stale, added_at=d.added_at)


@router.get("/documents", response_model=list[s.DocumentOut])
def list_documents(p: Principal = Depends(current), db: Session = Depends(get_db)) -> list[s.DocumentOut]:
    docs = db.scalars(select(m.Document).where(m.Document.user_id == p.user.user_id).order_by(m.Document.added_at.desc())).all()
    return [_doc_out(db, d) for d in docs]


def _own_doc(db: Session, doc_id: int, uid: int) -> m.Document:
    d = db.get(m.Document, doc_id)
    if d is None or d.user_id != uid:
        raise ApiError(404, "NOT_FOUND", "That document doesn't exist.", None)
    return d


@router.patch("/documents/{doc_id}", response_model=s.DocumentOut)
def patch_document(doc_id: int, body: s.DocumentPatch, p: Principal = Depends(current), db: Session = Depends(get_db)) -> s.DocumentOut:
    d = _own_doc(db, doc_id, p.user.user_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit()
    return _doc_out(db, d)


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, p: Principal = Depends(current), db: Session = Depends(get_db)) -> None:
    db.delete(_own_doc(db, doc_id, p.user.user_id))
    db.commit()


@router.post("/documents/{doc_id}/check", response_model=s.DocCheckOut)
def check_document(doc_id: int, body: s.DocCheckIn, p: Principal = Depends(limit("doccheck", 20)), db: Session = Depends(get_db)) -> s.DocCheckOut:
    d = _own_doc(db, doc_id, p.user.user_id)
    plans.consume(db, p.user)
    text = redact(body.text).text
    scan = verify.create_scan(db, p.user.user_id, d.filename, "document", text, _sha(body.text), p.user.retention_days, d.doc_id)
    chunks = [(c.page or 1, c.text) for c in db.scalars(select(m.DocChunk).where(m.DocChunk.doc_id == d.doc_id))]
    rows = []
    for c in scan.claims:
        if c.claim_type not in ("fact", "math_technical"):
            continue
        r = documents.check_statement(c.text, chunks)
        rows.append(s.DocRowOut(statement=r.statement, status=r.status, passage=r.passage, page=r.page))  # type: ignore[arg-type]
    scan.status = "done"
    db.commit()
    return s.DocCheckOut(scan_id=scan.scan_id, rows=rows)


@router.post("/code/check", response_model=s.CodeOut)
def check_code(body: s.CodeIn, p: Principal = Depends(limit("code", 20)), db: Session = Depends(get_db)) -> s.CodeOut:
    plans.consume(db, p.user)
    code_red = redact(body.code).text
    err = redact(body.error_text).text if body.error_text else None
    scan = m.Scan(
        user_id=p.user.user_id,
        site="",
        mode="code",
        text_redacted=code_red[:60_000],
        text_sha256=_sha(body.code),
        status="done",
        expires_at=verify.utcnow() + verify.timedelta(days=p.user.retention_days),
    )
    db.add(scan)
    db.flush()
    allowed = consent.allowed(db, p.user.user_id)
    rep = code.check_code(db, body.language, code_red, err, "registries" in allowed)
    for pkg in rep.packages:
        db.add(m.CodeCheck(scan_id=scan.scan_id, user_id=p.user.user_id, language=rep.language, check_type="package_registry", passed=bool(pkg.get("exists")), evidence=pkg))
    db.add(m.CodeCheck(scan_id=scan.scan_id, user_id=p.user.user_id, language=rep.language, check_type="static", passed=not rep.issues, evidence={"issues": rep.issues}))
    db.commit()
    return s.CodeOut(
        scan_id=scan.scan_id,
        language=rep.language,
        issues=rep.issues,
        packages=rep.packages,
        cause=rep.cause,
        next_steps=rep.next_steps,
        error_signature=rep.error_signature,
        consent_needed=consent.pending(db, p.user.user_id, ["registries"]),
    )


@router.post("/calc/check", response_model=s.CalcOut)
def check_calc(body: s.CalcIn, p: Principal = Depends(limit("calc", 30)), db: Session = Depends(get_db)) -> s.CalcOut:
    plans.consume(db, p.user)
    text = redact(body.text).text
    scan = m.Scan(
        user_id=p.user.user_id, site="", mode="selection", text_redacted=text, text_sha256=_sha(body.text), status="done", expires_at=verify.utcnow() + verify.timedelta(days=p.user.retention_days)
    )
    db.add(scan)
    db.commit()
    return s.CalcOut(scan_id=scan.scan_id, results=[s.CalcRowOut(**r.__dict__) for r in check_calculations(text)])


def _attempts(db: Session, uid: int, key: str) -> list[m.Attempt]:
    return list(db.scalars(select(m.Attempt).where(m.Attempt.user_id == uid, m.Attempt.session_key == key).order_by(m.Attempt.ts, m.Attempt.attempt_id)).all())


def _loop_out(lp: m.LoopEvent) -> s.LoopOut:
    return s.LoopOut(
        loop_id=lp.loop_id, signature=lp.signature, attempts_count=lp.attempts_count, reasons=lp.reasons, suggestions=lp.suggestions, detected_at=lp.detected_at, user_feedback=lp.user_feedback
    )


@router.post("/attempts", response_model=s.AttemptResult)
def add_attempt(body: s.AttemptIn, p: Principal = Depends(limit("attempts", 60)), db: Session = Depends(get_db)) -> s.AttemptResult:
    uid = p.user.user_id
    digest, sh = loops.prompt_fingerprint(redact(body.prompt).text) if body.prompt else (None, [])
    sig = loops.error_signature(redact(body.error_text).text) if body.error_text else None
    prev = _attempts(db, uid, body.session_key)
    outcome = body.outcome
    if outcome == "unknown" and sig and prev and prev[-1].error_signature == sig:
        outcome = "same_error"
    elif outcome == "unknown" and sig and prev and prev[-1].error_signature and prev[-1].error_signature != sig:
        outcome = "new_error"
    db.add(
        m.Attempt(
            user_id=uid,
            session_key=body.session_key,
            prompt_sha256=digest,
            prompt_shingles=sh,
            error_signature=sig,
            change_region=redact(body.change_region).text if body.change_region else None,
            outcome=outcome,
        )
    )
    db.flush()
    rows = _attempts(db, uid, body.session_key)
    res = loops.detect_loop(
        [
            loops.AttemptView(a.ts.isoformat(), a.error_signature, a.prompt_shingles, a.change_region, a.outcome)  # type: ignore[arg-type]
            for a in rows
        ]
    )
    loop_row = None
    if res.detected:
        last = db.scalar(select(m.LoopEvent).where(m.LoopEvent.user_id == uid, m.LoopEvent.session_key == body.session_key).order_by(m.LoopEvent.loop_id.desc()))
        if last and last.signature == res.signature and last.user_feedback == "not_stuck":
            res.detected = False  # the user said they're not stuck; don't nag on the same error
        elif last and last.signature == res.signature and last.user_feedback is None:
            last.attempts_count, last.reasons, last.suggestions = res.attempts_count, res.reasons, res.suggestions
            loop_row = last
        else:
            loop_row = m.LoopEvent(user_id=uid, session_key=body.session_key, signature=res.signature, attempts_count=res.attempts_count, reasons=res.reasons, suggestions=res.suggestions)
            db.add(loop_row)
    db.commit()
    return s.AttemptResult(
        loop_detected=res.detected,
        loop=_loop_out(loop_row) if loop_row and res.detected else None,
        attempts=[s.AttemptOut(attempt_id=a.attempt_id, ts=a.ts, error_signature=a.error_signature, change_region=a.change_region, outcome=a.outcome) for a in rows],
    )


@router.get("/attempts", response_model=s.AttemptResult)
def list_attempts(session_key: str, p: Principal = Depends(current), db: Session = Depends(get_db)) -> s.AttemptResult:
    rows = _attempts(db, p.user.user_id, session_key)
    last = db.scalar(select(m.LoopEvent).where(m.LoopEvent.user_id == p.user.user_id, m.LoopEvent.session_key == session_key).order_by(m.LoopEvent.loop_id.desc()))
    active = last is not None and last.user_feedback is None
    return s.AttemptResult(
        loop_detected=active,
        loop=_loop_out(last) if last else None,
        attempts=[s.AttemptOut(attempt_id=a.attempt_id, ts=a.ts, error_signature=a.error_signature, change_region=a.change_region, outcome=a.outcome) for a in rows],
    )


@router.get("/attempts/sessions", response_model=list[str])
def attempt_sessions(p: Principal = Depends(current), db: Session = Depends(get_db)) -> list[str]:
    rows = db.execute(select(m.Attempt.session_key).where(m.Attempt.user_id == p.user.user_id).group_by(m.Attempt.session_key).order_by(m.Attempt.session_key)).all()
    return [r[0] for r in rows]


@router.post("/loops/{loop_id}/feedback", status_code=204)
def loop_feedback(loop_id: int, body: s.LoopFeedbackIn, p: Principal = Depends(current), db: Session = Depends(get_db)) -> None:
    lp = db.get(m.LoopEvent, loop_id)
    if lp is None or lp.user_id != p.user.user_id:
        raise ApiError(404, "NOT_FOUND", "That loop event doesn't exist.", None)
    lp.user_feedback = body.feedback
    db.commit()


@router.post("/chat", response_model=s.ChatOut)
def chat(body: s.ChatIn, p: Principal = Depends(limit("chat", 30)), db: Session = Depends(get_db)) -> s.ChatOut:
    """Answers questions about stored results using only stored evidence."""
    from app.checkers.chat import answer

    scan = _own_scan(db, body.scan_id, p.user.user_id)
    claims = [c for c in scan.claims if body.claim_id is None or c.claim_id == body.claim_id]
    if body.claim_id is not None and not claims:
        raise ApiError(404, "NOT_FOUND", "That claim isn't part of this check.", None)
    text, ids = answer(body.question, claims)
    return s.ChatOut(answer=text, evidence_ids=ids, based_on="stored_evidence" if ids else "no_evidence")
