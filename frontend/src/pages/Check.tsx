import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Scan } from "@shared/types";
import { ErrorNote, PageHead, useAsync } from "../components/ui";

export function Check() {
  const [text, setText] = useState("");
  const [site, setSite] = useState("");
  const { refresh } = useAuth();
  const nav = useNavigate();
  const { busy, error, run } = useAsync(async () => {
    const scan = await api<Scan>("/scan", { body: { text, site, mode: "paste" } });
    void refresh();
    nav(`/app/scan/${scan.scan_id}`);
  });
  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <PageHead title="Check an answer" />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <div className="field">
          <label htmlFor="answer">AI answer to check</label>
          <textarea id="answer" className="textarea" rows={12} required maxLength={60000} value={text} onChange={(e) => setText(e.target.value)} />
          <span className="small muted">Paste the answer as it is. Each factual sentence is checked separately.</span>
        </div>
        <div className="field">
          <label htmlFor="site">Where it came from (optional)</label>
          <input id="site" className="input" value={site} maxLength={255} onChange={(e) => setSite(e.target.value)} />
          <span className="small muted">A site name such as chatgpt.com. That site is never used as evidence for itself.</span>
        </div>
        <ErrorNote error={error} />
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>{busy ? "Starting" : "Check this answer"}</button>
          <span className="small muted">Uses 1 check.</span>
        </div>
      </form>
    </div>
  );
}
