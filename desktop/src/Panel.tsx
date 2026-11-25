import { useEffect, useMemo, useState } from "react";
import { ClaimCard, ClaimsList, summarize } from "@shared/ClaimCard";
import { EtIcon } from "@shared/icons";
import type { Scan } from "@shared/types";
import { et, STATUS_TEXT, type DesktopState, type Reply } from "./bridge";

type Err = { message: string; hint?: string | null } | null;

export function Panel() {
  const [s, setS] = useState<DesktopState | null>(null);
  const [scanId, setScanId] = useState<number | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [err, setErr] = useState<Err>(null);
  const [code, setCode] = useState("");
  const [server, setServer] = useState("");
  const [editServer, setEditServer] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void et().getState().then((st) => { setS(st); setServer(st.apiBase ?? "https://"); setScanId(st.lastScanId); });
    et().onState(setS);
    et().onScanStarted((id, e) => {
      if (id) { setScanId(id); setScan(null); setSelected(null); setErr(null); }
      if (e && !e.ok) setErr(e);
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") void et().hidePanel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!scanId || !s?.connected) return;
    let stop = false;
    let timer: number | undefined;
    let tries = 0;
    const poll = async () => {
      const r = await et().getScan(scanId);
      if (stop) return;
      if (r.ok) {
        setScan(r.data);
        setSelected((cur) => cur ?? r.data.claims.find((c) => c.label === "contradicted")?.claim_id ?? r.data.claims[0]?.claim_id ?? null);
        if (r.data.status === "checking" && tries++ < 300) timer = window.setTimeout(poll, 1000);
      } else if (r.code === "NOT_FOUND") { setScanId(null); }
      else setErr(r);
    };
    void poll();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [scanId, s?.connected]);

  const claim = useMemo(() => scan?.claims.find((c) => c.claim_id === selected) ?? null, [scan, selected]);
  const show = (r: Reply<unknown>) => { if (!r.ok) setErr(r); else setErr(null); };
  const shortcut = s?.shortcut.replace("CommandOrControl", s.platform === "darwin" ? "Cmd" : "Ctrl") ?? "";

  if (!s) return <div className="panel" role="status">Loading</div>;
  const host = s.apiBase ? new URL(s.apiBase).host : null;

  const head = (
    <div className="panel-head">
      <span className="brand"><EtIcon name="logo" />EvidenceTruth</span><span className="spacer" />
      <span className={`state status-${s.status}`} role="status" aria-live="polite">
        <span className="dot" aria-hidden="true" />{s.status === "online" && s.run !== "on" ? "Paused" : STATUS_TEXT[s.status]}
      </span>
    </div>
  );
  const error = err && <div className="note" role="alert"><p>{err.message}</p>{err.hint && <p className="small muted">{err.hint}</p>}</div>;
  const notice = s.notice && (
    <div className="note" role="alert"><p>{s.notice.message}</p>{s.notice.hint && <p className="small muted">{s.notice.hint}</p>}
      <button className="btn btn-text small" onClick={async () => setS(await et().dismissNotice())}>OK</button></div>
  );
  const footer = (
    <div className="panel-foot xs muted">
      <span>Version {s.version}{host ? ` · ${host}` : ""}</span><span className="spacer" />
      <button className="btn btn-text xs" onClick={async () => setS(await et().setBubble(!s.bubbleVisible))}>{s.bubbleVisible ? "Hide floating button" : "Show floating button"}</button>
      {" · "}<button className="btn btn-text xs" onClick={() => void et().quit()}>Quit</button>
    </div>
  );
  const offline = (s.status === "offline" || s.status === "error") && (
    <div className="note" role="alert">
      <p>{s.status === "offline" ? `Can't reach EvidenceTruth at ${host}.` : "EvidenceTruth is having a problem right now."}</p>
      <button className="btn small" disabled={busy} onClick={async () => { setBusy(true); setS(await et().refresh()); setBusy(false); }}>Try again</button>
    </div>
  );

  const u = s.update;
  const updateNote = (u.available || u.required) && (
    <div className="note" role="status">
      <p>{u.required ? "This version is too old for the service. Update to keep checking." : `Version ${u.latest} is available (you have ${s.version}).`}</p>
      {u.canInstall && !u.progress && <button className="btn small" onClick={() => void et().updateDownload()}>Download update</button>}
      {u.progress === "downloading" && <p className="small muted">Downloading and verifying…</p>}
      {u.progress === "ready" && <button className="btn btn-primary small" onClick={() => void et().updateInstall()}>Restart and install</button>}
      {u.progress?.startsWith("failed") && <p className="small">The update didn't download ({u.progress.slice(8)}). Your current version keeps working.</p>}
      {!u.canInstall && u.downloadUrl && <button className="btn small" onClick={() => void et().openDownload()}>Open download page</button>}
    </div>
  );
  const serverForm = (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await et().setServer(server); show(r); if (r.ok) { setS(r.data); setEditServer(false); } setBusy(false); }}>
      <div className="field"><label htmlFor="srv">EvidenceTruth address</label>
        <input id="srv" className="input" type="url" placeholder="https://" value={server} onChange={(e) => setServer(e.target.value)} /></div>
      <div className="row"><button className="btn" disabled={busy}>Save address</button>
        {s.apiBase && <button type="button" className="btn btn-text" onClick={() => { setServer(s.apiBase ?? ""); setEditServer(false); }}>Cancel</button>}</div>
    </form>
  );

  if (!s.connected) {
    return (
      <div className="panel">
        {head}
        <p>Checks text you copy from any app, using your EvidenceTruth account. It reads only what you copy and ask it to check. It never takes screenshots or watches your screen.</p>
        {notice}
        {updateNote}
        {!s.apiBase || editServer ? serverForm : (
          <p className="small">Service: <strong>{host}</strong> <button className="btn btn-text small" onClick={() => setEditServer(true)}>Change</button></p>
        )}
        {s.apiBase && !editServer && (
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await et().pair(code); show(r); if (r.ok) { setS(r.data); setCode(""); } setBusy(false); }}>
            <ol className="small">
              <li><button type="button" className="btn btn-text small" onClick={() => void et().openWeb("settings")}>Open Settings on the website</button> and sign in if asked.</li>
              <li>Press <strong>Make a connection code</strong>.</li>
              <li>Type the 6 digits here within 2 minutes.</li>
            </ol>
            <div className="field"><label htmlFor="code">Connection code</label>
              <input id="code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
            {error}
            <div className="row"><button className="btn btn-primary" disabled={busy || code.length !== 6}>Connect</button></div>
          </form>
        )}
        {(!s.apiBase || editServer) && error}
        {footer}
      </div>
    );
  }

  return (
    <div className="panel">
      {head}
      {notice}
      {updateNote}
      {offline}
      <div className="stack">
        <div className="row">
          {s.run === "on"
            ? <button className="btn btn-primary" disabled={busy || s.status !== "online"} onClick={async () => { setBusy(true); show(await et().checkClipboard()); setBusy(false); }}><EtIcon name="scan" size={16} />Check copied text</button>
            : <button className="btn btn-primary" onClick={async () => setS(await et().setRun("on"))}>Resume</button>}
          {s.run === "on" && <button className="btn" onClick={async () => setS(await et().setRun("paused"))}>Pause</button>}
        </div>
        <p className="small muted">Copy text in any app, then press <kbd className="mono">{shortcut}</kbd>, the button, or right-click the floating button.</p>
        {!s.shortcutOk && <p className="small note">The shortcut {shortcut} is used by another app, so it is off. Use the button or the floating button's menu.</p>}
        <details className="small muted"><summary>What is sent, and when</summary>
          <p>Only when you ask for a check, the text on your clipboard (up to 60,000 characters) is sent over an encrypted connection to {host}, the same service as the website. Nothing is read or sent at any other time. This app does not keep the copied text; the service keeps your checks for the period set in Settings on the website.</p>
        </details>
      </div>
      {error}
      {scan && (
        <>
          <div className="row">
            <p className="muted small" aria-live="polite">{summarize(scan.claims)}</p><span className="spacer" />
            <button className="btn btn-text small" onClick={() => void et().openReport(scan.scan_id)}>Open full report</button>
          </div>
          {scan.consent_needed.length > 0 && scan.status === "done" && (
            <p className="note small">Only your documents were searched. <button className="btn btn-text small" onClick={() => void et().openReport(scan.scan_id)}>Allow public sources on the website</button></p>
          )}
          {scan.claims.length === 0 ? <p>No factual claims were found in the copied text.</p> : (
            <>
              <ClaimsList claims={scan.claims} selected={selected} onSelect={setSelected} />
              {claim && <ClaimCard claim={claim} onFeedback={(a) => void et().feedback(claim.claim_id, a)} />}
            </>
          )}
        </>
      )}
      <p className="xs muted">Signed in as {s.email} · <button className="btn btn-text xs" onClick={async () => setS(await et().disconnect())}>Sign out</button>
        {" · "}<button className="btn btn-text xs" onClick={() => void et().openWeb("history")}>History</button></p>
      {footer}
    </div>
  );
}
