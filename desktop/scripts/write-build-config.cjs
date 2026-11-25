// Writes build-config.json: the service address baked into a build. Run by the dist:* scripts.
//   ET_DESKTOP_API_BASE=https://your-service.example npm run dist:win -w evidencetruth-desktop
// Without it, the build has no address and asks the user for one on first start (never localhost).
// Only public addresses go here: the desktop app never contains secrets.
const fs = require("node:fs");
const path = require("node:path");
const { normalizeBase } = require("../lib/config.cjs");

const out = path.join(__dirname, "..", "build-config.json");
const cfg = {};
for (const [key, env] of [["apiBase", "ET_DESKTOP_API_BASE"], ["webBase", "ET_DESKTOP_WEB_BASE"]]) {
  const raw = process.env[env];
  if (!raw) continue;
  const n = normalizeBase(raw);
  if (!n.ok || !n.origin.startsWith("https://")) {
    console.error(`${env} must be an https:// address (got ${raw}).`);
    process.exit(1);
  }
  cfg[key] = n.origin;
}
fs.writeFileSync(out, JSON.stringify(cfg, null, 2) + "\n");
console.log(cfg.apiBase ? `Build will connect to ${cfg.apiBase}` : "No ET_DESKTOP_API_BASE: the app will ask for the service address on first start.");
