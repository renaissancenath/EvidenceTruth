import { Link } from "react-router";
import { useAuth } from "../auth";

export function Pricing() {
  const { config, user } = useAuth();
  const c = config;
  return (
    <div className="page stack-lg">
      <h1>Plans</h1>
      <p className="lede">Start free. Upgrade when you need more checks.</p>
      <div className="table-wrap">
        <table className="plans">
          <thead><tr><th scope="col"><span className="visually-hidden">Feature</span></th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
          <tbody>
            <tr><th scope="row">Price</th><td>Free</td><td>{c?.pro_price_label ?? "Pro"}</td></tr>
            <tr><th scope="row">Checks per month</th><td className="num">{c?.free_checks_per_month ?? 50}</td><td className="num">{c?.pro_checks_per_month ?? 2000}</td></tr>
            <tr><th scope="row">Documents you can add</th><td className="num">{c?.free_documents ?? 3}</td><td className="num">{c?.pro_documents ?? 200}</td></tr>
            <tr><th scope="row">History kept for up to</th><td>30 days</td><td>365 days</td></tr>
            <tr><th scope="row">Browser extension</th><td>Included</td><td>Included</td></tr>
            <tr><th scope="row">Citations, code, calculations, attempts</th><td>Included</td><td>Included</td></tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">A check is one answer, one list of references, one document comparison, one code check or one calculation check. Cancel any time from Plan and billing; you keep Pro until the end of the paid period.</p>
      <div className="row">
        {user ? <Link className="btn btn-primary" to="/app/billing">Manage your plan</Link> : <Link className="btn btn-primary" to="/login">Create a free account</Link>}
      </div>
    </div>
  );
}
