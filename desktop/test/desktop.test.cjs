// Unit tests for the desktop app's pure modules (no Electron, no display). Run: npm test -w evidencetruth-desktop
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBase, resolveConfig, isOpenableUrl } = require("../lib/config.cjs");
const { request } = require("../lib/net.cjs");
const { bubbleMenu, trayMenu, tooltip } = require("../lib/menus.cjs");
const { clampToDisplays } = require("../lib/position.cjs");

test("addresses must be https, except this computer", () => {
  assert.equal(normalizeBase("https://et.example.com/app/x").origin, "https://et.example.com");
  assert.equal(normalizeBase("http://localhost:8000").ok, true);
  assert.equal(normalizeBase("http://127.0.0.1:8000").ok, true);
  assert.equal(normalizeBase("http://et.example.com").ok, false);
  assert.equal(normalizeBase("https://user:pw@et.example.com").ok, false);
  assert.equal(normalizeBase("ftp://et.example.com").ok, false);
  assert.equal(normalizeBase("not a url").ok, false);
});

test("a packaged app never falls back to localhost", () => {
  assert.deepEqual(resolveConfig({ packaged: true, env: { ET_API_BASE: "http://localhost:8000" } }), { apiBase: null, webBase: null, source: "none" });
  assert.equal(resolveConfig({ packaged: false }).apiBase, "http://localhost:8000");
});

test("config order: development env, then the user's address, then the build's", () => {
  const baked = { apiBase: "https://api.et.example", webBase: "https://et.example" };
  assert.deepEqual(resolveConfig({ packaged: true, baked }), { apiBase: "https://api.et.example", webBase: "https://et.example", source: "build" });
  assert.equal(resolveConfig({ packaged: true, baked, stored: { apiBase: "https://mine.example" } }).apiBase, "https://mine.example");
  assert.equal(resolveConfig({ packaged: true, baked, stored: { apiBase: "https://mine.example" } }).webBase, "https://mine.example");
  assert.equal(resolveConfig({ packaged: false, baked, env: { ET_API_BASE: "http://localhost:9000" } }).apiBase, "http://localhost:9000");
  assert.equal(resolveConfig({ packaged: true, stored: { apiBase: "http://evil.example" }, baked }).apiBase, "https://api.et.example"); // invalid saved value is ignored
});

test("only web pages can be opened", () => {
  assert.equal(isOpenableUrl("https://en.wikipedia.org/wiki/Mars"), true);
  for (const bad of ["file:///C:/Windows/system32/calc.exe", "javascript:alert(1)", "ms-settings:", "smb://host/share"]) assert.equal(isOpenableUrl(bad), false, bad);
});

const reply = (status, body, headers = {}) => async () => new Response(body === null ? null : JSON.stringify(body), { status, headers });

test("requests send the bearer token, client version, timeout, and never follow redirects", async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ scan_id: 7 }), { status: 201 }); };
  const r = await request(fake, "https://et.example", "/scan", { method: "POST", body: { text: "x" }, token: "tok", client: "desktop/0.1.0" });
  assert.deepEqual(r, { ok: true, data: { scan_id: 7 } });
  assert.equal(seen.url, "https://et.example/v1/scan");
  assert.equal(seen.init.headers.Authorization, "Bearer tok");
  assert.equal(seen.init.headers["X-ET-Client"], "desktop/0.1.0");
  assert.equal(seen.init.redirect, "error");
  assert.ok(seen.init.signal instanceof AbortSignal);
});

test("network failure, timeout, expired sign-in, rate limit, outage and old version give clear replies", async () => {
  const offline = async () => { throw new TypeError("fetch failed"); };
  assert.equal((await request(offline, "https://et.example", "/me")).code, "OFFLINE");
  // a server that never answers (the timer keeps the test process alive: AbortSignal.timeout's own timer does not)
  const slow = (_u, init) => new Promise((_, rej) => { const keep = setTimeout(() => {}, 5000); init.signal.addEventListener("abort", () => { clearTimeout(keep); rej(init.signal.reason); }); });
  assert.equal((await request(slow, "https://et.example", "/me", { timeoutMs: 50 })).code, "TIMEOUT");
  assert.equal((await request(reply(401, { code: "UNAUTHENTICATED" }), "https://et.example", "/me")).code, "SIGNED_OUT");
  const limited = await request(reply(429, { code: "RATE_LIMITED", message: "Slow down." }, { "Retry-After": "300" }), "https://et.example", "/scan");
  assert.equal(limited.code, "RATE_LIMITED");
  assert.equal(limited.hint, "Try again in 5 minutes.");
  assert.equal((await request(reply(503, null), "https://et.example", "/me")).code, "SERVICE_ERROR");
  assert.equal((await request(reply(426, { message: "Update" }), "https://et.example", "/me")).code, "UPDATE_REQUIRED");
  assert.equal((await request(reply(409, { code: "PAIR_INVALID", message: "Wrong code" }), "https://et.example", "/extension/pair")).code, "PAIR_INVALID");
  assert.equal((await request(reply(200, {}), null, "/me")).code, "NOT_CONFIGURED");
});

