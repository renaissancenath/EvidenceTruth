// EvidenceTruth desktop companion: main process.
// Reads ONLY text the user copies and asks to check (button, bubble menu, tray menu or Ctrl/Cmd+Shift+E). No screen
// capture, no keylogging, no window watching. Checks go to the same EvidenceTruth service and engine as the website;
// the app has no verification logic of its own. The sign-in token is encrypted with the OS secure store (safeStorage:
// DPAPI on Windows, Keychain on macOS, the keyring on Linux). Renderers have no Node and no network: every API call goes
// through the IPC surface below, which accepts calls only from the app's own pages and validates its inputs.
// API checked against Electron 45 type definitions: clipboard.readText() returns a Promise, and safeStorage's sync
// methods are deprecated in favour of encryptStringAsync / decryptStringAsync / isAsyncEncryptionAvailable.

const { app, BrowserWindow, Menu, Tray, clipboard, globalShortcut, ipcMain, nativeImage, safeStorage, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { normalizeBase, resolveConfig, isOpenableUrl } = require("./lib/config.cjs");
const { request } = require("./lib/net.cjs");
const { bubbleMenu, trayMenu, tooltip } = require("./lib/menus.cjs");
const { clampToDisplays } = require("./lib/position.cjs");
const { updateState } = require("./lib/version.cjs");

const SHORTCUT = "CommandOrControl+Shift+E";
const MAX_TEXT = 60000;
const BUBBLE = 64;
const PING_EVERY_MS = 5 * 60 * 1000;
const DIST = path.join(__dirname, "dist");
const DIST_URL = pathToFileURL(DIST).href;
const store = path.join(app.getPath("userData"), "settings.json");
const CLIENT = `desktop/${app.getVersion()}`;

let bubble = null;
let panel = null;
let tray = null;
let status = "checking"; // online | offline | signed_out | error | not_configured | checking
let notice = null; // a message to show once in the panel (e.g. "your sign-in expired")
let shortcutOk = false;
let update = { available: false, required: false }; // from GET /v1/clients/desktop
let updateProgress = null; // null | "downloading" | "ready" | "failed: ..."
// electron-builder's portable target sets this; a portable EXE cannot replace itself
const PORTABLE = !!process.env.PORTABLE_EXECUTABLE_FILE;

// ---------- settings and token ----------
function readStore() {
  try { return JSON.parse(fs.readFileSync(store, "utf8")); } catch { return {}; }
}
function writeStore(patch) {
  const next = { ...readStore(), ...patch };
  fs.mkdirSync(path.dirname(store), { recursive: true });
  fs.writeFileSync(store, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}
function baked() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "build-config.json"), "utf8")); } catch { return {}; }
}
let serviceWeb = null; // the website address the service reports (web_url)
function config() {
  return resolveConfig({ env: process.env, packaged: app.isPackaged, stored: readStore(), baked: baked(), service: { webBase: serviceWeb } });
}
async function getToken() {
  const enc = readStore().token;
  if (!enc) return null;
  try {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return null;
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(enc, "base64"));
    if (shouldReEncrypt) writeStore({ token: (await safeStorage.encryptStringAsync(result)).toString("base64") });
    return result;
  } catch { return null; }
}
async function setToken(token, email) {
  if (!token) return writeStore({ token: null, email: null });
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("This computer has no secure storage for the sign-in token (on Linux, install a keyring such as GNOME Keyring).");
  }
  return writeStore({ token: (await safeStorage.encryptStringAsync(token)).toString("base64"), email });
}

function bubbleVisible() { return !!(bubble && !bubble.isDestroyed() && bubble.isVisible()); }

async function state() {
  const s = readStore();
  const c = config();
  return {
    connected: !!(await getToken()), status, notice, email: s.email || null, run: s.run || "on",
    apiBase: c.apiBase, webBase: c.webBase, configSource: c.source, lastScanId: s.lastScanId || null,
    shortcut: SHORTCUT, shortcutOk, bubbleVisible: bubbleVisible(), version: app.getVersion(), platform: process.platform,
    update: { ...update, progress: updateProgress, portable: PORTABLE },
  };
}

