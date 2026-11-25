/* Message types between content script, popup, side panel and service worker. Every message is validated. */
import type { Scan } from "@shared/types";

export type RunState = "on" | "paused" | "off";
export type Msg =
  | { type: "get-state" }
  | { type: "set-run"; state: RunState }
  | { type: "pair"; code: string }
  | { type: "disconnect" }
  | { type: "scan-tab"; tabId: number; mode: "answer" | "selection" }
  | { type: "page-text"; text: string; site: string; mode: "answer" | "selection" }
  | { type: "get-scan"; scanId: number }
  | { type: "feedback"; claimId: number; action: string };

export interface State { connected: boolean; email: string | null; run: RunState; lastScanId: number | null; apiBase: string; loop: boolean }
export type Reply<T = unknown> = { ok: true; data: T } | { ok: false; code: string; message: string; hint?: string | null };

export const MAX_TEXT = 60_000;

export function isMsg(m: unknown): m is Msg {
  if (!m || typeof m !== "object" || typeof (m as { type?: unknown }).type !== "string") return false;
  const x = m as Record<string, unknown>;
  switch (x.type) {
    case "get-state": case "disconnect": return true;
    case "set-run": return x.state === "on" || x.state === "paused" || x.state === "off";
    case "pair": return typeof x.code === "string" && /^\d{6}$/.test(x.code);
    case "scan-tab": return typeof x.tabId === "number" && (x.mode === "answer" || x.mode === "selection");
    case "page-text": return typeof x.text === "string" && x.text.length <= MAX_TEXT && typeof x.site === "string" && x.site.length <= 255
      && (x.mode === "answer" || x.mode === "selection");
    case "get-scan": return typeof x.scanId === "number";
    case "feedback": return typeof x.claimId === "number" && typeof x.action === "string";
    default: return false;
  }
}

export async function send<T>(m: Msg): Promise<Reply<T>> {
  return chrome.runtime.sendMessage(m) as Promise<Reply<T>>;
}
export type { Scan };
