// The only bridge between the windows and the main process. No Node, no network in the renderer.
const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("et", {
  getState: invoke("et:get-state"),
  refresh: invoke("et:refresh"),
  dismissNotice: invoke("et:dismiss-notice"),
  setRun: invoke("et:set-run"),
  setServer: invoke("et:set-server"),
  pair: invoke("et:pair"),
  disconnect: invoke("et:disconnect"),
  checkClipboard: invoke("et:check-clipboard"),
  getScan: invoke("et:get-scan"),
  feedback: invoke("et:feedback"),
  togglePanel: invoke("et:toggle-panel"),
  hidePanel: invoke("et:hide-panel"),
  bubbleMenu: invoke("et:bubble-menu"),
  setBubble: invoke("et:set-bubble"),
  openReport: invoke("et:open-report"),
  openWeb: invoke("et:open-web"),
  openExternal: invoke("et:open-external"),
  quit: invoke("et:quit"),
  updateDownload: invoke("et:update-download"),
  updateInstall: invoke("et:update-install"),
  openDownload: invoke("et:open-download"),
  onScanStarted: (fn) => ipcRenderer.on("et:scan-started", (_e, id, err) => fn(id, err)),
  onState: (fn) => ipcRenderer.on("et:state", (_e, s) => fn(s)),
});
