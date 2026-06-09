// Quick targeted re-measurement of just the 4 shop pages
import { webkit, devices } from "@playwright/test";

const PAGES = [
    { name: "shop-yoga", url: "https://saleid.icu/shop/yoga" },
    { name: "shop-sport", url: "https://saleid.icu/shop/sport" },
    { name: "shop-dance", url: "https://saleid.icu/shop/dance" },
    { name: "shop-casual", url: "https://saleid.icu/shop/casual" },
];

const browser = await webkit.launch();

for (const p of PAGES) {
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
    await page.waitForTimeout(1000);
    const productMasters = masters.filter(
        (m) => !/logo|brand-sun|mind_body|sun\.png/i.test(m.url) && m.size > 30 * 1024,
    );
    const mTotal = masters.reduce((s, m) => s + m.size, 0);
    const vTotal = variants.reduce((s, v) => s + v.size, 0);
    console.log(
        `${p.name.padEnd(13)} | ${masters.length} masters (${(mTotal / 1024).toFixed(0)}KB) | ${variants.length} variants (${(vTotal / 1024).toFixed(0)}KB) | total ${((mTotal + vTotal) / 1024).toFixed(0)}KB | leak: ${productMasters.length > 0 ? `❌ ${(productMasters.reduce((s, m) => s + m.size, 0) / 1024).toFixed(0)}KB` : "✓"}`,
    );
    productMasters.forEach((m) =>
        console.log(`               leak file: ${(m.size / 1024).toFixed(1)} KB ${m.url}`),
    );
    await ctx.close();
}

await browser.close();
