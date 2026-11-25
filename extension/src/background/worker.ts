/* Service worker: holds the extension token, talks to the EvidenceTruth API, enforces run state and site permission. */
import { isMsg, type Msg, type Reply, type RunState, type State } from "../shared/messages";

const API_BASE: string = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const VERSION = chrome.runtime.getManifest().version;

async function store<T>(key: string): Promise<T | undefined> { return (await chrome.storage.local.get(key))[key] as T | undefined; }

async function call<T>(path: string, init: RequestInit = {}): Promise<Reply<T>> {
  const token = await store<string>("token");
  try {
    const res = await fetch(`${API_BASE}/v1${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.status === 401) await chrome.storage.local.remove(["token", "email"]);
    if (!res.ok) return { ok: false, code: body?.code ?? `HTTP_${res.status}`, message: body?.message ?? "Something went wrong.", hint: body?.hint };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, code: "OFFLINE", message: "We couldn't reach EvidenceTruth.", hint: "Check your connection and try again." };
  }
}

async function state(): Promise<State> {
  return { connected: !!(await store("token")), email: (await store<string>("email")) ?? null, run: (await store<RunState>("run")) ?? "on",
    lastScanId: (await store<number>("lastScanId")) ?? null, apiBase: API_BASE, loop: false };
}

async function badge() {
  const s = await state();
  await chrome.action.setBadgeBackgroundColor({ color: "#17181C" });
  await chrome.action.setBadgeText({ text: !s.connected ? "!" : s.run === "on" ? "" : s.run === "paused" ? "II" : "off" });
  await chrome.action.setTitle({ title: !s.connected ? "EvidenceTruth: not connected" : s.run === "on" ? "EvidenceTruth: ready" : s.run === "paused" ? "EvidenceTruth: paused" : "EvidenceTruth: off" });
}

async function permitted(url: string | undefined): Promise<boolean> {
  if (!url || !/^https?:/.test(url)) return false;
  const origin = new URL(url).origin + "/*";
  return chrome.permissions.contains({ origins: [origin] });
}

async function scanTab(tabId: number, mode: "answer" | "selection"): Promise<Reply> {
  const s = await state();
  if (!s.connected) return { ok: false, code: "NOT_CONNECTED", message: "Connect EvidenceTruth to your account first." };
  if (s.run !== "on") return { ok: false, code: "PAUSED", message: "EvidenceTruth is paused.", hint: "Press Resume to scan." };
  const tab = await chrome.tabs.get(tabId);
  if (!(await permitted(tab.url))) return { ok: false, code: "NO_PERMISSION", message: "EvidenceTruth can't read this site yet." };
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  await chrome.tabs.sendMessage(tabId, { type: "collect", mode });
  return { ok: true, data: null };
}

async function handle(m: Msg, sender: chrome.runtime.MessageSender): Promise<Reply> {
  switch (m.type) {
    case "get-state": return { ok: true, data: await state() };
    case "set-run": await chrome.storage.local.set({ run: m.state }); await badge(); return { ok: true, data: await state() };
    case "pair": {
      const r = await call<{ token: string; email: string }>("/extension/pair", { method: "POST", body: JSON.stringify({ code: m.code, label: `Extension ${VERSION}` }) });
      if (r.ok) { await chrome.storage.local.set({ token: r.data.token, email: r.data.email }); await badge(); }
      return r.ok ? { ok: true, data: await state() } : r;
    }
    case "disconnect": await chrome.storage.local.remove(["token", "email", "lastScanId"]); await badge(); return { ok: true, data: await state() };
    case "scan-tab": return scanTab(m.tabId, m.mode);
    case "page-text": {
      // only accept page text from a content script in a tab whose site the user allowed
      if (!sender.tab?.id || !(await permitted(sender.tab.url)) || (await state()).run !== "on") return { ok: false, code: "FORBIDDEN", message: "Not allowed." };
      if (!m.text.trim()) {
        await chrome.runtime.sendMessage({ type: "scan-error", message: "Select the text to check, or open an AI answer first." }).catch(() => undefined);
        return { ok: false, code: "EMPTY", message: "Nothing selected." };
      }
      const r = await call<{ scan_id: number }>("/scan", { method: "POST", body: JSON.stringify({ text: m.text, site: m.site, mode: m.mode }) });
      if (r.ok) {
        await chrome.storage.local.set({ lastScanId: r.data.scan_id, lastTabId: sender.tab.id });
        await chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
        void pollAndUnderline(r.data.scan_id, sender.tab.id);
      } else {
        await chrome.runtime.sendMessage({ type: "scan-error", message: r.message, hint: r.hint }).catch(() => undefined);
      }
      return r;
    }
    case "get-scan": return call(`/scan/${m.scanId}`);
    case "feedback": return call(`/claims/${m.claimId}/feedback`, { method: "POST", body: JSON.stringify({ action: m.action }) });
  }
}

async function pollAndUnderline(scanId: number, tabId: number) {
  for (let i = 0; i < 120; i++) {
    const r = await call<{ status: string; claims: { text: string; label: string | null }[] }>(`/scan/${scanId}`);
    if (!r.ok) return;
    await chrome.tabs.sendMessage(tabId, { type: "underline", claims: r.data.claims }).catch(() => undefined);
    if (r.data.status !== "checking") return;
    await new Promise((res) => setTimeout(res, 1000));
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isMsg(msg)) return false;
  handle(msg, sender).then(sendResponse, (e) => {
    reportError(e);
    sendResponse({ ok: false, code: "INTERNAL", message: "Something went wrong in the extension." });
  });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "et-check", title: "Check with EvidenceTruth", contexts: ["selection"] });
  void chrome.storage.local.set({ run: "on" });
  void badge();
});
chrome.runtime.onStartup.addListener(() => void badge());

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "et-check" || !tab?.id) return;
  await chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
  if (!(await permitted(tab.url))) {
    const ok = await chrome.permissions.request({ origins: [new URL(tab.url!).origin + "/*"] }).catch(() => false);
    if (!ok) return;
  }
  const r = await scanTab(tab.id, "selection");
  if (!r.ok) await chrome.runtime.sendMessage({ type: "scan-error", message: r.message, hint: r.hint }).catch(() => undefined);
});

function reportError(e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  const frames = (err.stack ?? "").split("\n").map((l) => l.trim()).filter((l) => l.includes("chrome-extension://")).slice(0, 10);
  void fetch(`${API_BASE}/v1/client-errors`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error_type: err.name, message: err.message.slice(0, 400), frames, surface: "extension", app_version: VERSION }) }).catch(() => undefined);
}
self.addEventListener("unhandledrejection", (e) => reportError((e as PromiseRejectionEvent).reason));
