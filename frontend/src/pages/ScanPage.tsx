import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ClaimCard, ClaimsList, OriginalText, summarize } from "@shared/ClaimCard";
import type { Scan } from "@shared/types";
import { api } from "../api";
import { ConsentPrompt } from "../components/Consents";
import { ErrorNote, PageHead, useAsync } from "../components/ui";

export function ScanPage() {
  const { id } = useParams();
  const [scan, setScan] = useState<Scan | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const s = await api<Scan>(`/scan/${id}`);
        if (stop) return;
        setScan(s);
        setSelected((cur) => cur ?? s.claims.find((c) => c.label === "contradicted")?.claim_id ?? s.claims[0]?.claim_id ?? null);
        if (s.status === "checking") timer = window.setTimeout(poll, 1000);
      } catch (e) { setError(e); }
    };
    void poll();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [id, round]);

  const recheck = useAsync(async () => { setScan(await api<Scan>(`/scan/${id}/recheck`, { method: "POST" })); setRound((r) => r + 1); });
  const chat = useAsync(async () => {
    const r = await api<{ answer: string }>("/chat", { body: { scan_id: Number(id), claim_id: selected, question } });
    setAnswer(r.answer);
  });
  const claim = useMemo(() => scan?.claims.find((c) => c.claim_id === selected) ?? null, [scan, selected]);
  const feedback = (action: string) => { if (claim) void api(`/claims/${claim.claim_id}/feedback`, { body: { action } }).catch(() => undefined); };

  if (error) return <ErrorNote error={error} />;
  if (!scan) return <p className="muted" role="status">Loading the check</p>;
  return (
    <div className="stack-lg">
      <PageHead title="Results"><Link to="/app">Check another answer</Link></PageHead>
      <p className="muted" aria-live="polite">{summarize(scan.claims)}{scan.site ? ` · from ${scan.site}` : ""}</p>
      {scan.consent_needed.length > 0 && scan.status === "done" && <ConsentPrompt needed={scan.consent_needed} onDone={() => void recheck.run()} />}
      <ErrorNote error={recheck.error} />
      {scan.claims.length > 0 && (
        <section className="stack">
          <h2 className="block-title">Your text, claim by claim</h2>
          <OriginalText text={scan.text} claims={scan.claims} selected={selected} onSelect={setSelected} />
        </section>
      )}
      {scan.claims.length === 0 ? (
        <div className="card"><p>No factual claims were found in this text. Questions, greetings and code are skipped.</p></div>
      ) : (
        <div className="results">
          <ClaimsList claims={scan.claims} selected={selected} onSelect={setSelected} />
          <div className="stack">
            {claim && <ClaimCard claim={claim} onFeedback={feedback} />}
            {claim && claim.status === "done" && (
              <form className="card stack" onSubmit={(e) => { e.preventDefault(); void chat.run(); }}>
                <div className="field">
                  <label htmlFor="q">Ask about this result</label>
                  <input id="q" className="input" value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} />
                  <span className="small muted">For example: why is this flagged, show me the source, what should I do next. Answers use only the stored evidence.</span>
                </div>
                <div className="row"><button className="btn" disabled={chat.busy || !question.trim()} type="submit">Ask</button></div>
                <ErrorNote error={chat.error} />
                {answer && <p className="code-block" style={{ fontFamily: "inherit" }}>{answer}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