// ---------- API ----------
async function call(pathname, init = {}) {
  const c = config();
  const token = await getToken();
  const r = await request(fetch, c.apiBase, pathname, { ...init, token, client: CLIENT });
  if (r.code === "SIGNED_OUT" && token) {
    await setToken(null);
    notice = { message: r.message, hint: r.hint };
    await setStatus("signed_out");
  } else if (r.code === "OFFLINE" || r.code === "TIMEOUT") await setStatus("offline");
  else if (r.code === "SERVICE_ERROR") await setStatus("error");
  else if (r.code === "UPDATE_REQUIRED") { update = { ...update, required: true }; await broadcast(); }
  else if (r.ok && token && status !== "online") await setStatus("online");
  return r;
}

// Is the service reachable and is the sign-in still valid? Runs at start, every few minutes, and on request.
async function ping() {
  const c = config();
  if (!c.apiBase) return setStatus("not_configured");
  void checkForUpdate();
  if (!(await getToken())) return setStatus("signed_out");
  const r = await call("/me");
  if (r.ok) return setStatus("online");
  if (!["SIGNED_OUT", "OFFLINE", "TIMEOUT", "SERVICE_ERROR"].includes(r.code)) await setStatus("error");
  return state();
}

async function setStatus(next) {
  status = next;
  return broadcast();
}

async function broadcast() {
  const s = await state();
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(tooltip(s));
    tray.setContextMenu(Menu.buildFromTemplate(strip(trayMenu(s, actions))));
  }
  for (const w of [bubble, panel]) if (w && !w.isDestroyed()) w.webContents.send("et:state", s);
  return s;
}

// Electron rejects unknown keys in menu templates only in some versions; keep ids out of the real menu
function strip(template) { return template.map(({ id, ...item }) => item); }

// ---------- updates (docs/plans/DESKTOP.md) ----------
// The service says which version is current (GET /v1/clients/desktop). Installed copies can download that version's
// installer from the release the service names, but only when the user asks; electron-updater checks the file's SHA-512
// against the release's latest.yml before running it, and only after the user presses "Restart and install".
// A failed download or install leaves the current version in place. Portable copies only show the download page.
async function checkForUpdate() {
  const c = config();
  if (!c.apiBase) return;
  const r = await request(fetch, c.apiBase, "/clients/desktop", { client: CLIENT });
  if (!r.ok) return;
  const web = normalizeBase(r.data && r.data.web_url);
  serviceWeb = web.ok ? web.origin : null;
  update = updateState(app.getVersion(), r.data, { portable: PORTABLE || !app.isPackaged || process.platform !== "win32" });
  await broadcast();
}

let updater = null;
async function downloadUpdate() {
  if (!update.canInstall || !update.feed) return { ok: false, code: "NO_UPDATE", message: "No update can be installed here." };
  if (!updater) {
    updater = require("electron-updater").autoUpdater;
    updater.autoDownload = false; // never download without the user asking
    updater.autoInstallOnAppQuit = false; // never install without the user asking
    updater.on("download-progress", () => { if (updateProgress !== "downloading") { updateProgress = "downloading"; void broadcast(); } });
    updater.on("update-downloaded", () => { updateProgress = "ready"; void broadcast(); });
    updater.on("error", (err) => { updateProgress = `failed: ${String(err && err.message ? err.message : err).slice(0, 160)}`; void broadcast(); });
  }
  updater.setFeedURL({ provider: "generic", url: update.feed });
  updateProgress = "downloading";
  await broadcast();
  const found = await updater.checkForUpdates();
  if (!found || !found.isUpdateAvailable) { updateProgress = "failed: the release has no newer installer"; await broadcast(); return state(); }
  await updater.downloadUpdate();
  return state();
}

function installUpdate() {
  if (updater && updateProgress === "ready") { app.isQuitting = true; updater.quitAndInstall(false, true); }
}

