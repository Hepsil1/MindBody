// Full walkthrough audit. Capture each surface fullPage for honest review.
import { webkit, devices } from "@playwright/test";

const browser = await webkit.launch();
const pages = [
    { name: "wt-home", url: "https://saleid.icu/" },
    { name: "wt-shop-yoga", url: "https://saleid.icu/shop/yoga" },
    { name: "wt-pdp", url: "https://saleid.icu/product/38b651f2-e1ac-4d58-b7f1-ff10598db201" },
    { name: "wt-about", url: "https://saleid.icu/about" },
    { name: "wt-checkout", url: "https://saleid.icu/checkout" },
    { name: "wt-wishlist", url: "https://saleid.icu/wishlist" },
    { name: "wt-auth", url: "https://saleid.icu/auth" },
];

// Pre-seed cart + wishlist for richer screenshots.
const CART = JSON.stringify([
    {
        id: "38b651f2-e1ac-4d58-b7f1-ff10598db201",
        name: "Лонгслів CALM",
        price: 1190,
        image: "/pics1cloths/IMG_6201.webp",
        category: "yoga",
        size: "M",
        color: "marsala",
        quantity: 1,
    },
]);
const WISH = JSON.stringify([
    {
        id: "38b651f2-e1ac-4d58-b7f1-ff10598db201",
        name: "Лонгслів CALM",
        price: 1190,
        image: "/pics1cloths/IMG_6201.webp",
        category: "yoga",
    },
]);

for (const p of pages) {
    const ctx = await browser.newContext(devices["iPhone 14"]);
    const page = await ctx.newPage();
    if (p.url === "https://saleid.icu/checkout" || p.url === "https://saleid.icu/wishlist") {
        await page.goto("https://saleid.icu", { waitUntil: "domcontentloaded" });
        await page.evaluate(
            ({ c, w }) => {
                // eslint-disable-next-line no-undef
                localStorage.setItem("cart", c);
                // eslint-disable-next-line no-undef
                localStorage.setItem("wishlist", w);
            },
            { c: CART, w: WISH },
        );
    }
    try {
        await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
        // continue
    }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${p.name}.png`, fullPage: true });
    console.log("✓", p.name);
    await ctx.close();
}

await browser.close();
