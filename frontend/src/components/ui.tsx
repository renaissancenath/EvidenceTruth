import { useState, type ReactNode } from "react";
import { EtIcon } from "@shared/icons";
import { LABEL_WORD } from "@shared/strings";
import type { Label } from "@shared/types";
import { ApiError } from "../api";

export function Brand() {
  return <><EtIcon name="logo" size={20} /><span>EvidenceTruth</span></>;
}

export function StatusTag({ label, confidence, checking }: { label: Label | null; confidence?: number | null; checking?: boolean }) {
  if (checking || !label) {
    return <span className="tag s-checking"><EtIcon name="insufficient_evidence" size={16} />Checking</span>;
  }
  return (
    <span className={`tag s-${label}`}>
      <EtIcon name={label} size={16} />
      {LABEL_WORD[label]}
      {confidence != null && <span className="num">· {confidence.toFixed(2)}</span>}
    </span>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const body = error instanceof ApiError ? error.body : { message: "Something went wrong.", hint: "Try again.", code: "UNKNOWN" };
  return (
    <div className="note" role="alert">
      <p><strong>{body.message}</strong></p>
      {body.hint && <p className="muted small">{body.hint}</p>}
      {error instanceof ApiError && error.body.fields?.map((f) => <p key={f.field} className="field-error small">{f.field}: {f.message}</p>)}
      {body.code === "QUOTA_EXCEEDED" && <p className="small"><a href="/app/billing">See plans</a></p>}
    </div>
  );
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="main-head"><h1>{title}</h1><span className="spacer" />{children}</div>;
}

export function useAsync<T extends unknown[]>(fn: (...a: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (...a: T) => {
    setBusy(true); setError(null);
    try { await fn(...a); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="card stack"><p>{text}</p>{action}</div>;
}
