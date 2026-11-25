import { useEffect, useMemo, useState } from "react";
import { ClaimCard, ClaimsList, summarize } from "@shared/ClaimCard";
import { EtIcon } from "@shared/icons";
import type { Scan } from "@shared/types";
import { send, type State } from "../shared/messages";

export function Panel() {
  const [s, setS] = useState<State | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string | null } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let current: number | null = null;
    const poll = async () => {
      const st = await send<State>({ type: "get-state" });
      if (st.ok) setS(st.data);
      const id = st.ok ? st.data.lastScanId : null;
      if (id && id !== current) { current = id; setSelected(null); }
      if (id) {
        const r = await send<Scan>({ type: "get-scan", scanId: id });
        if (r.ok) {
          setScan(r.data);
          setSelected((cur) => cur ?? r.data.claims.find((c) => c.label === "contradicted")?.claim_id ?? r.data.claims[0]?.claim_id ?? null);
          setError(null);
        } else setError(r);
      }
      timer = window.setTimeout(poll, 1500);
    };
    void poll();
    const onMsg = (m: unknown) => { const x = m as { type?: string; message?: string; hint?: string }; if (x?.type === "scan-error") setError({ message: x.message ?? "", hint: x.hint }); };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => { window.clearTimeout(timer); chrome.runtime.onMessage.removeListener(onMsg); };
  }, []);

  const claim = useMemo(() => scan?.claims.find((c) => c.claim_id === selected) ?? null, [scan, selected]);
  if (!s) return <div className="panel" role="status">Loading</div>;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="brand"><EtIcon name="logo" />EvidenceTruth</span><span className="spacer" />
        <span className="state">{s.run === "on" ? "Ready" : s.run === "paused" ? "Paused" : "Off"}</span>
      </div>
      {error && <div className="toast" role="alert"><p>{error.message}</p>{error.hint && <p className="small muted">{error.hint}</p>}
        <button className="btn btn-text" onClick={() => setError(null)}>Dismiss</button></div>}
      {!s.connected ? <p>Open the EvidenceTruth button in the toolbar and connect your account.</p>
        : !scan ? <div className="card stack"><p>Results for the answer you scan will appear here.</p><p className="small muted">Select text and right-click, or use Scan answer in the toolbar button.</p></div>
        : (
          <>
            <p className="muted small" aria-live="polite">{summarize(scan.claims)}{scan.site ? ` · ${scan.site}` : ""}</p>
            {scan.consent_needed.length > 0 && scan.status === "done" && (
              <p className="note small">Only your documents were searched. <a href={`${s.apiBase}/app/scan/${scan.scan_id}`} target="_blank" rel="noreferrer">Allow public sources and check again</a></p>
            )}
            {scan.claims.length === 0 ? <p>No factual claims were found in this text.</p> : (
              <>
                <ClaimsList claims={scan.claims} selected={selected} onSelect={setSelected} />
                {claim && <ClaimCard claim={claim} onFeedback={(action) => void send({ type: "feedback", claimId: claim.claim_id, action })} />}
              </>
            )}
            <p className="small"><a href={`${s.apiBase}/app/history`} target="_blank" rel="noreferrer">History and dashboard</a> · <a href={`${s.apiBase}/app/report`} target="_blank" rel="noreferrer">Report a problem</a></p>
          </>
        )}
    </div>
  );
}
