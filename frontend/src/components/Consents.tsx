import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorNote, useAsync } from "./ui";

export interface ConsentRow { provider: string; name: string; decision: "always" | "never" | "unset" }

const WHAT: Record<string, string> = {
  wikipedia: "General facts. Sends the claim's words to Wikipedia's search.",
  semanticscholar: "Research papers. Sends the claim's words to Semantic Scholar.",
  arxiv: "Preprints. Sends the claim's words to arXiv.",
  crossref: "Citation records. Sends the reference text to Crossref.",
  registries: "Package checks. Sends package names to PyPI and npm.",
  links: "Opens the links in references you check, to see if they work.",
};

export function useConsents() {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const load = async () => setRows(await api<ConsentRow[]>("/consents"));
  useEffect(() => { void load(); }, []);
  const set = async (provider: string, decision: "always" | "never") =>
    setRows(await api<ConsentRow[]>("/consents", { method: "PUT", body: { provider, decision } }));
  return { rows, set };
}

export function ConsentList({ only }: { only?: string[] }) {
  const { rows, set } = useConsents();
  const { error, run } = useAsync(set);
  if (!rows) return <p className="muted" role="status">Loading sources</p>;
  return (
    <div className="stack">
      <ErrorNote error={error} />
      <table>
        <thead><tr><th scope="col">Source</th><th scope="col">What is sent</th><th scope="col">Allowed</th></tr></thead>
        <tbody>
          {rows.filter((r) => !only || only.includes(r.provider)).map((r) => (
            <tr key={r.provider}>
              <th scope="row">{r.name}</th>
              <td className="small">{WHAT[r.provider]}</td>
              <td>
                <label className="toggle">
                  <input type="checkbox" checked={r.decision === "always"} onChange={(e) => void run(r.provider, e.target.checked ? "always" : "never")} />
                  {r.decision === "always" ? "Allowed" : r.decision === "never" ? "Off" : "Not asked yet"}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Inline consent row (APP_FLOW §2.7): nothing is sent before the user answers. */
export function ConsentPrompt({ needed, onDone }: { needed: string[]; onDone: () => void }) {
  const { rows, set } = useConsents();
  const { busy, error, run } = useAsync(async (decision: "always" | "never") => {
    for (const p of needed) await set(p, decision);
    onDone();
  });
  if (!needed.length || !rows) return null;
  const names = rows.filter((r) => needed.includes(r.provider)).map((r) => r.name).join(", ");
  return (
    <div className="consent stack" role="region" aria-label="Allow sources">
      <p>Search {names} for evidence? Only the claim's own words are sent. Without them, only your documents are used.</p>
      <ErrorNote error={error} />
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => void run("always")}>Allow and check again</button>
        <button className="btn btn-text" disabled={busy} onClick={() => void run("never")}>No, only my documents</button>
      </div>
    </div>
  );
}
