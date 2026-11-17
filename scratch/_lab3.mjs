// node scratch/_lab3.mjs <modelIdx|-1> [only-section] [w h]  → shots of every concept on /hero-lab/best with that model hovered
import { chromium } from "playwright";
const [mi = "0", only = "", w = "1440", h = "900"] = process.argv.slice(2);
const phone = +w < 800;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: phone ? 2 : 1, reducedMotion: "reduce", hasTouch: phone, isMobile: phone });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
await p.goto("http://localhost:3000/hero-lab/best", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
const n = await p.locator("section.hl2").count();
for (let i = 0; i < n; i++) {
  if (only !== "" && +only !== i) continue;
  const sec = p.locator("section.hl2").nth(i);
  await sec.evaluate((e) => e.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(900);
  const r = await sec.locator(".hl2__cam").boundingBox();
  const sb = await sec.boundingBox();
  const cnt = await sec.locator(".hl2__m").count();
  const k = Math.min(+mi, cnt - 1);
  if (k >= 0) {
    const m = sec.locator(".hl2__m").nth(k);
    const cx = await m.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--cx")) / 100);
    if (phone) {
      // glide the view there first, then tap what is in the middle of the screen
      await p.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height * 0.55);
      await p.waitForTimeout(3200);
    } else {
      await p.mouse.move(r.x + cx * r.width - 30, r.y + 0.5 * r.height);
      await p.mouse.move(r.x + cx * r.width, r.y + 0.55 * r.height, { steps: 4 });
      await p.waitForTimeout(3000);
    }
  }
  const mode = await sec.evaluate((e) => [...e.classList].find((c) => c.startsWith("hl2--")).slice(5));
  await p.screenshot({ path: `scratch/audit_shots/l3_${phone ? "m_" : ""}${String(i + 1).padStart(2, "0")}_${mode}_${mi}.png`, clip: { x: sb.x, y: Math.max(0, sb.y), width: sb.width, height: Math.min(sb.height, +h) } });
  console.log(i + 1, mode, "on:", await sec.locator(".hl2__m.is-on").count());
  await p.mouse.move(2, 2);
}
console.log("errors:", JSON.stringify(errs));
await b.close();
