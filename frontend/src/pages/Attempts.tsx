import { useEffect, useState } from "react";
import { EtIcon } from "@shared/icons";
import { api } from "../api";
import { Empty, ErrorNote, PageHead, useAsync } from "../components/ui";

interface Attempt { attempt_id: number; ts: string; error_signature: string | null; change_region: string | null; outcome: string }
interface Loop { loop_id: number; reasons: string[]; suggestions: string[]; attempts_count: number; user_feedback: string | null; signature: string | null }
interface Res { loop_detected: boolean; loop: Loop | null; attempts: Attempt[] }
const OUTCOME: Record<string, string> = { same_error: "Same error", new_error: "New error", pass: "Worked", unknown: "Not known" };

export function Attempts() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [key, setKey] = useState("my-project");
  const [res, setRes] = useState<Res | null>(null);
  const [form, setForm] = useState({ error_text: "", change_region: "", prompt: "", outcome: "unknown" });
  const load = async (k = key) => { setRes(await api<Res>(`/attempts?session_key=${encodeURIComponent(k)}`)); setSessions(await api<string[]>("/attempts/sessions")); };
  useEffect(() => { void load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const add = useAsync(async () => {
    setRes(await api<Res>("/attempts", { body: { session_key: key, error_text: form.error_text || null, change_region: form.change_region || null,
      prompt: form.prompt || null, outcome: form.outcome } }));
    setForm({ ...form, error_text: "", prompt: "" });
    setSessions(await api<string[]>("/attempts/sessions"));
  });
  const fb = useAsync(async (feedback: "helpful" | "not_stuck") => { await api(`/loops/${res!.loop!.loop_id}/feedback`, { body: { feedback } }); await load(); });
  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <PageHead title="Attempts" />
      <p className="muted">Log each try at fixing a problem. If the same error keeps coming back, you'll see why it looks stuck and what to try instead. Prompts are stored only as hashes.</p>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="key">Problem name</label>
        <input id="key" className="input" list="sessions" value={key} maxLength={80} onChange={(e) => setKey(e.target.value)} onBlur={() => void load()} />
        <datalist id="sessions">{sessions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {res?.loop_detected && res.loop && (
        <section className="card stack" aria-live="polite">
          <h2 className="row"><EtIcon name="loop" />This looks stuck</h2>
          <h3 className="block-title">Why this looks stuck</h3>
          <ul className="steps">{res.loop.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <h3 className="block-title">Try next</h3>
          <ol className="steps">{res.loop.suggestions.map((s) => <li key={s}>{s}</li>)}</ol>
          <ErrorNote error={fb.error} />
          <div className="row"><button className="btn btn-primary" onClick={() => void fb.run("helpful")}>I'll try this</button>
            <button className="btn btn-text" onClick={() => void fb.run("not_stuck")}>I'm not stuck</button></div>
        </section>
      )}
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void add.run(); }}>
        <h2>Log an attempt</h2>
        <div className="field"><label htmlFor="e">Error you got</label>
          <textarea id="e" className="textarea code" rows={4} value={form.error_text} onChange={(e) => setForm({ ...form, error_text: e.target.value })} /></div>
        <div className="field"><label htmlFor="c">What you changed (file or function)</label>
          <input id="c" className="input" value={form.change_region} onChange={(e) => setForm({ ...form, change_region: e.target.value })} /></div>
        <div className="field"><label htmlFor="p">Prompt you gave the AI (optional, stored as a hash)</label>
          <input id="p" className="input" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></div>
        <div className="field"><label htmlFor="o">Did it work?</label>
          <select id="o" className="select" style={{ maxWidth: 240 }} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
            <option value="unknown">Work it out from the error</option><option value="same_error">Same error</option><option value="new_error">Different error</option><option value="pass">It worked</option>
          </select></div>
        <ErrorNote error={add.error} />
        <div className="row"><button className="btn" disabled={add.busy || (!form.error_text && form.outcome !== "pass")}>Log attempt</button></div>
      </form>
      <section className="stack">
        <h2>Timeline</h2>
        {!res || res.attempts.length === 0 ? <Empty text="Attempts you log for this problem will appear here." /> : (
          <ol className="timeline">{res.attempts.map((a) => (
            <li key={a.attempt_id}><span className="mono small">{new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span><span className="mono">{a.error_signature ?? "No error"}</span><br />
                <span className="small muted">{a.change_region ? `Changed ${a.change_region} · ` : ""}{OUTCOME[a.outcome]}</span></span></li>))}
          </ol>)}
      </section>
    </div>
  );
}
