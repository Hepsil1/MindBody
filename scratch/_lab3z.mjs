// node scratch/_lab3z.mjs <section> <model> <fx 0..1> <fy 0..1>  → 2x zoom (700x700 css px) centred on canvas fraction fx,fy with the model hovered
import { chromium } from "playwright";
const [si, mi, fx, fy] = process.argv.slice(2).map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" })).newPage();
await p.goto("http://localhost:3000/hero-lab/best", { waitUntil: "networkidle" });
await p.locator(".cookie-banner button").last().click().catch(() => {});
const sec = p.locator("section.hl2").nth(si);
await sec.evaluate((e) => e.scrollIntoView({ block: "start" }));
await p.waitForTimeout(900);
const r = await sec.locator(".hl2__cam").boundingBox();
const cx = await sec.locator(".hl2__m").nth(mi).evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--cx")) / 100);
await p.mouse.move(r.x + cx * r.width - 20, r.y + 0.5 * r.height);
await p.mouse.move(r.x + cx * r.width, r.y + 0.55 * r.height, { steps: 3 });
await p.waitForTimeout(3000);
const x = r.x + fx * r.width, y = r.y + fy * r.height;
await p.screenshot({ path: `scratch/audit_shots/l3z_${si}_${mi}_${fx}_${fy}.png`, clip: { x: Math.max(0, x - 250), y: Math.max(0, y - 250), width: 500, height: 500 } });
await b.close();
