import { useNavigate, useSearchParams } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, useAsync } from "../components/ui";

/* The link opens this page; signing in needs a click (a POST), so email scanners that prefetch links can't use it up. */
export function Verify() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const token = params.get("token") ?? "";
  const { busy, error, run } = useAsync(async () => {
    await api("/auth/verify", { body: { token } });
    await refresh();
    nav("/app", { replace: true });
  });
  return (
    <div className="page stack-lg" style={{ maxWidth: 480 }}>
      <h1>Sign in to EvidenceTruth</h1>
      {token ? (
        <>
          <p>Press the button to finish signing in on this device.</p>
          <ErrorNote error={error} />
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => void run()}>{busy ? "Signing in" : "Sign in"}</button>
          {error ? <a href="/login">Ask for a new link</a> : null}
        </>
      ) : <p>This link is missing its code. <a href="/login">Ask for a new link</a>.</p>}
    </div>
  );
}
