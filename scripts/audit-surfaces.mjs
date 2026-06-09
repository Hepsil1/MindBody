// One-off audit: captures every surface user asked about.
// Cart + wishlist need localStorage seeding before nav.
import { webkit, devices } from "@playwright/test";

const browser = await webkit.launch();

async function snap(name, navAsync, postAsync) {
    const ctx = await browser.newContext(devices["iPhone 14"]);
    const page = await ctx.newPage();
    if (navAsync) await navAsync(page);
    if (postAsync) await postAsync(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `audit-${name}.png`, fullPage: false });
    console.log("✓", name);
    await ctx.close();
}

// Helper: seed wishlist / cart in localStorage before nav.
const SEEDED_CART = JSON.stringify([
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
    {
        id: "203a389c-96cb-425d-b646-2a8273c41fd7",
        name: "Шорти FLEX",
        price: 790,
        image: "/pics1cloths/IMG_6203.webp",
        category: "yoga",
        size: "S",
        color: "black",
        quantity: 2,
    },
]);
const SEEDED_WISHLIST = JSON.stringify([
    {
        id: "38b651f2-e1ac-4d58-b7f1-ff10598db201",
        name: "Лонгслів CALM",
        price: 1190,
        image: "/pics1cloths/IMG_6201.webp",
        category: "yoga",
    },
    {
        id: "203a389c-96cb-425d-b646-2a8273c41fd7",
        name: "Шорти FLEX",
        price: 790,
        image: "/pics1cloths/IMG_6203.webp",
        category: "yoga",
    },
]);

// 1. Cart with items (checkout step=cart)
await snap("cart-with-items", async (page) => {
    await page.goto("https://saleid.icu", { waitUntil: "domcontentloaded" });
    await page.evaluate((c) => {
        // eslint-disable-next-line no-undef
        localStorage.setItem("cart", c);
    }, SEEDED_CART);
    await page.goto("https://saleid.icu/checkout", { waitUntil: "networkidle", timeout: 30000 });
});

// 2. Wishlist with items
await snap("wishlist-with-items", async (page) => {
    await page.goto("https://saleid.icu", { waitUntil: "domcontentloaded" });
    await page.evaluate((w) => {
        // eslint-disable-next-line no-undef
        localStorage.setItem("wishlist", w);
    }, SEEDED_WISHLIST);
    await page.goto("https://saleid.icu/wishlist", { waitUntil: "networkidle", timeout: 30000 });
});

// 3. Auth login + register
await snap("auth-login", async (page) => {
    await page.goto("https://saleid.icu/auth", { waitUntil: "networkidle", timeout: 30000 });
});
await snap(
    "auth-register",
    async (page) => {
        await page.goto("https://saleid.icu/auth", { waitUntil: "networkidle", timeout: 30000 });
    },
    async (page) => {
        // try to click "Реєстрація" tab if visible
        const tab = page.getByText(/реєстрац/i).first();
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tab.click();
            await page.waitForTimeout(500);
        }
    },
);

// 4. About: full scroll segments — top hero, story-premium, process cards, footer
async function snapFullPage(name, url) {
    const ctx = await browser.newContext(devices["iPhone 14"]);
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `audit-${name}.png`, fullPage: true });
    console.log("✓", name);
    await ctx.close();
}
await snapFullPage("about-full", "https://saleid.icu/about");

// 5. Mobile header — open menu state
await snap(
    "header-menu-open",
    async (page) => {
        await page.goto("https://saleid.icu", { waitUntil: "networkidle", timeout: 30000 });
    },
    async (page) => {
        const burger = page.locator(".header__burger").first();
        if (await burger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await burger.click();
            await page.waitForTimeout(500);
        }
    },
);

// 6. Footer — scroll home to footer
await snap(
    "footer",
    async (page) => {
        await page.goto("https://saleid.icu", { waitUntil: "networkidle", timeout: 30000 });
    },
    async (page) => {
        // eslint-disable-next-line no-undef
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(800);
    },
);

await browser.close();
console.log("\nAll 7 screenshots saved.");
