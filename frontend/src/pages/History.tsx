import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LABEL_WORD } from "@shared/strings";
import type { Label } from "@shared/types";
import { api } from "../api";
import { Empty, ErrorNote, PageHead, useAsync } from "../components/ui";

interface Item { scan_id: number; site: string; mode: string; status: string; created_at: string; preview: string; counts: Record<string, number> }
const MODE: Record<string, string> = { paste: "Answer", answer: "Answer", conversation: "Conversation", selection: "Selection", citation: "Citations", code: "Code", document: "Document", tracked: "Tracked" };

export function History() {
  const [data, setData] = useState<{ items: Item[]; total: number; page: number } | null>(null);
  const [label, setLabel] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState("");
  const load = async () => setData(await api(`/history?page=${page}${label ? `&label=${label}` : ""}`));
  useEffect(() => { void load(); }, [page, label]);  // eslint-disable-line react-hooks/exhaustive-deps
  const del = useAsync(async (id: number) => { await api(`/history/${id}`, { method: "DELETE" }); await load(); });
  const delAll = useAsync(async () => { await api("/history", { method: "DELETE", body: { confirm: "DELETE" } }); setConfirm(""); await load(); });
  return (
    <div className="stack-lg">
      <PageHead title="History" />
      <div className="row">
        <label htmlFor="lab">Show</label>
        <select id="lab" className="select" style={{ width: "auto" }} value={label} onChange={(e) => { setPage(1); setLabel(e.target.value); }}>
          <option value="">All checks</option>
          {(["contradicted", "partially_supported", "unsubstantiated", "insufficient_evidence", "supported"] as Label[]).map((l) => <option key={l} value={l}>With {LABEL_WORD[l].toLowerCase()} claims</option>)}
        </select>
        <span className="spacer" />
        {data && <span className="small muted num">{data.total} checks</span>}
      </div>
      <ErrorNote error={del.error ?? delAll.error} />
      {data && data.items.length === 0 && <Empty text="Checks you run will appear here." action={<Link className="btn btn-primary" to="/app">Check an answer</Link>} />}
      {data && data.items.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th scope="col">When</th><th scope="col">Type</th><th scope="col">Text</th><th scope="col">Results</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>{data.items.map((i) => (
            <tr key={i.scan_id}>
              <td className="num small">{new Date(i.created_at).toLocaleString()}</td>
              <td>{MODE[i.mode] ?? i.mode}{i.site ? <span className="small muted"><br />{i.site}</span> : null}</td>
              <td>{["paste", "answer", "conversation", "selection", "document"].includes(i.mode) ? <Link to={`/app/scan/${i.scan_id}`}>{i.preview}</Link> : i.preview}</td>
              <td className="small">{Object.entries(i.counts).map(([k, v]) => <span key={k} className={`s-${k}`} style={{ display: "block" }}>{v} {LABEL_WORD[k as Label].toLowerCase()}</span>)}</td>
              <td><button className="btn" onClick={() => void del.run(i.scan_id)} aria-label="Delete this check">Delete</button></td>
            </tr>))}
          </tbody></table></div>
      )}
      {data && data.total > 25 && (
        <div className="row"><button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Newer</button>
          <span className="small num">Page {page}</span>
          <button className="btn" disabled={page * 25 >= data.total} onClick={() => setPage(page + 1)}>Older</button></div>
      )}
      <hr className="rule" />
      <section className="stack" style={{ maxWidth: 480 }}>
        <h2>Delete all history</h2>
        <p className="small muted">Deletes every check, result and tracked attempt in your account. Documents stay until you delete them.</p>
        <div className="field"><label htmlFor="conf">Type DELETE to confirm</label>
          <input id="conf" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <div className="row"><button className="btn btn-danger" disabled={confirm !== "DELETE" || delAll.busy} onClick={() => void delAll.run()}>Delete all history</button></div>
      </section>
    </div>
  );
}
