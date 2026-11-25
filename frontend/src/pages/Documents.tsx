import { useEffect, useRef, useState } from "react";
import { TrashIcon } from "@phosphor-icons/react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorNote, PageHead, useAsync } from "../components/ui";

interface Doc { doc_id: number; filename: string; title: string | null; pages: number | null; chunks: number; in_kb: boolean; stale: boolean; added_at: string }
interface Row { statement: string; status: string; passage: string | null; page: number | null }
const STATUS: Record<string, [string, string]> = {
  in_document: ["In document", "s-supported"], contradicts: ["Contradicts", "s-contradicted"],
  number_mismatch: ["Number mismatch", "s-contradicted"], not_in_document: ["Not in document", "s-unverifiable"],
};

export function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sort, setSort] = useState<"order" | "status">("order");
  const file = useRef<HTMLInputElement>(null);
  const load = async () => { const d = await api<Doc[]>("/documents"); setDocs(d); setTarget((t) => t ?? d[0]?.doc_id ?? null); };
  useEffect(() => { void load(); }, []);
  const upload = useAsync(async () => {
    const f = file.current?.files?.[0];
    if (!f) return;
    const form = new FormData(); form.append("file", f);
    await api("/documents", { form });
    if (file.current) file.current.value = "";
    await load();
  });
  const remove = useAsync(async (id: number) => { await api(`/documents/${id}`, { method: "DELETE" }); await load(); });
  const toggle = useAsync(async (d: Doc) => { await api(`/documents/${d.doc_id}`, { method: "PATCH", body: { in_kb: !d.in_kb } }); await load(); });
  const check = useAsync(async () => { setRows((await api<{ rows: Row[] }>(`/documents/${target}/check`, { body: { text } })).rows); });
  const sorted = rows && (sort === "status" ? [...rows].sort((a, b) => a.status.localeCompare(b.status)) : rows);
  return (
    <div className="stack-lg" style={{ maxWidth: 980 }}>
      <PageHead title="Documents" />
      <section className="stack">
        <h2>Your documents</h2>
        <p className="muted small">PDF, DOCX, TXT or MD, up to 25 MB. Stored as text in your account and never sent to other services. Documents marked "Use as evidence" are searched in every check. {docs && user ? `${docs.length} of ${user.documents_limit} used.` : ""}</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void upload.run(); }}>
          <label className="visually-hidden" htmlFor="file">Choose a document</label>
          <input id="file" ref={file} type="file" accept=".pdf,.docx,.txt,.md" className="input" style={{ width: "auto", height: "auto", padding: "var(--et-space-1)" }} />
          <button className="btn" disabled={upload.busy}>{upload.busy ? "Reading" : "Add document"}</button>
        </form>
        <ErrorNote error={upload.error ?? remove.error ?? toggle.error} />
        {docs && docs.length === 0 && <Empty text="Documents you add will appear here, and EvidenceTruth will use them as evidence." />}
        {docs && docs.length > 0 && (
          <div className="table-wrap"><table>
            <thead><tr><th scope="col">Name</th><th scope="col">Pages</th><th scope="col">Added</th><th scope="col">Use as evidence</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>{docs.map((d) => (
              <tr key={d.doc_id}>
                <td>{d.title || d.filename}</td><td className="num">{d.pages ?? ""}</td><td className="num">{d.added_at.slice(0, 10)}</td>
                <td><label className="toggle"><input type="checkbox" checked={d.in_kb} onChange={() => void toggle.run(d)} />{d.in_kb ? "Yes" : "No"}</label></td>
                <td><button className="btn" aria-label={`Delete ${d.filename}`} onClick={() => void remove.run(d.doc_id)}><TrashIcon size={16} aria-hidden />Delete</button></td>
              </tr>))}
            </tbody></table></div>
        )}
      </section>
      {docs && docs.length > 0 && (
        <section className="stack">
          <h2>Compare an answer with a document</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void check.run(); }}>
            <div className="field">
              <label htmlFor="doc">Document</label>
              <select id="doc" className="select" value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                {docs.map((d) => <option key={d.doc_id} value={d.doc_id}>{d.title || d.filename}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ans">Answer to compare</label>
              <textarea id="ans" className="textarea" rows={8} required value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <ErrorNote error={check.error} />
            <div className="row"><button className="btn btn-primary" disabled={check.busy || !text.trim() || !target}>{check.busy ? "Comparing" : "Compare"}</button></div>
          </form>
          {sorted && (
            <div className="table-wrap"><table>
              <thead><tr>
                <th scope="col">Statement</th>
                <th scope="col"><button className="btn btn-text" onClick={() => setSort(sort === "order" ? "status" : "order")}>Status{sort === "status" ? " (sorted)" : ""}</button></th>
                <th scope="col">Document passage</th><th scope="col">Page</th></tr></thead>
              <tbody>{sorted.map((r, i) => (
                <tr key={i}><td>{r.statement}</td><td className={STATUS[r.status][1]}><strong>{STATUS[r.status][0]}</strong></td>
                  <td>{r.passage ? <span className={r.status === "in_document" ? "decisive" : ""}>{r.passage}</span> : <span className="muted">No matching passage</span>}</td>
                  <td className="num">{r.page ?? ""}</td></tr>))}
              </tbody></table></div>
          )}
        </section>
      )}
    </div>
  );
}
