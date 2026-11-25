import { useEffect, useState } from "react";
import { EtIcon } from "@shared/icons";
import { send, type State } from "../shared/messages";

export function Popup() {
  const [s, setS] = useState<State | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ message: string; hint?: string | null } | null>(null);
  const origin = tab?.url && /^https?:/.test(tab.url) ? new URL(tab.url).origin + "/*" : null;

  const refresh = async () => {
    const r = await send<State>({ type: "get-state" });
    if (r.ok) setS(r.data);
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTab(t ?? null);
    if (t?.url && /^https?:/.test(t.url)) setAllowed(await chrome.permissions.contains({ origins: [new URL(t.url).origin + "/*"] }));
  };
  useEffect(() => { void refresh(); }, []);

  if (!s) return <div className="popup" role="status">Loading</div>;
  const header = (
    <div className="panel-head">
      <span className="brand"><EtIcon name="logo" />EvidenceTruth</span>
      <span className="spacer" />
      <span className="state">{s.run === "on" ? (allowed ? "Reading this site when you scan" : "Ready") : s.run === "paused" ? <><EtIcon name="paused" size={16} />Paused</> : <><EtIcon name="paused" size={16} />Off</>}</span>
    </div>
  );

  if (!s.connected) {
    return (
      <div className="popup">
        {header}
        <p>Checks AI answers against sources. It reads only sites you allow, only when you press Scan, and never reads form fields or takes screenshots.</p>
        <p className="small">Sign in at <a href={`${s.apiBase}/app/settings`} target="_blank" rel="noreferrer">EvidenceTruth Settings</a>, make a connection code, and type it here.</p>
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          const r = await send<State>({ type: "pair", code });
          if (r.ok) { setS(r.data); setMsg(null); } else setMsg(r);
        }}>
          <div className="field"><label htmlFor="code">Connection code</label>
            <input id="code" className="input code-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          {msg && <div className="note" role="alert"><p>{msg.message}</p>{msg.hint && <p className="small muted">{msg.hint}</p>}</div>}
          <button className="btn btn-primary" disabled={code.length !== 6}>Connect</button>
        </form>
      </div>
    );
  }

  const scan = async () => {
    if (!tab?.id) return;
    const r = await send({ type: "scan-tab", tabId: tab.id, mode: "answer" });
    if (r.ok) window.close(); else setMsg(r);
  };
  return (
    <div className="popup">
      {header}
      {msg && <div className="note" role="alert"><p>{msg.message}</p>{msg.hint && <p className="small muted">{msg.hint}</p>}</div>}
      {s.run !== "on" ? (
        <button className="btn btn-primary" onClick={async () => { const r = await send<State>({ type: "set-run", state: "on" }); if (r.ok) setS(r.data); }}>Resume</button>
      ) : !origin ? (
        <p className="muted">EvidenceTruth can't read this kind of page.</p>
      ) : !allowed ? (
        <>
          <p>EvidenceTruth can't read this site yet.</p>
          <button className="btn btn-primary" onClick={async () => { if (await chrome.permissions.request({ origins: [origin] })) setAllowed(true); }}>Allow on this site</button>
        </>
      ) : (
        <>
          <button className="btn btn-primary" onClick={() => void scan()}><EtIcon name="scan" size={16} />Scan answer</button>
          <p className="small muted">Scans your selection, or the latest AI answer on this page.</p>
        </>
      )}
      <div className="row">
        {s.run === "on" && <button className="btn" onClick={async () => { const r = await send<State>({ type: "set-run", state: "paused" }); if (r.ok) setS(r.data); }}>Pause</button>}
        {s.run !== "off" && <button className="btn" onClick={async () => { const r = await send<State>({ type: "set-run", state: "off" }); if (r.ok) setS(r.data); }}>Stop</button>}
        <button className="btn btn-text" onClick={async () => { if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id }); window.close(); }}>Open panel</button>
      </div>
      <p className="xs muted">Signed in as {s.email}. <button className="btn btn-text xs" onClick={async () => { const r = await send<State>({ type: "disconnect" }); if (r.ok) setS(r.data); }}>Disconnect</button></p>
    </div>
  );
}
