# EvidenceTruth desktop companion

A small floating circle that checks text you copy from **any** app (Word, a PDF reader, a chat app, your editor) with
your EvidenceTruth account: the same service, sources and verification engine as the website.
Select text, copy it (Ctrl+C), then press **Ctrl+Shift+E** (Cmd+Shift+E on a Mac), click **Check copied text**, or
right-click the circle.

| Do this | How |
|---|---|
| Check copied text | Ctrl+Shift+E, the panel button, or right-click the circle → Check copied text |
| Open or close the panel | Click the circle; Escape or X hides the panel (the app keeps running) |
| Menu | Right-click the circle, or focus it and press Shift+F10 / the Menu key; or the tray icon (next to the clock; click ^ if hidden) |
| Hide the circle | Menu → Hide floating button; bring it back from the tray icon or the panel footer |
| **Quit** | Right-click the circle → Quit EvidenceTruth, the tray menu, or **Quit** at the bottom of the panel |

What it sends: only when you ask for a check, the copied text (up to 60,000 characters) goes over HTTPS to the
EvidenceTruth service you connected. It never takes screenshots, never watches your screen or windows, and never records
keystrokes. It keeps no copy of the text. Your sign-in token is encrypted by the operating system (Windows DPAPI,
macOS Keychain). The app contains no passwords, database details or API keys.

## Run it from the code (Windows PowerShell, from the repository root)
```powershell
npm ci
npm run desktop
```
In development the app uses `http://localhost:8000` (run the API with `uvicorn app.main:app --port 8000` in `backend\`).
Connect: on the website open **Settings → Make a connection code**, and type the 6 digits into the app.

## Build the Windows app
```powershell
$env:ET_DESKTOP_API_BASE = "https://your-live-address"   # optional: the service the app connects to out of the box
npm run dist:win -w evidencetruth-desktop
```
Creates `desktop\release\EvidenceTruth-<version>-setup.exe` (installer, can update itself after asking) and
`EvidenceTruth-<version>-portable.exe`. A packaged app never falls back to localhost: without `ET_DESKTOP_API_BASE` it
asks for the address on first start. Only `https://` addresses are accepted (plain `http://` only for this computer).
Builds are not code-signed (certificates cost money), so Windows may warn that the publisher is unknown.
Publishing a real download link: docs/DEPLOY.md, "Publishing the Windows desktop app".

## How it's built
| File | What |
|---|---|
| `main.cjs` | Main process: windows, tray, shortcut, menus, API calls, encrypted token, update check |
| `lib/config.cjs` | Which service to use (development, user setting, build setting) and HTTPS rules |
| `lib/net.cjs` | API requests with a timeout and clear messages for offline, timeout, expired sign-in, rate limit, outage |
| `lib/menus.cjs`, `lib/version.cjs`, `lib/position.cjs` | Menu contents, update decisions, keeping the circle on screen |
| `preload.cjs` | The only bridge to the windows (no Node or network access in the windows; calls accepted only from the app's pages) |
| `src/Panel.tsx`, `src/Bubble.tsx` | The panel and the circle, using the same claim card as the web app and extension |
| `test/desktop.test.cjs` | Unit tests (`npm test -w evidencetruth-desktop`) |
| `../e2e/desktop.e2e.cjs` | The real app end to end: pair, check, menus, hide/show, report link, single instance, revoked sign-in, update notice, Quit |

On Linux machines without a keyring (CI), set `ET_LINUX_BASIC_STORE=1` so Electron can hold the token in memory for the session.
Plan, test matrix and the Windows checklist: `docs/plans/DESKTOP.md`.
