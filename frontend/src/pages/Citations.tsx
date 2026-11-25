import { useState } from "react";
import { EtIcon } from "@shared/icons";
import { api } from "../api";
import { ConsentPrompt } from "../components/Consents";
import { ErrorNote, PageHead, useAsync } from "../components/ui";

interface Result { reference: string; exists: boolean | null; link_ok: boolean | null; title_score: number | null; authors_score: number | null;
  year_match: boolean | null; supports_claim: string; resolved: { title?: string; authors?: string[]; year?: number; url?: string; doi?: string } | null; notes: string[] }

function Check({ ok, yes, no }: { ok: boolean | null; yes: string; no: string }) {
  if (ok === null) return <span className="s-unverifiable row"><EtIcon name="not_checkable" size={16} />Not checked</span>;
  return ok ? <span className="s-supported row"><EtIcon name="supported" size={16} />{yes}</span>
    : <span className="s-contradicted row"><EtIcon name="contradicted" size={16} />{no}</span>;
}

export function Citations() {
  const [refs, setRefs] = useState("");
  const [sentence, setSentence] = useState("");
  const [out, setOut] = useState<{ results: Result[]; consent_needed: string[] } | null>(null);
  const { busy, error, run } = useAsync(async () => {
    const references = refs.split(/\n\s*\n|\n(?=\[\d+\]|\d+\.\s)/).map((r) => r.trim()).filter(Boolean).slice(0, 50);
    setOut(await api("/citations/check", { body: { references, context: sentence.trim() ? [{ reference_index: 0, sentence }] : [] } }));
  });
  return (
    <div className="stack-lg" style={{ maxWidth: 980 }}>
      <PageHead title="Check citations" />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <div className="field">
          <label htmlFor="refs">References</label>
          <textarea id="refs" className="textarea" rows={8} required value={refs} onChange={(e) => setRefs(e.target.value)} />
          <span className="small muted">One reference per line, or separated by a blank line. A DOI makes the check exact.</span>
        </div>
        <div className="field">
          <label htmlFor="sent">Sentence the first reference is cited for (optional)</label>
          <input id="sent" className="input" value={sentence} onChange={(e) => setSentence(e.target.value)} />
        </div>
        <ErrorNote error={error} />
        <div className="row"><button className="btn btn-primary" disabled={busy || !refs.trim()}>{busy ? "Checking" : "Check references"}</button></div>
      </form>
      {out && <ConsentPrompt needed={out.consent_needed} onDone={() => void run()} />}
      {out && (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Reference</th><th scope="col">Exists</th><th scope="col">Link</th><th scope="col">Metadata</th><th scope="col">Supports claim</th></tr></thead>
            <tbody>
              {out.results.map((r, i) => {
                const meta = r.resolved ? (r.title_score ?? 1) >= 0.85 && (r.authors_score ?? 1) >= 0.5 && r.year_match !== false : null;
                return (
                  <tr key={i}>
                    <td>
                      <p>{r.reference}</p>
                      {r.resolved && <p className="small muted">Record: {r.resolved.title} ({r.resolved.year ?? "no year"}){r.resolved.doi ? ` · doi ${r.resolved.doi}` : ""}</p>}
                      {r.notes.map((n) => <p key={n} className="small muted">{n}</p>)}
                    </td>
                    <td><Check ok={r.exists} yes="Found" no="Not found" /></td>
                    <td><Check ok={r.link_ok} yes="Link works" no="Link broken" /></td>
                    <td><Check ok={meta} yes="Matches" no="Differs" /></td>
                    <td><Check ok={r.supports_claim === "not_checked" ? null : r.supports_claim === "supports"} yes="Supports" no={r.supports_claim === "contradicts" ? "Contradicts" : "Not found"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
