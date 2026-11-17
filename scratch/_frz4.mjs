// node scratch/_frz4.mjs <mode> <slide|def> <model> <ms,ms,...> [scale]  → frames frozen at exact animation times (crop round the model)
import { chromium } from "playwright";
const [mode, si = "def", mi = "0", ts = "500", sc = "1"] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +sc, reducedMotion: "reduce" })).newPage();
await p.goto("http://localhost:3000/hero-lab", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
const sec = p.locator(`section.hl2--${mode}`);
const item = p.locator(".hlabx__item", { has: sec });
if (si !== "def") await item.locator(".hlabx__slides button").nth(+si).click();
await sec.evaluate((e) => e.scrollIntoView({ block: "start" }));
await p.waitForTimeout(4600);
await p.evaluate(() => Promise.all([...document.images].map((im) => { im.loading = "eager"; return im.decode().catch(() => {}); })));
const r = await sec.locator(".hl2__cam").boundingBox();
const m = sec.locator(".hl2__m").nth(+mi);
const cx = await m.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--cx")) / 100);
await p.mouse.move(r.x + cx * r.width - 30, r.y + 0.5 * r.height);
await p.mouse.move(r.x + cx * r.width, r.y + 0.55 * r.height, { steps: 3 });
await p.waitForTimeout(30);
await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
const x0 = Math.max(0, r.x + cx * r.width - 230);
for (const t of ts.split(",").map(Number)) {
  // currentTime counts from the start of the delay phase
  await p.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t);
  await p.waitForTimeout(120);
  await p.screenshot({ path: `scratch/audit_shots/fz_${mode}_s${si}_m${mi}_${String(t).padStart(4, "0")}.png`, clip: { x: x0, y: 80, width: 460, height: 780 } });
}
await b.close();
