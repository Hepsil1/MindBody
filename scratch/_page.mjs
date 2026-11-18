import { chromium } from "playwright";
const b = await chromium.launch();
for (const [w, h, ph] of [[1440, 900, 0], [390, 844, 1]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: ph ? 2 : 1, reducedMotion: "reduce", hasTouch: !!ph, isMobile: !!ph })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:3000/hero-lab", { waitUntil: "networkidle" });
  await p.locator(".cookie-banner button").last().click().catch(() => {});
  await p.locator(".hldock__fx button").nth(2).click();
  await p.locator(".hldock__thumbs button").nth(5).click();
  await p.waitForTimeout(ph ? 2600 : 2200);
  await p.screenshot({ path: `scratch/audit_shots/page_${ph ? "m" : "d"}.png` });
  console.log(w, "errors", JSON.stringify(errs), "scrollW", await p.evaluate(() => document.documentElement.scrollWidth));
}
await b.close();
