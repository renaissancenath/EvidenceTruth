import type { Scan } from "@shared/types";

export type Reply<T> = { ok: true; data: T } | { ok: false; code: string; message: string; hint?: string | null };
export type Status = "online" | "offline" | "signed_out" | "error" | "not_configured" | "checking";
export interface DesktopState {
  connected: boolean; status: Status; notice: { message: string; hint?: string | null } | null; email: string | null;
  run: "on" | "paused"; apiBase: string | null; webBase: string | null; configSource: string; lastScanId: number | null;
  shortcut: string; shortcutOk: boolean; bubbleVisible: boolean; version: string; platform: string;
  update: { available: boolean; required: boolean; latest?: string; downloadUrl?: string | null; canInstall?: boolean; progress: string | null; portable: boolean };
}

interface Bridge {
  getState(): Promise<DesktopState>;
  refresh(): Promise<DesktopState>;
  dismissNotice(): Promise<DesktopState>;
  setRun(run: "on" | "paused"): Promise<DesktopState>;
  setServer(url: string): Promise<Reply<DesktopState>>;
  pair(code: string): Promise<Reply<DesktopState>>;
  disconnect(): Promise<DesktopState>;
  checkClipboard(): Promise<Reply<{ scan_id: number }>>;
  getScan(id: number): Promise<Reply<Scan>>;
  feedback(claimId: number, action: string): Promise<Reply<null>>;
  togglePanel(): Promise<void>;
  hidePanel(): Promise<void>;
  bubbleMenu(): Promise<void>;
  setBubble(visible: boolean): Promise<DesktopState>;
  openReport(scanId: number): Promise<void>;
  openWeb(page: "settings" | "history" | "login"): Promise<void>;
  openExternal(url: string): Promise<void>;
  quit(): Promise<void>;
  updateDownload(): Promise<unknown>;
  updateInstall(): Promise<void>;
  openDownload(): Promise<void>;
  onScanStarted(fn: (id: number | null, err: Reply<unknown> | null) => void): void;
  onState(fn: (s: DesktopState) => void): void;
}

declare global { interface Window { et: Bridge } }
export const et = (): Bridge => window.et;

export const STATUS_TEXT: Record<Status, string> = {
  online: "Connected",
  offline: "Offline",
  signed_out: "Not signed in",
  error: "Service problem",
  not_configured: "No address set",
  checking: "Connecting",
};
