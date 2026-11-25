/* Claim card (DESIGN_SYSTEM.md §7): status tag → quoted claim → evidence (decisive highlighted)
   → explanation (labelled) → what to check next → one primary action. Page text rendered only as text. */
import { ArrowSquareOutIcon, CopyIcon } from "@phosphor-icons/react";
import { EtIcon } from "./icons";
import { LABEL_WORD, PROVIDER_NAME, STRINGS } from "./strings";
import type { ClaimResult, Evidence, Label } from "./types";

export function Tag({ label, confidence, checking }: { label: Label | null; confidence?: number | null; checking?: boolean }) {
  if (checking || !label) return <span className="tag s-checking"><EtIcon name="insufficient_evidence" size={16} />{STRINGS.checking}</span>;
  return (
    <span className={`tag s-${label}`}>
      <EtIcon name={label} size={16} />{LABEL_WORD[label]}
      {confidence != null && <span className="num">· {confidence.toFixed(2)}</span>}
    </span>
  );
}

function EvidenceBlock({ e }: { e: Evidence }) {
  const s = e.source;
  const publisher = s.publisher || PROVIDER_NAME[s.provider] || s.provider;
  const date = s.published_at || s.updated_at?.slice(0, 10);
  return (
    <div className="evidence">
      <blockquote>{e.is_decisive ? <span className="decisive">{e.passage}</span> : e.passage}</blockquote>
      <p className="small muted">
        {publisher}{date ? ` · ${date}` : ""}{e.location ? ` · ${e.location}` : ""}
        {s.link_ok === true && " · Link works"}{s.link_ok === false && " · Link broken"}
        {e.stance !== "neutral" && ` · ${e.stance === "supports" ? "Supports" : "Contradicts"} the claim`}
      </p>
    </div>
  );
}

