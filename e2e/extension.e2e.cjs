const { chromium } = require("playwright");
const fs = require("fs");
const EXT = require("path").join(__dirname, "../extension/dist"), BASE = "http://localhost:8000", OUT = process.argv[2];
(async () => {
  const ctx = await chromium.launchPersistentContext(require("os").tmpdir() + "/et-profile-" + Date.now(), {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: "chromium" }), headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 1280, height: 900 } });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent("serviceworker");
  const id = sw.url().split("/")[2];
  console.log("extension id", id);
  // 1. web sign-in, make a pairing code, add a trusted document
  const web = await ctx.newPage();
  await web.goto(BASE + "/login"); await web.fill("#email", `ext${Date.now()}@example.com`); await web.click("button[type=submit]");
  await web.waitForSelector("text=Check your email"); await web.waitForTimeout(300);
  const link = [...fs.readFileSync(process.env.ET_SERVER_LOG || "server.log", "utf8").matchAll(/http:\/\/localhost:8000\/auth\/verify\?token=\S+/g)].pop()[0];
  await web.goto(link); await web.click("text=Sign in >> nth=-1"); await web.waitForURL("**/app/welcome");
  await web.click("text=Continue to the app"); await web.waitForURL(BASE + "/app");
  await web.goto(BASE + "/app/documents");
  await web.setInputFiles("#file", require("path").join(__dirname, "fixtures/eiffel.txt")); await web.click("text=Add document");
  await web.waitForSelector("td:has-text('eiffel.txt')");
  await web.goto(BASE + "/app/settings"); await web.click("text=Make a connection code");
  const code = (await web.textContent(".big-code")).trim();
  await web.screenshot({ path: `${OUT}/settings-pair-code.png` });
  // 2. popup: connect with the code
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 320, height: 520 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.screenshot({ path: `${OUT}/ext-popup-connect.png` });
  popup.on("console", (m) => console.log("popup console:", m.text())); sw.on("console", (m) => console.log("sw console:", m.text())); await popup.fill("#code", code); console.log("code", code, "value", await popup.inputValue("#code")); await popup.getByRole("button", { name: "Connect", exact: true }).click();
  await popup.waitForTimeout(2000); await popup.screenshot({ path: `${OUT}/ext-popup-after-connect.png` }); console.log("popup text:", (await popup.textContent("body")).slice(0, 400)); await popup.waitForSelector("text=Signed in as");
  // 3. open the chat page and scan it through the worker (same path as the Scan button)
  const chat = await ctx.newPage(); await chat.goto(BASE + "/demo-answer.html");
  await popup.bringToFront();
  const r = await popup.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: "http://localhost:8000/demo-answer.html" });
    return chrome.runtime.sendMessage({ type: "scan-tab", tabId: t.id, mode: "answer" });
  });
  console.log("scan-tab reply", JSON.stringify(r));
  await popup.screenshot({ path: `${OUT}/ext-popup-ready.png` });
  // 4. side panel page shows the results
  const panel = await ctx.newPage(); await panel.setViewportSize({ width: 400, height: 900 });
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  await panel.waitForTimeout(6000); console.log("panel text:", (await panel.textContent("body")).slice(0, 300));
  await panel.screenshot({ path: `${OUT}/ext-panel-400.png`, fullPage: true });
  await panel.setViewportSize({ width: 320, height: 900 }); await panel.screenshot({ path: `${OUT}/ext-panel-320.png`, fullPage: true });
  await panel.emulateMedia({ colorScheme: "dark" }); await panel.setViewportSize({ width: 480, height: 900 });
  await panel.screenshot({ path: `${OUT}/ext-panel-480-dark.png`, fullPage: true });
  // 5. in-page underlines via CSS Custom Highlight API
  await chat.bringToFront(); await chat.waitForTimeout(1500);
  const hl = await chat.evaluate(() => [...CSS.highlights.keys()].map((k) => `${k}:${CSS.highlights.get(k).size}`));
  console.log("highlights", hl);
  await chat.screenshot({ path: `${OUT}/ext-page-underline.png`, clip: { x: 0, y: 0, width: 1280, height: 200 } });
  // 6. pause blocks scanning
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: "set-run", state: "paused" }));
  const r2 = await popup.evaluate(async () => { const [t] = await chrome.tabs.query({ url: "http://localhost:8000/demo-answer.html" }); return chrome.runtime.sendMessage({ type: "scan-tab", tabId: t.id, mode: "answer" }); });
  console.log("paused scan reply", r2.code);
  // 7. a non-permitted site is refused
  const other = await ctx.newPage(); await other.goto("about:blank");
  await ctx.close();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