// ---------- actions ----------
async function checkClipboard() {
  const s = await state();
  if (!s.apiBase) { showPanel(); return { ok: false, code: "NOT_CONFIGURED", message: "Set your EvidenceTruth address first." }; }
  if (!s.connected) { showPanel(); return { ok: false, code: "NOT_CONNECTED", message: "Connect EvidenceTruth to your account first." }; }
  if (s.run !== "on") { showPanel(); return { ok: false, code: "PAUSED", message: "EvidenceTruth is paused.", hint: "Press Resume to check text." }; }
  const text = String(await clipboard.readText()).trim().slice(0, MAX_TEXT);
  if (!text) { showPanel(); return { ok: false, code: "EMPTY", message: "Nothing is copied.", hint: "Select text in any app, copy it (Ctrl+C), then check again." }; }
  // the copied text goes to the service in this one request and is not kept by the app
  const r = await call("/scan", { method: "POST", body: { text, site: "desktop", mode: "selection" } });
  if (r.ok) writeStore({ lastScanId: r.data.scan_id });
  showPanel();
  panel?.webContents.send("et:scan-started", r.ok ? r.data.scan_id : null, r.ok ? null : r);
  return r;
}

function showPanel() {
  if (!panel || panel.isDestroyed()) createPanel();
  panel.show();
  panel.focus();
}

function hidePanel() {
  if (panel && !panel.isDestroyed() && panel.isVisible()) {
    panel.hide();
    // tell people once that the app keeps running, and where Quit is
    if (!readStore().toldAboutTray && tray && process.platform === "win32") {
      tray.displayBalloon({ title: "EvidenceTruth is still running", content: "Right-click the floating button or the tray icon to quit." });
    }
    writeStore({ toldAboutTray: true });
  }
}

async function showBubble() {
  if (!bubble || bubble.isDestroyed()) createBubble();
  bubble.showInactive();
  writeStore({ bubbleHidden: false });
  return broadcast();
}

async function hideBubble() {
  if (bubble && !bubble.isDestroyed()) bubble.hide();
  writeStore({ bubbleHidden: true });
  return broadcast();
}

async function setRun(run) {
  writeStore({ run });
  return broadcast();
}

function openWeb(pathname) {
  const { webBase } = config();
  if (webBase) void shell.openExternal(`${webBase}${pathname}`);
}

let quitting = false;
function quit() {
  if (quitting) return;
  quitting = true;
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  if (tray && !tray.isDestroyed()) tray.destroy();
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.destroy();
  app.quit();
}

const actions = {
  check: () => void checkClipboard(),
  openPanel: () => showPanel(),
  pause: () => void setRun("paused"),
  resume: () => void setRun("on"),
  hideBubble: () => void hideBubble(),
  showBubble: () => void showBubble(),
  quit,
};

async function popupBubbleMenu() {
  if (!bubble || bubble.isDestroyed()) return;
  Menu.buildFromTemplate(strip(bubbleMenu(await state(), actions))).popup({ window: bubble });
}

// ---------- windows ----------
const secure = { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, preload: path.join(__dirname, "preload.cjs") };

function createBubble() {
  const { workArea } = screen.getPrimaryDisplay();
  const saved = clampToDisplays(readStore().bubblePos, screen.getAllDisplays(), BUBBLE);
  bubble = new BrowserWindow({
    width: BUBBLE, height: BUBBLE, x: saved ? saved.x : workArea.x + workArea.width - 96, y: saved ? saved.y : workArea.y + workArea.height - 160,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
    minimizable: false, maximizable: false, fullscreenable: false, title: "EvidenceTruth", webPreferences: secure,
  });
  bubble.setAlwaysOnTop(true, "floating");
  bubble.loadFile(path.join(DIST, "bubble.html"));
  bubble.once("ready-to-show", () => { if (!readStore().bubbleHidden) bubble.showInactive(); void broadcast(); });
  // On Windows a right-click on the drag area opens the system menu instead of ours: show ours.
  bubble.on("system-context-menu", (e) => { e.preventDefault(); void popupBubbleMenu(); });
  let t = null;
  bubble.on("moved", () => { clearTimeout(t); t = setTimeout(() => { if (!bubble.isDestroyed()) { const [x, y] = bubble.getPosition(); writeStore({ bubblePos: { x, y } }); } }, 300); });
  bubble.on("close", (e) => { if (!app.isQuitting) { e.preventDefault(); void hideBubble(); } }); // Alt+F4 on the bubble hides it
}

