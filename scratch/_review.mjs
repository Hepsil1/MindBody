// node scratch/_review.mjs [from] [to] [model] [slide|def] [times] → per-variant strips of frames frozen at exact animation times
// out: scratch/audit_shots/rv_<NN>_<mode>.png  (frames side by side, crop round the hovered model)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const [from = "1", to = "30", mi = "0", si = "def", ts = "200,450,800,1300,3400"] = process.argv.slice(2);
const times = ts.split(",").map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
await p.goto("http://localhost:3000/hero-lab", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
for (let n = +from; n <= +to; n++) {
  const item = p.locator(`#v${n}`);
  if (si !== "def") await item.locator(".hlabx__slides button").nth(+si).click();
  const sec = item.locator("section.hl2");
  await sec.evaluate((e) => e.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(4900);
  await p.evaluate(() => Promise.all([...document.images].map((im) => { im.loading = "eager"; return im.decode().catch(() => {}); })));
  const mode = await sec.evaluate((e) => [...e.classList].find((c) => c.startsWith("hl2--")).slice(5));
  const r = await sec.locator(".hl2__cam").boundingBox();
  const cnt = await sec.locator(".hl2__m").count();
  const k = Math.min(+mi, cnt - 1);
  const m = sec.locator(".hl2__m").nth(k);
  const cx = await m.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--cx")) / 100);
  await p.mouse.move(r.x + cx * r.width - 30, r.y + 0.5 * r.height);
  await p.mouse.move(r.x + cx * r.width, r.y + 0.55 * r.height, { steps: 3 });
  await p.waitForTimeout(30);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const cw = 560;
  const x0 = Math.min(1440 - cw, Math.max(0, r.x + cx * r.width - cw / 2));
  const files = [];
  for (const t of times) {
    await p.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t);
    await p.waitForTimeout(110);
    const f = `scratch/audit_shots/_rv_${n}_${t}.png`;
    await p.screenshot({ path: f, clip: { x: x0, y: 80, width: cw, height: 780 } });
    files.push(f);
  }
  const out = `scratch/audit_shots/rv_${String(n).padStart(2, "0")}_${mode}${si === "def" ? "" : "_s" + si}${mi === "0" ? "" : "_m" + mi}.png`;
  execFileSync("python", ["-c", `
from PIL import Image
import sys, os
fs=sys.argv[2:]
ims=[Image.open(f) for f in fs]
o=Image.new("RGB",(sum(i.width for i in ims)+4*(len(ims)-1),ims[0].height),(0,0,0)); x=0
for i in ims: o.paste(i,(x,0)); x+=i.width+4
o.save(sys.argv[1])
for f in fs: os.remove(f)
`, out, ...files]);
  console.log(n, mode, "on:", await sec.locator(".hl2__m.is-on").count());
  await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await p.mouse.move(2, 2);
  await p.waitForTimeout(300);
}
console.log("errors:", JSON.stringify(errs));
await b.close();
