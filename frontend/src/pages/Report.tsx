import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, useAsync } from "../components/ui";

interface Preview { payload: Record<string, unknown>; github_issue_url: string | null; mailto_url: string | null }

export function Report() {
  const { user } = useAuth();
  const [f, setF] = useState({ steps: "", expected: "", error_code: "", contact_ok: false });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const body = () => ({ steps: f.steps, expected: f.expected, error_code: f.error_code || null, contact_ok: f.contact_ok, surface: "web",
    app_version: __APP_VERSION__, browser: navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? null });
  const prev = useAsync(async () => setPreview(await api<Preview>("/reports/preview", { body: body() })));
  const send = useAsync(async () => setSent((await api<{ report_id: number }>("/reports", { body: body() })).report_id));
  return (
    <div className={user ? "stack-lg" : "page stack-lg"} style={{ maxWidth: 720 }}>
      <h1>Report a problem</h1>
      <p className="muted">Don't paste private page text or documents. You'll see exactly what is sent before you send it.</p>
      {sent ? <p className="note" role="status">Sent as report {sent}. Thank you. We read every report.</p> : (
        <>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void prev.run(); }}>
            <div className="field"><label htmlFor="st">What you did</label>
              <textarea id="st" className="textarea" rows={5} required minLength={3} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} /></div>
            <div className="field"><label htmlFor="ex">What you expected, and what happened</label>
              <textarea id="ex" className="textarea" rows={3} value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></div>
            <div className="field"><label htmlFor="cd">Error code, if one was shown</label>
              <input id="cd" className="input" style={{ maxWidth: 240 }} maxLength={40} value={f.error_code} onChange={(e) => setF({ ...f, error_code: e.target.value })} /></div>
            {user && <label className="toggle"><input type="checkbox" checked={f.contact_ok} onChange={(e) => setF({ ...f, contact_ok: e.target.checked })} />You may reply to {user.email}</label>}
            <ErrorNote error={prev.error} />
            <div className="row"><button className="btn" disabled={!f.steps.trim()}>Preview what will be sent</button></div>
          </form>
          {preview && (
            <section className="stack">
              <h2>This is what will be sent</h2>
              <pre className="code-block">{JSON.stringify(preview.payload, null, 2)}</pre>
              <ErrorNote error={send.error} />
              <div className="row">
                <button className="btn btn-primary" disabled={send.busy} onClick={() => void send.run()}>Send report</button>
                {preview.github_issue_url && <a href={preview.github_issue_url} target="_blank" rel="noopener noreferrer">Open a GitHub issue instead</a>}
                {preview.mailto_url && <a href={preview.mailto_url}>Email it instead</a>}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
