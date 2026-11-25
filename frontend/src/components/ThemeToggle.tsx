import { useState } from "react";

type Theme = "system" | "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || "system");
  const apply = (t: Theme) => {
    setTheme(t);
    if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { if (t === "system") localStorage.removeItem("et-theme"); else localStorage.setItem("et-theme", t); } catch { /* ignore */ }
  };
  return (
    <label className="row small">
      <span className="visually-hidden">Theme</span>
      <select className="select" style={{ width: "auto" }} value={theme} onChange={(e) => apply(e.target.value as Theme)} aria-label="Theme">
        <option value="system">System theme</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
