// Menu templates for the bubble's right-click menu and the tray icon. Pure: state and actions in, template out.
// Every item has an id so tests can find and click it (test/menus.test.cjs and the Electron walkthrough).

const STATUS = {
  online: "Connected",
  signed_out: "Not signed in",
  offline: "Offline: can't reach EvidenceTruth",
  error: "EvidenceTruth has a problem",
  not_configured: "No address set",
  checking: "Connecting…",
};

function shortcutLabel(shortcut, platform) {
  return shortcut.replace("CommandOrControl", platform === "darwin" ? "Cmd" : "Ctrl");
}

function bubbleMenu(s, a) {
  return [
    { id: "check", label: `Check copied text (${shortcutLabel(s.shortcut, s.platform)})`, enabled: s.status === "online" && s.run === "on", click: a.check },
    { id: "open", label: "Open panel", click: a.openPanel },
    { type: "separator" },
    s.run === "on" ? { id: "pause", label: "Pause", click: a.pause } : { id: "resume", label: "Resume", click: a.resume },
    { id: "hide-bubble", label: "Hide floating button", click: a.hideBubble },
    { type: "separator" },
    { id: "quit", label: "Quit EvidenceTruth", click: a.quit },
  ];
}

function trayMenu(s, a) {
  return [
    { id: "status", label: `${STATUS[s.status] || s.status}${s.email ? ` · ${s.email}` : ""}`, enabled: false },
    { type: "separator" },
    { id: "open", label: "Open panel", click: a.openPanel },
    { id: "check", label: `Check copied text (${shortcutLabel(s.shortcut, s.platform)})`, enabled: s.status === "online" && s.run === "on", click: a.check },
    s.bubbleVisible ? { id: "hide-bubble", label: "Hide floating button", click: a.hideBubble } : { id: "show-bubble", label: "Show floating button", click: a.showBubble },
    s.run === "on" ? { id: "pause", label: "Pause", click: a.pause } : { id: "resume", label: "Resume", click: a.resume },
    { type: "separator" },
    { id: "quit", label: "Quit EvidenceTruth", click: a.quit },
  ];
}

function tooltip(s) {
  if (s.status !== "online") return `EvidenceTruth: ${STATUS[s.status] || s.status}`;
  return s.run === "on" ? "EvidenceTruth: ready" : "EvidenceTruth: paused";
}

module.exports = { bubbleMenu, trayMenu, tooltip, shortcutLabel, STATUS };
