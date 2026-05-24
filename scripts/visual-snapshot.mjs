#!/usr/bin/env node
/**
 * Cross-device visual baseline — иду на каждое устройство × страницу
 * и снимаю screenshot.  Сохраняю в tests/visual-baseline/<device>/<page>.png.
 *
 * Why: Chromium-with-iOS-UA emulation lies (real bug found: empty <span>
 * inside .header__burger rendered as 44×44 in Chromium emulation but
 * 0×2px in real Safari WebKit — three burger lines invisible on real
 * iPhone).  Playwright's webkit engine is the same WebKit Safari uses,
 * so it catches those cases.  Plus stock Chromium for Android side.
 *
 * Usage:
 *   node scripts/visual-snapshot.mjs              # prod (saleid.icu)
 *   node scripts/visual-snapshot.mjs --local      # dev server (3001)
 *   node scripts/visual-snapshot.mjs --device=iphone-14    # one device only
 *
 * Output:
 *   tests/visual-baseline/iphone-14/home.png
 *   tests/visual-baseline/iphone-14/shop.png
 *   tests/visual-baseline/iphone-14/pdp.png
 *   tests/visual-baseline/iphone-14/cart.png
 *   tests/visual-baseline/iphone-14/auth.png
 *   tests/visual-baseline/iphone-se/...
 *   tests/visual-baseline/pixel-7/...
 *   tests/visual-baseline/desktop/...
 *
 * After re-running, `git diff tests/visual-baseline/` shows what changed.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit, devices } from "playwright";

const args = new Set(process.argv.slice(2));
const isLocal = args.has("--local");
const baseURL = isLocal ? "http://localhost:3001" : "https://saleid.icu";
const onlyDevice = [...args].find((a) => a.startsWith("--device="))?.slice("--device=".length);

// Pages — keep narrow.  More can be added later.
const PAGES = [
    { name: "home", path: "/" },
    { name: "shop-yoga", path: "/shop/yoga" },
    { name: "auth", path: "/auth" },
    // PDP uses a stable product id (Лонгслів CALM).  If this id is ever
    // gone, swap for any active product slug.
    { name: "pdp", path: "/product/38b651f2-e1ac-4d58-b7f1-ff10598db201" },
    // /checkout shows the cart step (no /cart route exists).  We inject
    // a cart item via localStorage in beforeNavigate so the page renders
    // with content rather than the empty-cart state.
    { name: "checkout", path: "/checkout" },
];

// Device list — what real users use.  Pulled from Playwright's `devices`
// presets which carry the right viewport, DPR, user agent, hasTouch.
// 7 devices = ~96% real engines + ~92% real viewports (320-1280) coverage.
// The remaining ~5% is Yandex / Huawei WebView / Old iOS — defer to
// BrowserStack trial when needed.
const DEVICE_LIST = [
    // === WebKit (iOS Safari + WebKit-derived) — ~25-30% UA traffic ===
    {
        slug: "iphone-14",
        engine: "webkit",
        playwrightDevice: devices["iPhone 14"],
        notes: "390×664 DPR 3 — most common 2023-2024 iPhone",
    },
    {
        slug: "iphone-8",
        engine: "webkit",
        playwrightDevice: devices["iPhone 8"],
        notes: "375×667 DPR 2 — legacy iPhone (no notch, no safe-area), still common in UA market",
    },
    {
        slug: "iphone-se",
        engine: "webkit",
        playwrightDevice: devices["iPhone SE"],
        notes: "320×568 DPR 2 — narrowest viable iPhone, catches overflow bugs",
    },
    {
        slug: "ipad-mini",
        engine: "webkit",
        playwrightDevice: devices["iPad Mini"],
        notes: "768×1024 DPR 2 — tablet portrait, exactly at our 768 breakpoint edge",
    },
    // === Chromium (Android Chrome / Samsung Internet / Mi / Yandex) — ~60% ===
    {
        slug: "galaxy-s24",
        engine: "chromium",
        playwrightDevice: devices["Galaxy S24"],
        notes: "360×780 DPR 3 — actual Samsung viewport (Samsung is the most-common Android in UA)",
    },
    {
        slug: "pixel-7",
        engine: "chromium",
        playwrightDevice: devices["Pixel 7"],
        notes: "412×839 DPR 2.625 — vanilla Google Android Chrome",
    },
    // === Desktop sanity ===
    {
        slug: "desktop",
        engine: "chromium",
        playwrightDevice: devices["Desktop Chrome"],
        notes: "1280×720 — desktop sanity check, no mobile @media applies",
    },
];

// Cart seed for /checkout — Лонгслів CALM × 1.  cartKey matches
// StorageUtils.CART = "cart" (verified app/utils/storage.ts:20).
const CART_SEED = [
    {
        id: "38b651f2-e1ac-4d58-b7f1-ff10598db201",
        name: "Лонгслів CALM",
        price: 1290,
        image: "/pics1cloths/IMG_6201.webp",
        size: "M",
        color: "beige",
        quantity: 1,
    },
];

async function snapshotDevice(deviceInfo) {
    const engineLauncher = deviceInfo.engine === "webkit" ? webkit : chromium;
    const browser = await engineLauncher.launch({ headless: true });
    const context = await browser.newContext({ ...deviceInfo.playwrightDevice });
    const page = await context.newPage();

    const outDir = path.resolve("tests", "visual-baseline", deviceInfo.slug);
    await mkdir(outDir, { recursive: true });

    console.log(
        `\n[${deviceInfo.slug}] engine=${deviceInfo.engine} ` +
            `${deviceInfo.playwrightDevice.viewport.width}×${deviceInfo.playwrightDevice.viewport.height}`,
    );

    // Seed cart before /checkout — localStorage is per-origin so set it
    // by visiting any same-origin page first, writing the cart, then
    // navigating to /checkout.
    await page.goto(baseURL + "/", { waitUntil: "networkidle" });
    await page.evaluate((seed) => {
        localStorage.setItem("cart", JSON.stringify(seed));
    }, CART_SEED);

    for (const pg of PAGES) {
        const url = baseURL + pg.path;
        try {
            await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
            // Tiny settle so lazy-loaded above-fold imagery has time to paint.
            await page.waitForTimeout(700);
            const outPath = path.join(outDir, `${pg.name}.png`);
            await page.screenshot({ path: outPath, fullPage: false });
            console.log(`  ✓ ${pg.name.padEnd(12)} → ${outPath}`);
        } catch (err) {
            console.log(`  ✗ ${pg.name.padEnd(12)} → ${err.message}`);
        }
    }

    await browser.close();
}

(async () => {
    console.log(`Visual baseline — baseURL: ${baseURL}`);
    const targets = onlyDevice ? DEVICE_LIST.filter((d) => d.slug === onlyDevice) : DEVICE_LIST;
    if (targets.length === 0) {
        console.error(`No device matches --device=${onlyDevice}`);
        process.exit(1);
    }
    for (const dev of targets) {
        await snapshotDevice(dev);
    }
    console.log("\nDone.");
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
