import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DownloadIcon } from "@phosphor-icons/react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ConsentList } from "../components/Consents";
import { ErrorNote, PageHead, useAsync } from "../components/ui";

interface Sess { session_id: number; kind: string; label: string | null; created_at: string; last_used_at: string; current: boolean }

export function Settings() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(user?.display_name ?? "");
  const [retention, setRetention] = useState(user?.retention_days ?? 30);
  const [code, setCode] = useState<{ code: string; expires_in_s: number } | null>(null);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [confirm, setConfirm] = useState("");
  const loadSessions = async () => setSessions(await api<Sess[]>("/me/sessions"));
  useEffect(() => { void loadSessions(); }, []);
  const save = useAsync(async () => { await api("/me", { method: "PATCH", body: { display_name: name, retention_days: retention } }); await refresh(); });
  const pair = useAsync(async () => setCode(await api("/extension/pair-code", { method: "POST" })));
  const revoke = useAsync(async (id: number) => { await api(`/me/sessions/${id}`, { method: "DELETE" }); await loadSessions(); });
  const delAcc = useAsync(async () => { await api("/me", { method: "DELETE", body: { confirm: "DELETE" } }); await refresh(); nav("/"); });
  if (!user) return null;
  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <PageHead title="Settings" />
      <section className="stack">
        <h2>Sources</h2>
        <p className="small muted">Where evidence may come from. Off means nothing is ever sent there.</p>
        <ConsentList />
      </section>
      <hr className="rule" />
      <section className="stack">
        <h2>Browser extension</h2>
        <p>Install the EvidenceTruth extension, open it, choose Connect, and type this code. The code works once, for 2 minutes.</p>
        {code ? <p className="big-code" aria-live="polite">{code.code}</p> : null}
        <ErrorNote error={pair.error} />
        <div className="row"><button className="btn" onClick={() => void pair.run()}>{code ? "Make a new code" : "Make a connection code"}</button></div>
      </section>
      <hr className="rule" />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save.run(); }}>
        <h2>Account</h2>
        <div className="field"><label htmlFor="em">Email</label><input id="em" className="input" value={user.email} readOnly /></div>
        <div className="field"><label htmlFor="nm">Name (optional)</label><input id="nm" className="input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="rt">Delete checks after (days)</label>
          <input id="rt" className="input" type="number" min={1} max={user.plan === "pro" ? 365 : 30} style={{ maxWidth: 160 }} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
          <span className="small muted">Free plan: up to 30 days. Pro: up to 365. Applies to new checks.</span></div>
        <ErrorNote error={save.error} />
        <div className="row"><button className="btn btn-primary" disabled={save.busy}>Save</button>{save.busy ? null : null}</div>
      </form>
      <hr className="rule" />
      <section className="stack">
        <h2>Signed-in devices</h2>
        <div className="table-wrap"><table>
          <thead><tr><th scope="col">Device</th><th scope="col">Last used</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>{sessions.map((s) => (
            <tr key={s.session_id}><td>{s.kind === "extension" ? (s.label ?? "Browser extension") : "Web browser"}{s.current ? " (this one)" : ""}</td>
              <td className="num small">{new Date(s.last_used_at).toLocaleString()}</td>
              <td>{!s.current && <button className="btn" onClick={() => void revoke.run(s.session_id)}>Sign out</button>}</td></tr>))}
          </tbody></table></div>
        <ErrorNote error={revoke.error} />
      </section>
      <hr className="rule" />
      <section className="stack">
        <h2>Your data</h2>
        <p><a className="btn" href="/v1/me/export"><DownloadIcon size={16} aria-hidden />Download all my data</a></p>
        <div className="stack" style={{ maxWidth: 480 }}>
          <h3>Delete account</h3>
          <p className="small muted">Deletes your account, every check, document and attempt, and cancels a paid plan. This can't be undone.</p>
          <div className="field"><label htmlFor="del">Type DELETE to confirm</label><input id="del" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <ErrorNote error={delAcc.error} />
          <div className="row"><button className="btn btn-danger" disabled={confirm !== "DELETE" || delAcc.busy} onClick={() => void delAcc.run()}>Delete my account</button></div>
        </div>
      </section>
    </div>
  );
}