function createPanel() {
  const { workArea } = screen.getPrimaryDisplay();
  panel = new BrowserWindow({
    width: 420, height: 680, x: workArea.x + workArea.width - 460, y: workArea.y + 40, show: false,
    title: "EvidenceTruth", autoHideMenuBar: true, webPreferences: secure,
  });
  panel.removeMenu();
  panel.loadFile(path.join(DIST, "panel.html"));
  panel.on("close", (e) => { if (!app.isQuitting) { e.preventDefault(); hidePanel(); } });
}

// ---------- IPC ----------
// Calls are accepted only from the app's own pages (file:// inside dist), and every input is checked. Errors come back
// as a reply the panel shows, never silently.
function fromApp(e) {
  const url = (e.senderFrame && e.senderFrame.url) || "";
  return url.startsWith(DIST_URL);
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (e, ...args) => {
    if (!fromApp(e)) return { ok: false, code: "FORBIDDEN", message: "Not allowed." };
    try {
      return await fn(e, ...args);
    } catch (err) {
      console.error(`[${channel}]`, err);
      return { ok: false, code: "DESKTOP_ERROR", message: String(err && err.message ? err.message : err).slice(0, 300) };
    }
  });
}

handle("et:get-state", () => state());
handle("et:refresh", () => ping());
handle("et:dismiss-notice", () => { notice = null; return broadcast(); });
handle("et:set-run", (_e, run) => (["on", "paused"].includes(run) ? setRun(run) : state()));
handle("et:set-server", async (_e, url) => {
  const n = normalizeBase(url);
  if (!n.ok) return { ok: false, code: "BAD_URL", message: n.reason };
  const before = readStore().apiBase;
  if (before && before !== n.origin) await setToken(null); // a token belongs to the service that issued it
  writeStore({ apiBase: n.origin });
  await ping();
  return { ok: true, data: await state() };
});
handle("et:pair", async (_e, code) => {
  if (!/^\d{6}$/.test(String(code))) return { ok: false, code: "BAD_CODE", message: "The code has 6 digits." };
  const r = await call("/extension/pair", { method: "POST", body: { code: String(code), label: `Desktop app (${process.platform === "win32" ? "Windows" : process.platform})` } });
  if (!r.ok) return r;
  if (typeof r.data?.token !== "string" || !r.data.token) return { ok: false, code: "BAD_REPLY", message: "The service sent an unexpected reply." };
  await setToken(r.data.token, typeof r.data.email === "string" ? r.data.email : null);
  notice = null;
  await setStatus("online");
  return { ok: true, data: await state() };
});
handle("et:disconnect", async () => {
  const token = await getToken();
  if (token) await call("/auth/logout", { method: "POST" }).catch(() => null); // end the session on the server too
  await setToken(null);
  return setStatus("signed_out");
});
handle("et:check-clipboard", () => checkClipboard());
handle("et:get-scan", (_e, id) => (Number.isInteger(id) && id > 0 ? call(`/scan/${id}`) : { ok: false, code: "BAD_ID", message: "Bad id" }));
handle("et:feedback", (_e, claimId, action) =>
  Number.isInteger(claimId) && claimId > 0 && ["wrong_flag", "helpful", "opened_source", "copied_correction"].includes(action)
    ? call(`/claims/${claimId}/feedback`, { method: "POST", body: { action } })
    : { ok: false, code: "BAD_INPUT", message: "Bad input" });
