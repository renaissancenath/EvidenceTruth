import { NavLink, Outlet, useNavigate } from "react-router";
import { GearIcon, SignOutIcon, CreditCardIcon, BugIcon } from "@phosphor-icons/react";
import { EtIcon, type IconName } from "@shared/icons";
import { useAuth } from "../auth";
import { Brand } from "./ui";
import { ThemeToggle } from "./ThemeToggle";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/app", label: "Check an answer", icon: "scan" },
  { to: "/app/citations", label: "Citations", icon: "citation" },
  { to: "/app/documents", label: "Documents", icon: "document" },
  { to: "/app/code", label: "Code", icon: "code" },
  { to: "/app/attempts", label: "Attempts", icon: "loop" },
  { to: "/app/history", label: "History", icon: "history" },
  { to: "/app/dashboard", label: "Dashboard", icon: "dashboard" },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const pct = Math.min(100, Math.round((user.checks_used / Math.max(1, user.checks_limit)) * 100));
  return (
    <div className="shell">
      <a className="skip" href="#content">Skip to content</a>
      <aside className="sidebar">
        <div className="sidebar-top">
          <NavLink to="/app" className="brand"><Brand /></NavLink>
          <span className="spacer" />
          <span className="usage usage-sm num">{user.checks_used}/{user.checks_limit}</span>
        </div>
        <nav aria-label="App">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/app"} className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>
              <EtIcon name={n.icon} size={20} />{n.label}
            </NavLink>
          ))}
          <NavLink to="/app/billing" className={({ isActive }) => "navlink" + (isActive ? " active" : "")}><CreditCardIcon size={20} aria-hidden />Plan and billing</NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => "navlink" + (isActive ? " active" : "")}><GearIcon size={20} aria-hidden />Settings</NavLink>
          <NavLink to="/app/report" className={({ isActive }) => "navlink" + (isActive ? " active" : "")}><BugIcon size={20} aria-hidden />Report a problem</NavLink>
          <button className="navlink btn-text hide-md" style={{ border: 0, background: "none", font: "inherit", cursor: "pointer" }}
            onClick={async () => { await signOut(); nav("/"); }}><SignOutIcon size={20} aria-hidden />Sign out</button>
        </nav>
        <div className="stack small sidebar-meta" style={{ marginTop: "var(--et-space-6)" }}>
          <div className="usage">
            <span className="num">{user.checks_used} of {user.checks_limit}</span> checks this month · {user.plan === "pro" ? "Pro" : "Free"}
            <div className="meter" aria-hidden><span style={{ width: `${pct}%` }} /></div>
          </div>
          <p className="muted xs" style={{ overflowWrap: "anywhere" }}>{user.email}</p>
          <div className="row">
            <button className="btn" onClick={async () => { await signOut(); nav("/"); }}><SignOutIcon size={20} aria-hidden />Sign out</button>
          </div>
          <ThemeToggle />
        </div>
      </aside>
      <main id="content" className="main"><Outlet /></main>
    </div>
  );
}
