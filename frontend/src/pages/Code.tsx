import { useState } from "react";
import { EtIcon } from "@shared/icons";
import { api } from "../api";
import { ConsentPrompt } from "../components/Consents";
import { ErrorNote, PageHead, useAsync } from "../components/ui";

interface Pkg { import: string; package: string; registry: string; exists: boolean | null; url?: string; first_release?: string | null; latest_version?: string | null; note?: string }
interface CodeOut { issues: { line: number | null; code: string; message: string }[]; packages: Pkg[]; cause: string | null; next_steps: string[]; error_signature: string | null; consent_needed: string[] }
interface CalcRow { expression: string; stated: number; recomputed: number; ok: boolean; kind: string }

export function Code() {
  const [lang, setLang] = useState<"python" | "javascript" | "typescript">("python");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [out, setOut] = useState<CodeOut | null>(null);
  const [calcText, setCalcText] = useState("");
  const [calc, setCalc] = useState<CalcRow[] | null>(null);
  const run = useAsync(async () => setOut(await api<CodeOut>("/code/check", { body: { language: lang, code, error_text: err || null } })));
  const runCalc = useAsync(async () => setCalc((await api<{ results: CalcRow[] }>("/calc/check", { body: { text: calcText } })).results));
  return (
    <div className="stack-lg" style={{ maxWidth: 980 }}>
      <PageHead title="Code and calculations" />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void run.run(); }}>
        <h2>Check code</h2>
        <div className="field">
          <label htmlFor="lang">Language</label>
          <select id="lang" className="select" style={{ maxWidth: 240 }} value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
            <option value="python">Python</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="code">Code</label>
          <textarea id="code" className="textarea code" rows={10} required spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
          <span className="small muted">The code is read, never run.</span>
        </div>
        <div className="field">
          <label htmlFor="err">Error message (optional)</label>
          <textarea id="err" className="textarea code" rows={4} spellCheck={false} value={err} onChange={(e) => setErr(e.target.value)} />
        </div>
        <ErrorNote error={run.error} />
        <div className="row"><button className="btn btn-primary" disabled={run.busy || !code.trim()}>{run.busy ? "Checking" : "Check code"}</button></div>
      </form>
      {out && <ConsentPrompt needed={out.consent_needed} onDone={() => void run.run()} />}
      {out && (
        <section className="stack">
          {out.cause && <div className="card stack"><h3>Likely cause</h3><p>{out.cause}</p>
            {out.next_steps.length > 0 && <ol className="steps">{out.next_steps.map((s) => <li key={s}>{s}</li>)}</ol>}</div>}
          <h3>Packages</h3>
          {out.packages.length === 0 ? <p className="muted">No third-party imports found.</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th scope="col">Import</th><th scope="col">Package</th><th scope="col">Registry</th><th scope="col">Result</th></tr></thead>
              <tbody>{out.packages.map((p) => (
                <tr key={p.import}><td className="mono">{p.import}</td><td className="mono">{p.package}</td><td>{p.registry === "pypi" ? "PyPI" : "npm"}</td>
                  <td>{p.exists === true && <span className="s-supported row"><EtIcon name="supported" size={16} />Exists{p.latest_version ? `, latest ${p.latest_version}` : ""}</span>}
                    {p.exists === false && <span className="s-contradicted row"><EtIcon name="contradicted" size={16} />Doesn't exist</span>}
                    {p.exists === null && <span className="s-unverifiable row"><EtIcon name="not_checkable" size={16} />Not checked</span>}
                    {p.note && <p className="small muted">{p.note}</p>}
                    {p.exists && p.url && <a className="small" href={p.url} target="_blank" rel="noopener noreferrer">Registry page</a>}</td></tr>))}
              </tbody></table></div>)}
          <h3>Static checks</h3>
          {out.issues.length === 0 ? <p className="muted">No syntax or lint problems found.</p> : (
            <ul className="stack">{out.issues.map((i, n) => <li key={n}><span className="mono">{i.line ? `line ${i.line}` : ""} {i.code}</span> {i.message}</li>)}</ul>)}
        </section>
      )}
      <hr className="rule" />
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void runCalc.run(); }}>
        <h2>Check calculations</h2>
        <div className="field">
          <label htmlFor="calc">Text with numbers</label>
          <textarea id="calc" className="textarea" rows={5} required value={calcText} onChange={(e) => setCalcText(e.target.value)} />
          <span className="small muted">Arithmetic like "12 * 7 = 84", percentages like "15% of 200 is 30", and conversions like "10 km is 6.2 miles".</span>
        </div>
        <ErrorNote error={runCalc.error} />
        <div className="row"><button className="btn" disabled={runCalc.busy || !calcText.trim()}>Check calculations</button></div>
      </form>
      {calc && (calc.length === 0 ? <p className="muted">No calculations found in this text.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th scope="col">Statement</th><th scope="col">Stated</th><th scope="col">Recomputed</th><th scope="col">Result</th></tr></thead>
          <tbody>{calc.map((r, i) => (
            <tr key={i}><td>{r.expression}</td><td className="num">{r.stated}</td><td className="num">{r.recomputed}</td>
              <td className={r.ok ? "s-supported" : "s-contradicted"}><span className="row"><EtIcon name={r.ok ? "supported" : "contradicted"} size={16} /><strong>{r.ok ? "Correct" : "Wrong"}</strong></span></td></tr>))}
          </tbody></table></div>))}
    </div>
  );
}