handle("et:toggle-panel", () => { if (panel && !panel.isDestroyed() && panel.isVisible()) hidePanel(); else showPanel(); });
handle("et:hide-panel", () => hidePanel());
handle("et:bubble-menu", () => popupBubbleMenu());
handle("et:set-bubble", (_e, visible) => (visible === true ? showBubble() : visible === false ? hideBubble() : state()));
handle("et:open-report", async (_e, id) => {
  if (!Number.isInteger(id) || id <= 0) return;
  if (!serviceWeb) await checkForUpdate(); // learn the website address first (it can differ from the API address)
  openWeb(`/app/scan/${id}`);
});
handle("et:open-web", (_e, page) => { if (["settings", "history", "login"].includes(page)) openWeb(page === "login" ? "/login" : `/app/${page}`); });
handle("et:open-external", (_e, url) => { if (isOpenableUrl(url)) void shell.openExternal(new URL(String(url)).href); });
handle("et:quit", () => quit());
handle("et:update-download", () => downloadUpdate());
handle("et:update-install", () => installUpdate());
handle("et:open-download", () => { if (update.downloadUrl) void shell.openExternal(update.downloadUrl); });

// ---------- test hooks (only when ET_TEST_HOOKS=1, never in normal use) ----------
function installTestHooks() {
  const find = (tpl, id) => tpl.find((i) => i.id === id);
  global.__et = {
    bubbleMenu: async () => bubbleMenu(await state(), actions).filter((i) => i.id).map(({ id, label, enabled }) => ({ id, label, enabled: enabled !== false })),
    trayMenu: async () => trayMenu(await state(), actions).filter((i) => i.id).map(({ id, label, enabled }) => ({ id, label, enabled: enabled !== false })),
    clickBubble: async (id) => find(bubbleMenu(await state(), actions), id).click(),
    clickTray: async (id) => find(trayMenu(await state(), actions), id).click(),
    bubbleVisible: () => bubbleVisible(),
    panelVisible: () => !!(panel && !panel.isDestroyed() && panel.isVisible()),
    trayExists: () => !!(tray && !tray.isDestroyed()),
    shortcutRegistered: () => globalShortcut.isRegistered(SHORTCUT),
    tooltip: async () => tooltip(await state()),
  };
}

// ---------- lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit(); // a second launch hands over to the running app (below) and exits
} else {
  app.on("second-instance", () => { void showBubble(); showPanel(); });
  app.whenReady().then(() => {
    if (process.platform === "win32") app.setAppUserModelId("app.evidencetruth.desktop");
    // Linux without a desktop keyring (CI, minimal desktops) has no OS secret store. Only when explicitly asked, let
    // Electron use an in-memory key there (the token then lasts until the app quits). No effect on Windows or macOS.
    if (process.platform === "linux" && process.env.ET_LINUX_BASIC_STORE === "1") safeStorage.setUsePlainTextEncryption(true);
    if (process.env.ET_TEST_HOOKS === "1") installTestHooks();
    createBubble();
    createPanel();
    const iconPath = path.join(__dirname, "assets", "icon.png");
    tray = new Tray(fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty());
    tray.on("click", showPanel);
    shortcutOk = globalShortcut.register(SHORTCUT, () => void checkClipboard());
    if (!shortcutOk) console.warn(`Shortcut ${SHORTCUT} is taken by another app.`);
    void ping().then((s) => { if (s.status !== "online") showPanel(); });
    setInterval(() => void ping(), PING_EVERY_MS).unref();
  });
  // any real quit (menu Quit, OS shutdown, updater) must not be blocked by the hide-on-close windows
  app.on("before-quit", () => { app.isQuitting = true; });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => { if (app.isQuitting) app.quit(); });
  // links open in the real browser (web pages only), never inside the app; the app's pages never navigate away
  app.on("web-contents-created", (_e, wc) => {
    wc.setWindowOpenHandler(({ url }) => { if (isOpenableUrl(url)) void shell.openExternal(url); return { action: "deny" }; });
    wc.on("will-navigate", (ev) => ev.preventDefault());
    wc.on("will-attach-webview", (ev) => ev.preventDefault());
  });
}

module.exports = { checkClipboard, state };
