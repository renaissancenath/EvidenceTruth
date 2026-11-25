// Desktop companion walkthrough: launches the real Electron app, pairs it with a code from the API,
// checks copied text, and checks that Pause and an empty clipboard are handled. Needs the backend on :8000 in
// development mode (console email backend, so the sign-in link comes back in the response).
// Linux CI: xvfb-run -a node e2e/desktop.e2e.cjs <out-dir>
const { _electron: electron } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");

const API = process.env.ET_API_BASE || "http://localhost:8000";
const OUT = process.argv[2] || "desktop-shots";
const ORIGIN = { Origin: API };

async function webSession() {
  const email = `desktop${Date.now()}@example.com`;
  const r1 = await (await fetch(`${API}/v1/auth/magic-link`, { method: "POST", headers: { ...ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email }) })).json();
  if (!r1.dev_link) throw new Error("backend must run in development mode with the console email backend");
  const token = new URL(r1.dev_link).searchParams.get("token");
  const r2 = await fetch(`${API}/v1/auth/verify`, { method: "POST", headers: { ...ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  const cookies = r2.headers.getSetCookie().map((c) => c.split(";")[0]);
  const csrf = cookies.find((c) => c.startsWith("et_csrf=")).split("=")[1];
  const h = { ...ORIGIN, Cookie: cookies.join("; "), "X-ET-CSRF": csrf };
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(path.join(__dirname, "fixtures/eiffel.txt"))], { type: "text/plain" }), "eiffel.txt");
  const up = await fetch(`${API}/v1/documents`, { method: "POST", headers: h, body: form });
  if (up.status !== 201) throw new Error(`document upload failed: ${up.status}`);
  const code = (await (await fetch(`${API}/v1/extension/pair-code`, { method: "POST", headers: h })).json()).code;
  return { email, code, h };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { email, code, h } = await webSession();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "et-desktop-"));
  const app = await electron.launch({
    args: [path.join(__dirname, "../desktop"), "--no-sandbox", "--disable-gpu"],
    env: { ...process.env, HOME: home, ET_API_BASE: API, ET_LINUX_BASIC_STORE: "1", ET_TEST_HOOKS: "1" },
  });
  const findWindow = async (name) => {
    for (let i = 0; i < 50; i++) {
      const w = app.windows().find((p) => p.url().includes(name));
      if (w) return w;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`window ${name} not found`);
  };
  const panel = await findWindow("panel.html");
  const bubble = await findWindow("bubble.html");
  await panel.waitForSelector("text=Connection code");
  await panel.screenshot({ path: `${OUT}/desktop-connect.png` });

  await panel.fill("#code", code);
  await panel.getByRole("button", { name: "Connect", exact: true }).click();
  await panel.waitForSelector(`text=Signed in as ${email}`);

  const answer = "The Eiffel Tower was built from 1887 to 1889. The Eiffel Tower is 450 metres tall. I think it is the most beautiful tower in Europe.";
  await app.evaluate(async ({ clipboard }, text) => { await clipboard.writeText(text); }, answer);
  await panel.getByRole("button", { name: "Check copied text" }).click();
  await panel.waitForSelector("text=3 of 3 claims checked", { timeout: 20000 });
  await panel.waitForTimeout(300);
  await panel.screenshot({ path: `${OUT}/desktop-results.png`, fullPage: true });
  await bubble.screenshot({ path: `${OUT}/desktop-bubble.png` });
  const labels = await panel.$$eval(".claim-row .label-word", (els) => els.map((e) => e.textContent));
  console.log("labels:", labels.join(", "));

  // empty clipboard → clear message, no request
  await app.evaluate(async ({ clipboard }) => { await clipboard.writeText(""); });
  const empty = await panel.evaluate(() => window.et.checkClipboard());
  console.log("empty clipboard:", empty.code);

  // pause blocks checking
  await panel.getByRole("button", { name: "Pause" }).click();
  await app.evaluate(async ({ clipboard }) => { await clipboard.writeText("Paris is the capital of France."); });
  const paused = await panel.evaluate(() => window.et.checkClipboard());
  console.log("paused:", paused.code);

  // the token on disk is encrypted, not plain text
  const userData = await app.evaluate(({ app }) => app.getPath("userData"));
  const settings = fs.readFileSync(path.join(userData, "settings.json"), "utf8");
  const stored = Buffer.from(JSON.parse(settings).token, "base64");
  console.log("token stored encrypted:", stored.subarray(0, 2).toString() === "v1" && !/^[A-Za-z0-9_-]{30,}$/.test(stored.toString()));

  const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`); if (!ok) process.exitCode = 1; };
  const hook = (fn, arg) => app.evaluate((_e, [f, a]) => globalThis.__et[f](a), [fn, arg]);
  // CI machines are slower than a laptop: wait for a state instead of sleeping a fixed time
  const until = async (fn, want, ms = 10000) => {
    const end = Date.now() + ms;
    let last;
    while (Date.now() < end) {
      last = await fn();
      if (last === want) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log(`  (waited ${ms} ms, last value ${JSON.stringify(last)})`);
    return false;
  };

  // menus: right-click menu on the bubble and the tray menu always offer Quit and Hide/Show
  const bm = await hook("bubbleMenu");
  check("bubble menu", JSON.stringify(bm.map((i) => i.id)) === JSON.stringify(["check", "open", "resume", "hide-bubble", "quit"]), bm.map((i) => i.label).join(" | "));
  const tm = await hook("trayMenu");
  check("tray menu", tm[0].label.startsWith("Connected") && tm.some((i) => i.id === "quit"), tm.map((i) => i.label).join(" | "));
  check("tray icon exists", await hook("trayExists"));
  check("global shortcut registered", await hook("shortcutRegistered"));

  // the bubble's own right-click handler reaches the main process (the menu itself is native and not clickable here)
  const viaIpc = await bubble.evaluate(() => window.et.bubbleMenu());
  check("bubble right-click IPC", viaIpc === undefined || viaIpc === null, JSON.stringify(viaIpc));
  await bubble.keyboard.press("Escape").catch(() => {});

  // hide and show the floating button
  await hook("clickBubble", "hide-bubble");
  check("hide floating button", await until(() => hook("bubbleVisible"), false));
  await hook("clickTray", "show-bubble");
  check("show floating button from tray", await until(() => hook("bubbleVisible"), true));

  // Escape hides the panel; the bubble click brings it back
  await panel.keyboard.press("Escape");
  check("Escape hides panel", await until(() => hook("panelVisible"), false));
  await bubble.getByRole("button").click();
  check("bubble click opens panel", await until(() => hook("panelVisible"), true));

  // links: the full report opens on the website; non-web links are refused
  await app.evaluate(({ shell }) => { globalThis.__opened = []; shell.openExternal = async (u) => { globalThis.__opened.push(u); }; });
  await panel.getByRole("button", { name: "Resume" }).click();
  await panel.getByRole("button", { name: "Open full report" }).click();
  await panel.evaluate(() => window.et.openExternal("file:///etc/passwd"));
  await panel.evaluate(() => window.et.openExternal("javascript:alert(1)"));
  await until(() => app.evaluate(() => globalThis.__opened.length), 1);
  const opened = await app.evaluate(() => globalThis.__opened);
  // the report opens on the website the service names (in development that is not the API address)
  const web = (await (await fetch(`${API}/v1/clients/desktop`)).json()).web_url || API;
  check("open full report on website", opened.length === 1 && opened[0].startsWith(`${web}/app/scan/`) && /\d+$/.test(opened[0]), opened.join(", "));
  // and that address really serves the report page, or forwards to it (never a bare {"detail":"Not Found"})
  const landing = await fetch(opened[0].replace(web, API), { redirect: "manual" });
  check("report address on the API forwards to the website", landing.status === 200 || (landing.status === 307 && landing.headers.get("location") === opened[0]), `${landing.status} ${landing.headers.get("location") || ""}`);

  // a second launch hands over to the running app and exits
  const { spawn } = require("child_process");
  const electronBin = require(require.resolve("electron", { paths: [path.join(__dirname, "../desktop")] }));
  const second = spawn(electronBin, [path.join(__dirname, "../desktop"), "--no-sandbox", "--disable-gpu"], { env: { ...process.env, HOME: home, ET_API_BASE: API } });
  const exited = await new Promise((r) => { const t = setTimeout(() => { second.kill(); r(false); }, 30000); second.on("exit", () => { clearTimeout(t); r(true); }); });
  check("second launch exits (single instance)", exited);

  // updates: the app shows exactly what the service publishes (never a made-up link); unpacked/portable builds only link
  const rel = await (await fetch(`${API}/v1/clients/desktop`)).json();
  const st = await panel.evaluate(() => window.et.refresh());
  if (rel.latest_version && rel.download_url) {
    await panel.waitForSelector(`text=Version ${rel.latest_version} is available`);
    check("update notice", st.update.available && st.update.downloadUrl === rel.download_url && !st.update.canInstall);
    await panel.getByRole("button", { name: "Open download page" }).click();
    const o2 = await app.evaluate(() => globalThis.__opened);
    check("download page opens", o2.includes(rel.download_url), o2.join(", "));
  } else check("no update notice when nothing is published", !st.update.available);

  // expired or revoked sign-in: the service rejects the token, the app says so and asks to connect again
  const list = await (await fetch(`${API}/v1/me/sessions`, { headers: h })).json();
  const device = list.find((x) => x.kind === "extension");
  await fetch(`${API}/v1/me/sessions/${device.session_id}`, { method: "DELETE", headers: h });
  const after = await panel.evaluate(() => window.et.refresh());
  check("revoked sign-in detected", after.status === "signed_out" && !after.connected && /expired|removed/.test(after.notice?.message || ""), after.notice?.message);
  await panel.waitForSelector("text=Connection code");
  await panel.screenshot({ path: `${OUT}/desktop-signed-out.png` });

  // service down: clear "offline" status, not a crash
  await panel.evaluate(() => window.et.setServer("http://127.0.0.1:9"));
  const down = await panel.evaluate(() => window.et.refresh());
  check("unreachable service", down.status === "signed_out" || down.status === "offline", down.status);
  const bad = await panel.evaluate(() => window.et.setServer("http://evil.example.com"));
  check("plain http refused for remote addresses", bad.ok === false && bad.code === "BAD_URL");

  // Quit from the tray menu really ends the app (no Task Manager needed)
  const closed = new Promise((r) => app.once("close", () => r(true)));
  await hook("clickTray", "quit").catch(() => {});
  check("quit from tray ends the app", await Promise.race([closed, new Promise((r) => setTimeout(() => r(false), 30000))]));
  if (process.exitCode) throw new Error("some desktop checks failed");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
