// node scratch/_live.mjs <fx 0-3> <slide> <model> [w h] [path: "x,y;x,y;..." canvas fractions relative to the model, ms between] → frames
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const [fx = "0", sl = "0", mi = "0", w = "1440", h = "900", ts = "250,600,1000,1500,3000"] = process.argv.slice(2);
const phone = +w < 800;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: phone ? 2 : 1, reducedMotion: "reduce", hasTouch: phone, isMobile: phone });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
await p.goto("http://localhost:3000/hero-lab", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
await p.locator(".hldock__fx button").nth(+fx).click();
await p.locator(".hldock__thumbs button").nth(+sl).click();
await p.waitForTimeout(600);
await p.evaluate(() => Promise.all([...document.images].map((im) => { im.loading = "eager"; return im.decode().catch(() => {}); })));
await p.waitForTimeout(phone ? 300 : 5200); // let the one-off demo finish
const sec = p.locator("section.hl3");
const r = await sec.locator(".hl3__cam").boundingBox();
const m = sec.locator(".hl3__m").nth(+mi);
const g = await m.evaluate((e) => ["--cx", "--head", "--feet"].map((v) => parseFloat(getComputedStyle(e).getPropertyValue(v)) / 100));
const [cx, head, feet] = g;
const mode = ["contour", "arch", "shadow", "duo", "ripple", "loop", "stitch", "measure", "offset", "duet"][+fx];
const files = [];
let t0 = 0;
if (!phone) {
  await p.mouse.move(r.x + cx * r.width - 40, r.y + (head + (feet - head) * 0.3) * r.height);
  await p.mouse.move(r.x + cx * r.width, r.y + (head + (feet - head) * 0.3) * r.height, { steps: 3 });
}
for (const t of ts.split(",").map(Number)) {
  await p.waitForTimeout(t - t0); t0 = t;
  const f = `scratch/audit_shots/_lv_${t}.png`;
  await p.screenshot({ path: f });
  files.push(f);
}
// then move the pointer across her: the light / shadow / bead should follow
if (!phone) for (const dx of [-0.02, 0.025]) {
  await p.mouse.move(r.x + (cx + dx) * r.width, r.y + (head + (feet - head) * 0.15) * r.height, { steps: 8 });
  await p.waitForTimeout(700);
  const f = `scratch/audit_shots/_lv_mv${dx}.png`;
  await p.screenshot({ path: f });
  files.push(f);
}
const out = `scratch/audit_shots/lv_${phone ? "m_" : ""}${mode}_s${sl}_m${mi}.png`;
execFileSync("python", ["-c", `
from PIL import Image
import sys, os
out, cx, phone = sys.argv[1], float(sys.argv[2]), sys.argv[3] == "1"
fs = sys.argv[4:]
ims = [Image.open(f) for f in fs]
W, H = ims[0].size
if not phone:
    cw = 520
    x0 = int(min(W - cw, max(0, cx * W - cw / 2)))
    ims = [i.crop((x0, 80, x0 + cw, H - 84)) for i in ims]
else:
    ims = [i.resize((i.width // 2, i.height // 2)) for i in ims]
o = Image.new("RGB", (sum(i.width for i in ims) + 4 * (len(ims) - 1), ims[0].height)); x = 0
for i in ims: o.paste(i, (x, 0)); x += i.width + 4
o.save(out)
for f in fs: os.remove(f)
`, out, String(r.x / 1440 + cx * r.width / 1440), phone ? "1" : "0", ...files]);
console.log(mode, "slide", sl, "model", mi, "on:", await sec.locator(".hl3__m.is-on").count(), "errors:", JSON.stringify(errs));
await b.close();
