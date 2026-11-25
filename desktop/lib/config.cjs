// Which EvidenceTruth service the app talks to. Pure module (no Electron), unit-tested in test/config.test.cjs.
//
// Order: ET_API_BASE (development runs only) → the address the user saved → the address baked in at build time
// (build-config.json, written by scripts/write-build-config.cjs from ET_DESKTOP_API_BASE) → development default.
// A packaged app never falls back to localhost: with nothing configured it asks the user for the address.
// HTTPS is required, except for loopback addresses (a service running on the same computer, for development).

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

function normalizeBase(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return { ok: false, reason: "Type the full address, starting with https://" }; }
  if (u.username || u.password) return { ok: false, reason: "The address must not contain a user name or password." };
  if (u.protocol === "https:") return { ok: true, origin: u.origin };
  if (u.protocol === "http:" && LOOPBACK.has(u.hostname)) return { ok: true, origin: u.origin };
  return { ok: false, reason: "The address must start with https:// (plain http is allowed only for this computer, e.g. http://localhost:8000)." };
}

function resolveConfig({ env = {}, packaged = false, stored = {}, baked = {}, service = {} }) {
  const candidates = [
    [!packaged ? env.ET_API_BASE : null, "environment"],
    [stored.apiBase, "user"],
    [baked.apiBase, "build"],
    [!packaged ? "http://localhost:8000" : null, "development default"],
  ];
  for (const [raw, source] of candidates) {
    if (!raw) continue;
    const n = normalizeBase(raw);
    if (n.ok) {
      // Where report links go: the build's website address, else the address the service reports (GET
      // /v1/clients/desktop -> web_url; in development the website runs separately from the API), else the API origin.
      const web = normalizeBase((source === "build" && baked.webBase) || service.webBase || n.origin);
      return { apiBase: n.origin, webBase: web.ok ? web.origin : n.origin, source };
    }
  }
  return { apiBase: null, webBase: null, source: "none" };
}

// Links the app may open in the browser: web pages only (no file:, javascript:, custom protocols).
function isOpenableUrl(raw) {
  try { const u = new URL(String(raw)); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

module.exports = { normalizeBase, resolveConfig, isOpenableUrl, LOOPBACK };
