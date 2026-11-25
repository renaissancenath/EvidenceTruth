// Requests to the EvidenceTruth API with a timeout and plain-language failures. Pure module (fetch is injected),
// unit-tested in test/net.test.cjs. Never throws: every outcome is a reply the panel can show.

const TIMEOUT_MS = 20000;

async function request(fetchImpl, base, path, { method = "GET", body, token, client, timeoutMs = TIMEOUT_MS } = {}) {
  if (!base) return { ok: false, code: "NOT_CONFIGURED", message: "No EvidenceTruth address is set.", hint: "Type your EvidenceTruth address in the panel." };
  let res;
  try {
    res = await fetchImpl(`${base}/v1${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...(client ? { "X-ET-Client": client } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error", // never follow a redirect with the token attached
    });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { ok: false, code: "TIMEOUT", message: "EvidenceTruth took too long to answer.", hint: "Try again in a minute." };
    }
    return { ok: false, code: "OFFLINE", message: "We couldn't reach EvidenceTruth.", hint: `Check your internet connection. Address: ${base}` };
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data };
  if (res.status === 401) return { ok: false, code: "SIGNED_OUT", message: "Your sign-in expired or was removed.", hint: "Connect again with a new code from Settings on the website." };
  if (res.status === 429) {
    const after = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(after) && after > 0 ? (after >= 120 ? `${Math.ceil(after / 60)} minutes` : `${Math.ceil(after)} seconds`) : "a little while";
    return { ok: false, code: data?.code || "RATE_LIMITED", message: data?.message || "Too many checks in a short time.", hint: `Try again in ${wait}.` };
  }
  if (res.status === 426) return { ok: false, code: "UPDATE_REQUIRED", message: data?.message || "This version of the app is too old for the service.", hint: "Download the latest version from the website." };
  if (res.status >= 500) return { ok: false, code: "SERVICE_ERROR", message: "EvidenceTruth is having a problem right now.", hint: data?.hint || "Try again in a few minutes." };
  return { ok: false, code: data?.code || `HTTP_${res.status}`, message: data?.message || "Something went wrong.", hint: data?.hint || null };
}

module.exports = { request, TIMEOUT_MS };
