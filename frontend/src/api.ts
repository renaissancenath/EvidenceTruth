/* API client: same-origin cookies + CSRF header on writes. Errors keep the server's {code, message, hint}. */
import type { ApiErrorBody } from "@shared/types";

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) { super(body.message); }
}

function csrf(): string {
  const m = document.cookie.match(/(?:^|; )et_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? "POST" : "GET");
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-ET-CSRF"] = csrf();
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/v1${path}`, { method, headers, credentials: "same-origin",
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  } catch {
    throw new ApiError(0, { code: "OFFLINE", message: "We couldn't reach EvidenceTruth.", hint: "Check your connection and try again." });
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data ?? { code: "HTTP_" + res.status, message: "Something went wrong.", hint: null });
  return data as T;
}

/* Runtime errors go to the error monitor: type, message and our own frames only. */
export function reportClientError(err: unknown, route: string) {
  const e = err instanceof Error ? err : new Error(String(err));
  const frames = (e.stack ?? "").split("\n").map((l) => l.trim()).filter((l) => l.includes("/assets/")).slice(0, 10)
    .map((l) => l.replace(/^at\s+/, "").replace(/https?:\/\/[^/]+/, ""));
  navigator.sendBeacon?.("/v1/client-errors", new Blob([JSON.stringify({
    error_type: e.name || "Error", message: e.message.slice(0, 400), frames, surface: "web",
    app_version: __APP_VERSION__, route })], { type: "application/json" }));
}
