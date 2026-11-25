import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { LABEL_WORD, PROVIDER_NAME } from "@shared/strings";
import type { Label } from "@shared/types";
import { api } from "../api";
import { LabelBars, LineChart } from "../components/Charts";
import { Empty, PageHead } from "../components/ui";

interface Dash { by_label: Record<string, number>; by_day: ({ day: string } & Record<string, number | string>)[]; citation_issues: number;
  loop_events: number; sources: Record<string, number>; claims_total: number; recent_issues: { claim_id: number; text: string; label: Label; site: string; created_at: string; scan_id: number }[] }

export function Dashboard() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Dash | null>(null);
  const [asTable, setAsTable] = useState(false);
  useEffect(() => { void api<Dash>(`/dashboard?days=${days}`).then(setD); }, [days]);
  const points = useMemo(() => {
    if (!d) return [];
    const map = new Map(d.by_day.map((r) => [r.day, Object.entries(r).filter(([k]) => k !== "day").reduce((a, [, v]) => a + Number(v), 0)]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ x: day, y: map.get(day) ?? 0 });
    }
    return out;
  }, [d, days]);
  return (
    <div className="stack-lg" style={{ maxWidth: 1000 }}>
      <PageHead title="Dashboard">
        <label htmlFor="range" className="visually-hidden">Time range</label>
        <select id="range" className="select" style={{ width: "auto" }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
        <label className="toggle small"><input type="checkbox" checked={asTable} onChange={(e) => setAsTable(e.target.checked)} />Show as tables</label>
      </PageHead>
      {!d ? <p className="muted" role="status">Loading</p> : d.claims_total === 0 ? (
        <Empty text="Counts appear here after your first check. Every number comes from your stored checks." action={<Link className="btn btn-primary" to="/app">Check an answer</Link>} />
      ) : (
        <>
          <p className="muted"><span className="num">{d.claims_total}</span> claims checked in the last {days} days · <span className="num">{d.citation_issues}</span> citation problems · <span className="num">{d.loop_events}</span> stuck loops noticed.</p>
          <section className="card stack">
            <h2>Claims checked per day</h2>
            {asTable ? (
              <div className="table-wrap"><table><thead><tr><th scope="col">Day</th><th scope="col">Claims</th></tr></thead>
                <tbody>{points.filter((p) => p.y).map((p) => <tr key={p.x}><td className="num">{p.x}</td><td className="num">{p.y}</td></tr>)}</tbody></table></div>
            ) : <LineChart points={points} title="Claims checked per day" />}
          </section>
          <section className="card stack">
            <h2>Claims by result</h2>
            {asTable ? (
              <table><tbody>{Object.entries(d.by_label).map(([k, v]) => <tr key={k}><th scope="row">{LABEL_WORD[k as Label]}</th><td className="num">{v}</td></tr>)}</tbody></table>
            ) : <LabelBars counts={d.by_label} />}
            {Object.keys(d.sources).length > 0 && <p className="small muted">Deciding evidence came from: {Object.entries(d.sources).map(([k, v]) => `${PROVIDER_NAME[k] ?? k} (${v})`).join(", ")}.</p>}
          </section>
          <section className="stack">
            <h2>Recent problems</h2>
            {d.recent_issues.length === 0 ? <p className="muted">No contradicted, partly true or unconfirmed claims in this period.</p> : (
              <div className="table-wrap"><table>
                <thead><tr><th scope="col">Claim</th><th scope="col">Result</th><th scope="col">Where</th><th scope="col">When</th></tr></thead>
                <tbody>{d.recent_issues.map((r) => (
                  <tr key={r.claim_id}><td><Link to={`/app/scan/${r.scan_id}`}>{r.text}</Link></td><td className={`s-${r.label}`}><strong>{LABEL_WORD[r.label]}</strong></td>
                    <td className="small">{r.site || "Pasted"}</td><td className="num small">{r.created_at.slice(0, 10)}</td></tr>))}
                </tbody></table></div>)}
          </section>
        </>
      )}
    </div>
  );
}
