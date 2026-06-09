// Debug exactly what currentSrc and naturalWidth browser picks per img
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("https://saleid.icu/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// eslint-disable-next-line no-undef
const report = await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    return Array.from(document.images)
        .filter((i) => i.naturalWidth > 100)
        .slice(0, 8)
        .map((img) => ({
            tag: img.tagName,
            src: img.src,
            currentSrc: img.currentSrc,
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
            // eslint-disable-next-line no-undef
            parent: img.parentElement?.tagName,
        }));
});

report.forEach((r) => {
    console.log(`${r.parent}>${r.tag}`);
    console.log(`  src:        ${r.src}`);
    console.log(`  currentSrc: ${r.currentSrc}`);
    console.log(`  natural:    ${r.naturalW}x${r.naturalH}`);
    console.log("");
});

await browser.close();
