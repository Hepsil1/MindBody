// Cross-page master vs variant accounting on iPhone 14 WebKit.
// Catches: any srcSet="literal", background-image: url(...), or bare <img>
// that hasn't been migrated to the responsive variants pipeline.

import { webkit, devices } from "@playwright/test";

const PAGES = [
    { name: "home", url: "https://saleid.icu/" },
    { name: "shop-yoga", url: "https://saleid.icu/shop/yoga" },
    { name: "shop-sport", url: "https://saleid.icu/shop/sport" },
    { name: "shop-dance", url: "https://saleid.icu/shop/dance" },
    { name: "shop-casual", url: "https://saleid.icu/shop/casual" },
    { name: "about", url: "https://saleid.icu/about" },
    { name: "contacts", url: "https://saleid.icu/about#contact-premium" },
    { name: "cart", url: "https://saleid.icu/cart" },
    { name: "checkout", url: "https://saleid.icu/checkout" },
    { name: "wishlist", url: "https://saleid.icu/wishlist" },
    { name: "auth", url: "https://saleid.icu/auth" },
    { name: "profile", url: "https://saleid.icu/profile" },
    { name: "404", url: "https://saleid.icu/this-does-not-exist" },
    { name: "faq", url: "https://saleid.icu/faq" },
    { name: "size-guide", url: "https://saleid.icu/size-guide" },
    { name: "delivery", url: "https://saleid.icu/delivery" },
];

const browser = await webkit.launch();
console.log(`Page         | Masters       | Variants       | Total      | Verdict`);
console.log(`-------------|---------------|----------------|------------|--------`);

for (const p of PAGES) {
    const ctx = await browser.newContext(devices["iPhone 14"]);
    const page = await ctx.newPage();
    const masters = [];
    const variants = [];
    page.on("response", (r) => {
        const url = r.url();
        if (!/\.(webp|jpg|jpeg|png)$/i.test(url)) return;
        // exclude tiny logos to focus on big product imgs
        const size = parseInt(r.headers()["content-length"] || "0", 10);
        if (/\d{3,4}w\.webp$/.test(url)) variants.push({ url: url.split("/").pop(), size });
        else masters.push({ url: url.split("/").pop(), size });
    });
    try {
        await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1500);
    } catch (e) {
        console.log(`${p.name.padEnd(13)}| TIMEOUT or ERROR: ${e.message?.slice(0, 30)}`);
        await ctx.close();
        continue;
    }
    // exclude logo-like masters from the "leak" count
    const productMasters = masters.filter(
        (m) =>
            !/logo|brand-sun|mind_body|sun\.png/i.test(m.url) &&
            m.size > 30 * 1024, // ignore tiny imgs <30KB
    );
    const mTotal = masters.reduce((s, m) => s + m.size, 0);
    const vTotal = variants.reduce((s, v) => s + v.size, 0);
    const total = mTotal + vTotal;
    const leak = productMasters.reduce((s, m) => s + m.size, 0);
    const verdict =
        leak > 100 * 1024
            ? `❌ LEAK ${(leak / 1024).toFixed(0)}KB`
            : leak > 20 * 1024
              ? `⚠️ ${(leak / 1024).toFixed(0)}KB`
              : "✓";
    console.log(
        `${p.name.padEnd(13)}| ${`${masters.length} (${(mTotal / 1024).toFixed(0)}KB)`.padEnd(14)}| ${`${variants.length} (${(vTotal / 1024).toFixed(0)}KB)`.padEnd(15)}| ${`${(total / 1024).toFixed(0)}KB`.padEnd(11)}| ${verdict}`,
    );
    if (productMasters.length > 0) {
        productMasters.forEach((m) =>
            console.log(`             |   leak: ${(m.size / 1024).toFixed(1)} KB  ${m.url}`),
        );
    }
    await ctx.close();
}

await browser.close();
