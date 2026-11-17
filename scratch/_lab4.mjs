// node scratch/_lab4.mjs <variant|all> <slide|def> <model> [w h] [t1,t2,...ms]  → shots of /hero-lab
import { chromium } from "playwright";
const [vi = "all", si = "def", mi = "0", w = "1440", h = "900", ts = "3200"] = process.argv.slice(2);
const phone = +w < 800;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: phone ? 2 : 1, reducedMotion: "reduce", hasTouch: phone, isMobile: phone });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
await p.goto("http://localhost:3000/hero-lab", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
const n = await p.locator(".hlabx__item").count();
for (let i = 0; i < n; i++) {
  if (vi !== "all" && +vi !== i) continue;
  const item = p.locator(".hlabx__item").nth(i);
  if (si !== "def") await item.locator(".hlabx__slides button").nth(+si).click();
  const sec = item.locator("section.hl2");
  await sec.evaluate((e) => e.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(phone ? 600 : 4700); // let the one-off demo finish
  await p.evaluate(() => Promise.all([...document.images].filter((im) => im.loading === "lazy").map((im) => { im.loading = "eager"; return im.decode().catch(() => {}); })));
  const r = await sec.locator(".hl2__cam").boundingBox();
  const sb = await sec.boundingBox();
  const cnt = await sec.locator(".hl2__m").count();
  const k = Math.min(+mi, cnt - 1);
  const mode = await sec.evaluate((e) => [...e.classList].find((c) => c.startsWith("hl2--")).slice(5));
  const slide = await item.locator(".hlabx__slides button.is-on").innerText();
  const m = sec.locator(".hl2__m").nth(k);
  const cx = await m.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--cx")) / 100);
  if (!phone) {
    await p.mouse.move(r.x + cx * r.width - 30, r.y + 0.5 * r.height);
    await p.mouse.move(r.x + cx * r.width, r.y + 0.55 * r.height, { steps: 3 });
  }
  let last = 0;
  for (const t of ts.split(",").map(Number)) {
    await p.waitForTimeout(t - last); last = t;
    await p.screenshot({ path: `scratch/audit_shots/l4_${phone ? "m_" : ""}${String(i + 1).padStart(2, "0")}_${mode}_s${slide}_m${k}${ts.includes(",") ? "_t" + t : ""}.png`, clip: { x: sb.x, y: Math.max(0, sb.y), width: sb.width, height: Math.min(sb.height, +h) } });
  }
  console.log(i + 1, mode, "slide", slide, "on:", await sec.locator(".hl2__m.is-on").count());
  await p.mouse.move(2, 2);
}
console.log("errors:", JSON.stringify(errs));
await b.close();
