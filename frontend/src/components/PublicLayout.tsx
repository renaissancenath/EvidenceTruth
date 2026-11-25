import { Link, Outlet } from "react-router";
import { useAuth } from "../auth";
import { Brand } from "./ui";
import { ThemeToggle } from "./ThemeToggle";

export function PublicLayout() {
  const { user } = useAuth();
  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header className="site-header">
        <div className="inner">
          <Link to="/" className="brand"><Brand /></Link>
          <span className="spacer" />
          <nav className="site-nav" aria-label="Site">
            <Link to="/pricing">Pricing</Link>
            <Link className="hide-sm" to="/privacy">Privacy</Link>
            {user ? <Link className="btn btn-primary" to="/app">Open the app</Link> : <Link className="btn" to="/login">Sign in</Link>}
          </nav>
        </div>
      </header>
      <main id="content"><Outlet /></main>
      <footer className="site-footer">
        <div className="inner small muted">
          <span>EvidenceTruth. Checks AI answers against sources.</span>
          <span className="spacer" />
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/report">Report a problem</Link>
          <ThemeToggle />
        </div>
      </footer>
    </>
  );
}
