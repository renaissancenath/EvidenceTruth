import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, PageHead, useAsync } from "../components/ui";

interface Billing { plan: string; status: string | null; current_period_end: string | null; checks_used: number; checks_limit: number; billing_enabled: boolean; price_label: string }

export function Billing() {
  const { refresh, config } = useAuth();
  const [b, setB] = useState<Billing | null>(null);
  const [params] = useSearchParams();
  useEffect(() => { void api<Billing>("/billing").then(setB); void refresh(); }, [refresh]);
  const go = useAsync(async (path: string) => { window.location.href = (await api<{ url: string }>(path, { method: "POST" })).url; });
  if (!b) return <p className="muted" role="status">Loading</p>;
  const pro = b.plan === "pro";
  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <PageHead title="Plan and billing" />
      {params.get("checkout") === "success" && <p className="note" role="status">Thanks. Your payment went through; the Pro plan appears here as soon as Stripe confirms it.</p>}
      {params.get("checkout") === "cancelled" && <p className="note" role="status">Checkout was cancelled. Nothing was charged.</p>}
      <div className="card stack">
        <h2>{pro ? "Pro" : "Free"} plan</h2>
        <p><span className="num">{b.checks_used}</span> of <span className="num">{b.checks_limit}</span> checks used this month.</p>
        {pro && b.current_period_end && <p className="small muted">{b.status === "active" ? "Renews" : "Ends"} on {new Date(b.current_period_end).toLocaleDateString()}.</p>}
        {b.status === "past_due" && <p className="s-contradicted">Your last payment failed. Update your card to keep Pro.</p>}
        <ErrorNote error={go.error} />
        {!b.billing_enabled ? <p className="small muted">Paid plans are not open yet.</p> : pro ? (
          <div className="row"><button className="btn" onClick={() => void go.run("/billing/portal")} disabled={go.busy}>Manage payment, invoices or cancel</button></div>
        ) : (
          <div className="stack">
            <p>Pro: {b.price_label}. {config?.pro_checks_per_month ?? 2000} checks a month, {config?.pro_documents ?? 200} documents, history for up to a year.</p>
            <div className="row"><button className="btn btn-primary" onClick={() => void go.run("/billing/checkout")} disabled={go.busy}>{go.busy ? "Opening Stripe" : "Upgrade to Pro"}</button></div>
            <p className="xs muted">Payment is handled by Stripe. We never see your card number.</p>
          </div>
        )}
      </div>
    </div>
  );
}
