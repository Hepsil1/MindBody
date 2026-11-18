// node scratch/_exit.mjs <n,n,...> [times] → frames frozen at exact times AFTER the pointer leaves the model
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const [list, ts = "60,180,330,520"] = process.argv.slice(2);
const times = ts.split(",").map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
await p.goto("http://localhost:3000/hero-lab", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
for (const n of list.split(",").map(Number)) {
  const item = p.locator(`#v${n}`);
  const sec = item.locator("section.hl2");
  await sec.evaluate((e) => e.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(4900);
  await p.evaluate(() => Promise.all([...document.images].map((im) => { im.loading = "eager"; return im.decode().catch(() => {}); })));
  const mode = await sec.evaluate((e) => [...e.classList].find((c) => c.startsWith("hl2--")).slice(5));
  const r = await sec.locator(".hl2__cam").boundingBox();
  const cx = await sec.locator(".hl2__m").first().evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--cx")) / 100);
  await p.mouse.move(r.x + cx * r.width - 30, r.y + 0.5 * r.height);
  await p.mouse.move(r.x + cx * r.width, r.y + 0.55 * r.height, { steps: 3 });
  await p.waitForTimeout(3600);
  await p.mouse.move(r.x + 0.5 * r.width, r.y + 0.93 * r.height);
  await p.waitForTimeout(25);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const cw = 560, x0 = Math.min(1440 - cw, Math.max(0, r.x + cx * r.width - cw / 2));
  const files = [];
  for (const t of times) {
    await p.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t);
    await p.waitForTimeout(110);
    const f = `scratch/audit_shots/_ex_${n}_${t}.png`;
    await p.screenshot({ path: f, clip: { x: x0, y: 80, width: cw, height: 780 } });
    files.push(f);
  }
  execFileSync("python", ["-c", `
from PIL import Image
import sys, os
fs=sys.argv[2:]
ims=[Image.open(f) for f in fs]
o=Image.new("RGB",(sum(i.width for i in ims)+4*(len(ims)-1),ims[0].height),(0,0,0)); x=0
for i in ims: o.paste(i,(x,0)); x+=i.width+4
o.save(sys.argv[1])
for f in fs: os.remove(f)
`, `scratch/audit_shots/ex_${String(n).padStart(2, "0")}_${mode}.png`, ...files]);
  console.log(n, mode);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await p.waitForTimeout(700);
}
await b.close();