const S = { status: "online", run: "on", shortcut: "CommandOrControl+Shift+E", platform: "win32", email: "a@example.com", bubbleVisible: true };
const A = Object.fromEntries(["check", "openPanel", "pause", "resume", "hideBubble", "showBubble", "quit"].map((k) => [k, () => k]));
const ids = (t) => t.filter((i) => i.id).map((i) => i.id);

test("the bubble menu always has Quit and Hide", () => {
  assert.deepEqual(ids(bubbleMenu(S, A)), ["check", "open", "pause", "hide-bubble", "quit"]);
  assert.equal(bubbleMenu(S, A).find((i) => i.id === "quit").label, "Quit EvidenceTruth");
  assert.equal(bubbleMenu(S, A).find((i) => i.id === "check").label, "Check copied text (Ctrl+Shift+E)");
  assert.deepEqual(ids(bubbleMenu({ ...S, run: "paused" }, A)), ["check", "open", "resume", "hide-bubble", "quit"]);
  assert.equal(bubbleMenu({ ...S, status: "offline" }, A).find((i) => i.id === "check").enabled, false);
  assert.equal(bubbleMenu(S, A).find((i) => i.id === "quit").click(), "quit");
});

test("the tray menu shows status and can bring the bubble back", () => {
  const t = trayMenu({ ...S, bubbleVisible: false }, A);
  assert.equal(t[0].label, "Connected · a@example.com");
  assert.equal(t[0].enabled, false);
  assert.ok(ids(t).includes("show-bubble") && ids(t).includes("quit"));
  assert.equal(tooltip({ ...S, status: "signed_out" }), "EvidenceTruth: Not signed in");
  assert.equal(tooltip({ ...S, run: "paused" }), "EvidenceTruth: paused");
});

test("a bubble position from a missing monitor is not used", () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];
  assert.deepEqual(clampToDisplays({ x: 100, y: 100 }, displays, 64), { x: 100, y: 100 });
  assert.equal(clampToDisplays({ x: 2500, y: 100 }, displays, 64), null);
  assert.equal(clampToDisplays(null, displays, 64), null);
});

const { compare, updateState } = require("../lib/version.cjs");
test("versions compare as numbers and updates are offered, never forced silently", () => {
  assert.equal(compare("0.10.0", "0.9.9"), 1);
  assert.equal(compare("v1.2.3", "1.2.3"), 0);
  assert.equal(compare("0.1.0", "0.2.0"), -1);
  const info = { latest_version: "0.2.0", min_version: "0.1.0", download_url: "https://github.com/o/r/releases/latest", update_feed_url: "https://github.com/o/r/releases/download/desktop-v0.2.0" };
  assert.deepEqual(updateState("0.1.0", info, { portable: false }), { available: true, required: false, latest: "0.2.0", downloadUrl: info.download_url, canInstall: true, feed: info.update_feed_url });
  assert.equal(updateState("0.1.0", info, { portable: true }).canInstall, false); // portable: download page instead
  assert.equal(updateState("0.0.9", info, { portable: true }).required, true);
  assert.equal(updateState("0.2.0", info, { portable: false }).available, false);
  assert.equal(updateState("0.1.0", { ...info, update_feed_url: "http://insecure.example" }, { portable: false }).canInstall, false);
  assert.equal(updateState("0.1.0", { latest_version: null }, { portable: false }).available, false);
});

test("report links go to the website the service names, not the API address", () => {
  const c = resolveConfig({ packaged: false, env: { ET_API_BASE: "http://127.0.0.1:8000" }, service: { webBase: "http://localhost:5173" } });
  assert.equal(c.apiBase, "http://127.0.0.1:8000");
  assert.equal(c.webBase, "http://localhost:5173");
  const built = resolveConfig({ packaged: true, baked: { apiBase: "https://api.et.example", webBase: "https://et.example" }, service: { webBase: "https://other.example" } });
  assert.equal(built.webBase, "https://et.example"); // an address fixed at build time wins
});
