// Version comparison and the update decision. Pure, unit-tested.
function parse(v) {
  return String(v || "0").replace(/^v/, "").split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0).concat([0, 0, 0]).slice(0, 3);
}
function compare(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
// info: the service's reply from GET /v1/clients/desktop. Returns what the panel should say.
function updateState(current, info, { portable }) {
  if (!info || !info.latest_version) return { available: false, required: false };
  const available = compare(current, info.latest_version) < 0;
  const required = compare(current, info.min_version || "0.0.0") < 0;
  const feed = typeof info.update_feed_url === "string" && info.update_feed_url.startsWith("https://") ? info.update_feed_url : null;
  return {
    available, required, latest: info.latest_version,
    downloadUrl: typeof info.download_url === "string" && info.download_url.startsWith("https://") ? info.download_url : null,
    // only installed copies can update in place; a portable EXE is replaced by downloading the new one
    canInstall: available && !portable && !!feed, feed,
  };
}
module.exports = { compare, updateState };
