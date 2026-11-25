const { chromium } = require("playwright");
const fs = require("fs");
const OUT = process.argv[2];
const BASE = "http://localhost:8000";
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/");
  await page.screenshot({ path: `${OUT}/landing-1280-light.png`, fullPage: true });
  await page.goto(BASE + "/login");
  await page.fill("#email", "demo@example.com");
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Check your email");
  await page.screenshot({ path: `${OUT}/login-sent.png` });
  await new Promise((r) => setTimeout(r, 500));
  const log = fs.readFileSync(process.env.ET_SERVER_LOG || "server.log", "utf8");
  const link = [...log.matchAll(/http:\/\/localhost:8000\/auth\/verify\?token=\S+/g)].pop()[0];
  await page.goto(link);
  await page.click("text=Sign in >> nth=-1");
  await page.waitForURL("**/app/welcome");
  await page.screenshot({ path: `${OUT}/welcome.png`, fullPage: true });
  await page.click("text=Continue to the app");
  await page.waitForURL(BASE + "/app");
  // add a document the user trusts
  await page.goto(BASE + "/app/documents");
  
  await page.setInputFiles("#file", require("path").join(__dirname, "fixtures/eiffel.txt"));
  await page.click("text=Add document");
  await page.waitForSelector("td:has-text('eiffel.txt')");
  await page.goto(BASE + "/app");
  await page.fill("#answer", "Sure! Here is what I know. The Eiffel Tower was built from 1887 to 1889. The Eiffel Tower is 450 metres tall. It was designed by Gustave Eiffel's company. I think it is the most beautiful tower in Europe.");
  await page.fill("#site", "chatgpt.com");
  await page.click("text=Check this answer");
  await page.waitForURL("**/app/scan/*");
  await page.waitForSelector("text=4 of 4 claims checked", { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/results-1280-light.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/claim-card.png`, clip: { x: 0, y: 0, width: 1280, height: 900 } });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${OUT}/results-1280-dark.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: "light" });
  for (const p of ["citations", "code", "attempts", "history", "dashboard", "billing", "settings", "report"]) {
    await page.goto(`${BASE}/app/${p}`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${p}-1280-light.png`, fullPage: true });
  }
  // phone width
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(String(e)));
  for (const p of ["/", "/pricing", "/app", "/app/dashboard"]) {
    await mp.goto(BASE + p); await mp.waitForTimeout(300);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) errors.push(`horizontal overflow ${overflow}px on ${p}`);
    await mp.screenshot({ path: `${OUT}/m${p.replace(/\//g, "_") || "_"}-390.png`, fullPage: true });
  }
  const sid = page.url();
  await mp.goto(sid); await mp.waitForTimeout(500);
  await mp.screenshot({ path: `${OUT}/m_results-390.png`, fullPage: true });
  await browser.close();
  console.log("errors:", JSON.stringify(errors, null, 1));
})().catch((e) => { console.error("FAILED", e); console.log("errors:", errors); process.exit(1); });