export function ClaimCard({ claim, onFeedback, onJump }: {
  claim: ClaimResult; onFeedback?: (action: "wrong_flag" | "opened_source" | "copied_correction") => void; onJump?: () => void;
}) {
  const checking = claim.status === "checking";
  const decisive = claim.evidence.filter((e) => e.is_decisive);
  const ordered = decisive.length ? [...decisive, ...claim.evidence.filter((e) => !e.is_decisive)] : claim.evidence;
  // overlapping sentence windows from the same document would repeat the same words; keep the first
  const shown: Evidence[] = [];
  for (const e of ordered) {
    if (shown.length >= 3) break;
    if (!shown.some((s) => s.passage.includes(e.passage) || e.passage.includes(s.passage))) shown.push(e);
  }
  const primaryUrl = (decisive[0] ?? claim.evidence[0])?.source.url;
  const correction = claim.label === "contradicted" && decisive[0] ? decisive[0].passage : null;
  return (
    <article className="claim-card card" aria-live="polite">
      <div className="row"><Tag label={claim.label} confidence={claim.confidence} checking={checking} />
        {claim.partial_sources && <span className="small muted">{STRINGS.partial}</span>}</div>
      <p className="claim-text">“{claim.text}”</p>
      {onJump && <button className="btn-text btn" onClick={onJump}>Jump to text</button>}
      {!checking && claim.label !== "not_checkable" && (
        <section>
          <h3 className="block-title">{STRINGS.evidence}</h3>
          {shown.length ? shown.map((e) => <EvidenceBlock key={e.evidence_id} e={e} />) : <p className="muted">{STRINGS.noEvidence}</p>}
        </section>
      )}
      {claim.label === "insufficient_evidence" && <p>{STRINGS.insufficient}</p>}
      {claim.label === "unsubstantiated" && <p>{STRINGS.unsubstantiated}</p>}
      {claim.explanation && (
        <section>
          <h3 className="block-title">{claim.explanation.model === "template" ? STRINGS.templateExplanation : STRINGS.aiExplanation}</h3>
          <p className="explanation">{claim.explanation.text}</p>
        </section>
      )}
      {claim.next_steps.length > 0 && (
        <section>
          <h3 className="block-title">{STRINGS.nextSteps}</h3>
          <ol className="steps">{claim.next_steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      )}
      {!checking && (
        <div className="row">
          {primaryUrl && (
            <a className="btn btn-primary" href={primaryUrl} target="_blank" rel="noopener noreferrer" onClick={() => onFeedback?.("opened_source")}>
              Open source <ArrowSquareOutIcon size={16} aria-hidden />
            </a>
          )}
          {correction && (
            <button className="btn" onClick={() => { void navigator.clipboard.writeText(correction); onFeedback?.("copied_correction"); }}>
              <CopyIcon size={16} aria-hidden />Copy what the source says
            </button>
          )}
          <button className="btn btn-text" onClick={() => onFeedback?.("wrong_flag")}>Wrong flag?</button>
        </div>
      )}
      {claim.verifier && <p className="xs muted">Checked by <span className="mono">{claim.verifier}</span></p>}
    </article>
  );
}

export function ClaimsList({ claims, selected, onSelect }: { claims: ClaimResult[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <ul className="claims" role="listbox" aria-label="Claims"
      onKeyDown={(e) => {
        const i = claims.findIndex((c) => c.claim_id === selected);
        if (e.key === "ArrowDown" && i < claims.length - 1) { e.preventDefault(); onSelect(claims[i + 1].claim_id); }
        if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); onSelect(claims[i - 1].claim_id); }
      }}>
      {claims.map((c) => (
        <li key={c.claim_id}>
          <button role="option" aria-selected={c.claim_id === selected} className={`claim-row${c.parent_id ? " is-part" : ""}`} onClick={() => onSelect(c.claim_id)}
            id={`claim-${c.claim_id}`}>
            <span className={`s-${c.label ?? "checking"}`}><EtIcon name={c.label ?? "insufficient_evidence"} size={20} /></span>
            <span>
              <span className={`label-word s-${c.label ?? "checking"}`}>{c.label ? LABEL_WORD[c.label] : STRINGS.checking}</span>
              <span style={{ display: "block" }}>{c.text}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const ORDER: Label[] = ["supported", "contradicted", "partially_supported", "misleading", "outdated", "unsubstantiated", "insufficient_evidence", "not_checkable"];

/* "10 of 10 claims checked: 4 supported, 2 contradicted, ..." Counts whole claims (not their parts) and never
   collapses a mixed result into one verdict. */
export function summarize(claims: ClaimResult[]): string {
  const top = claims.filter((c) => !c.parent_id);
  const done = top.filter((c) => c.status === "done");
  const head = `${done.length} of ${top.length} claims checked`;
  if (!done.length) return head;
  const counts = ORDER.map((l) => [l, done.filter((c) => c.label === l).length] as const).filter(([, n]) => n > 0);
  return `${head}: ${counts.map(([l, n]) => `${n} ${LABEL_WORD[l].toLowerCase()}`).join(", ")}`;
}

/* The submitted text with every claim underlined in its verdict colour. Text is rendered as text, never as HTML. */
export function OriginalText({ text, claims, selected, onSelect }: { text: string; claims: ClaimResult[]; selected: number | null; onSelect: (id: number) => void }) {
  const spans = claims
    .filter((c) => !c.parent_id && c.span[0] != null && c.span[1] != null)
    .sort((a, b) => (a.span[0] ?? 0) - (b.span[0] ?? 0));
  const out: (string | ClaimResult)[] = [];
  let pos = 0;
  for (const c of spans) {
    const [a, b] = [c.span[0] as number, c.span[1] as number];
    if (a < pos) continue;
    if (a > pos) out.push(text.slice(pos, a));
    out.push(c);
    pos = b;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return (
    <p className="original">
      {out.map((seg, i) => typeof seg === "string" ? <span key={i}>{seg}</span> : (
        <span key={i} role="button" tabIndex={0} className={`u-claim u-${seg.label ?? "checking"}${seg.claim_id === selected ? " is-selected" : ""}`}
          title={seg.label ? LABEL_WORD[seg.label] : STRINGS.checking} onClick={() => onSelect(seg.claim_id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(seg.claim_id); } }}>
          {text.slice(seg.span[0] as number, seg.span[1] as number)}
        </span>
      ))}
    </p>
  );
}
