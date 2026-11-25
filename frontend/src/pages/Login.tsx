import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { GoogleLogoIcon } from "@phosphor-icons/react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote, useAsync } from "../components/ui";

export function Login() {
  const { user, config } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const { busy, error, run } = useAsync(async () => {
    const r = await api<{ status: string; dev_link?: string }>("/auth/magic-link", { body: { email } });
    setDevLink(r.dev_link ?? null);
    setSent(true);
  });
  if (user) return <Navigate to={params.get("next") || "/app"} replace />;
  return (
    <div className="page" style={{ maxWidth: 480 }}>
      <div className="stack-lg">
        <h1>Sign in or create an account</h1>
        {params.get("error") === "google" && <p className="note" role="alert">Google sign-in didn't finish. Try again, or use your email.</p>}
        {sent ? (
          <div className="card stack" role="status">
            <h2>Check your email</h2>
            <p>If <strong>{email}</strong> can receive mail, a sign-in link is on its way. It works once and expires in 15 minutes.</p>
            {devLink && (
              <div className="note stack">
                <p className="small">Development mode: no email is sent. Use this link instead.</p>
                <p><a className="btn btn-primary" href={devLink}>Open the sign-in link</a></p>
              </div>
            )}
            <button className="btn btn-text" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(); }}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <ErrorNote error={error} />
            <button className="btn btn-primary btn-lg" disabled={busy} type="submit">{busy ? "Sending" : "Email me a sign-in link"}</button>
            <p className="small muted">No password needed. New here? The same link creates your free account.</p>
          </form>
        )}
        {config?.google && !sent && (
          <>
            <hr className="rule" />
            <a className="btn btn-lg" href="/v1/auth/google/start"><GoogleLogoIcon size={20} aria-hidden />Continue with Google</a>
          </>
        )}
        <p className="xs muted">By continuing you agree to the <a href="/terms">terms</a> and the <a href="/privacy">privacy notice</a>.</p>
      </div>
    </div>
  );
}
