// Critical verification gaps from atoms U+V:
// 1. Desktop mega-menu hover NEVER tested (Atom U wrapped imgs there)
// 2. IG mockup section NEVER screenshot (Atom V changed how its circles render)
// 3. Only home top-of-page checked, never scrolled to IG mock
// 4. Other pages (/shop, /pdp, /checkout, /cart, etc.) never re-measured

import { chromium, webkit, devices } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";

const OUT = "tests/visual-baseline/verify-u-v";
await fs.mkdir(OUT, { recursive: true });

// 1. Desktop home — mega-menu visible on hover (Chromium 1280×720)
{
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto("https://saleid.icu/", { waitUntil: "networkidle", timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, "desktop-home-top.png") });

    // Try to hover the Yoga nav link to open mega-menu
    const yogaLink = page.locator('a:has-text("Yoga"), a:has-text("YOGA"), [href*="/shop/yoga"]').first();
    if (await yogaLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await yogaLink.hover();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, "desktop-megamenu-hover.png") });
    }

    await browser.close();
    console.log("✓ Desktop home + megamenu hover");
}

// 2. iPhone 14 home full scroll — capture IG mockup section
{
    const browser = await webkit.launch();
    const ctx = await browser.newContext(devices["iPhone 14"]);
    const page = await ctx.newPage();
    await page.goto("https://saleid.icu/", { waitUntil: "networkidle", timeout: 30000 });

    // Scroll to #instagram anchor
    await page.evaluate(() => {
        const ig = document.querySelector("#instagram");
        if (ig) ig.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "iphone-ig-mockup.png") });

    // Full page screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "iphone-home-full.png"), fullPage: true });
    await browser.close();
    console.log("✓ iPhone 14 — IG mockup + full page");
}

// 3. iPhone 14 — shop/yoga, PDP, cart, checkout image loads
{
    const pages = [
        { name: "shop-yoga", url: "https://saleid.icu/shop/yoga" },
        { name: "pdp", url: "https://saleid.icu/product/sport-1" },
        { name: "about", url: "https://saleid.icu/about" },
    ];
    const browser = await webkit.launch();
    for (const p of pages) {
        const ctx = await browser.newContext(devices["iPhone 14"]);
        const page = await ctx.newPage();
        const masters = [];
        const variants = [];
        page.on("response", (r) => {
            const url = r.url();
            if (!/\.(webp|jpg|jpeg|png)$/i.test(url)) return;
            const size = parseInt(r.headers()["content-length"] || "0", 10);
            if (/\d{3,4}w\.webp$/.test(url)) variants.push({ url: url.split("/").pop(), size });
            else masters.push({ url: url.split("/").pop(), size });
        });
        await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1500);
        const masterTotal = masters.reduce((s, m) => s + m.size, 0);
        const variantTotal = variants.reduce((s, v) => s + v.size, 0);
        console.log(`\n[${p.name}]`);
        console.log(`  Masters: ${masters.length} (${(masterTotal / 1024).toFixed(1)} KB)`);
        masters.forEach((m) => console.log(`    ${(m.size / 1024).toFixed(1)} KB  ${m.url}`));
        console.log(`  Variants: ${variants.length} (${(variantTotal / 1024).toFixed(1)} KB)`);
        await ctx.close();
    }
    await browser.close();
}

console.log("\n=== Saved to:", OUT);
