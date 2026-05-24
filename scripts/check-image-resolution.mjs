// Defensive measure: detect images whose natural resolution is significantly
// smaller than the CSS-rendered size × DPR — i.e. visible quality regressions.
//
// Run after deploys. Flags any image where the chosen variant is being
// upscaled by > 1.5× from its natural width.
//
// Usage: node scripts/check-image-resolution.mjs [--url=...] [--device=desktop|iphone-14]

import { chromium, webkit, devices } from "@playwright/test";

const args = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((a) => a.startsWith("--"))
        .map((a) => {
            const [k, v] = a.slice(2).split("=");
            return [k, v ?? true];
        }),
);

const DEFAULT_PAGES = [
    "https://saleid.icu/",
    "https://saleid.icu/shop/yoga",
    "https://saleid.icu/about",
    "https://saleid.icu/product/sport-1",
];

const PROFILES = {
    "desktop-1080-retina": {
        engine: chromium,
        contextOptions: {
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 2,
        },
        label: "Desktop 1920×1080 DPR 2 (Retina)",
    },
    "desktop-4k-retina": {
        engine: chromium,
        contextOptions: {
            viewport: { width: 3840, height: 2160 },
            deviceScaleFactor: 2,
        },
        label: "Desktop 4K DPR 2",
    },
    "iphone-14": {
        engine: webkit,
        contextOptions: devices["iPhone 14"],
        label: "iPhone 14 (WebKit, DPR 3)",
    },
    "ipad-mini": {
        engine: webkit,
        contextOptions: devices["iPad Mini"],
        label: "iPad Mini (WebKit, DPR 2)",
    },
};

const profileKey = args.device || "desktop-1080-retina";
const profile = PROFILES[profileKey];
if (!profile) {
    console.error(`Unknown device: ${profileKey}. Choices: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
}
const pages = args.url ? [args.url] : DEFAULT_PAGES;

console.log(`\n=== Image Resolution Check ===`);
console.log(`Profile: ${profile.label}`);
console.log(`Pages: ${pages.length}\n`);

const browser = await profile.engine.launch();
let flagCount = 0;

for (const url of pages) {
    const ctx = await browser.newContext(profile.contextOptions);
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Measure every <img> on the page: CSS box × DPR vs natural intrinsic size.

    const report = await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        const dpr = window.devicePixelRatio || 1;
        // eslint-disable-next-line no-undef
        return Array.from(document.images).map((img) => {
            const rect = img.getBoundingClientRect();
            const cssW = rect.width;
            const cssH = rect.height;
            const naturalW = img.naturalWidth;
            const naturalH = img.naturalHeight;
            const wantW = Math.round(cssW * dpr);
            const ratio = naturalW > 0 ? wantW / naturalW : 0;
            return {
                src: img.currentSrc || img.src,
                cssW: Math.round(cssW),
                cssH: Math.round(cssH),
                naturalW,
                naturalH,
                wantW,
                dpr,
                ratio: ratio.toFixed(2),
                upscale: ratio > 1.5,
            };
        });
    });

    // Skip tiny images (< 100px CSS) and broken ones.
    const visible = report.filter((r) => r.cssW > 100 && r.naturalW > 0);
    const flagged = visible.filter((r) => r.upscale);

    console.log(`[${url}]`);
    if (flagged.length === 0) {
        console.log(`  ✓ ${visible.length} images, none upscaled > 1.5×\n`);
    } else {
        console.log(`  ⚠️  ${flagged.length} of ${visible.length} images upscaled (quality loss):`);
        flagged.forEach((r) => {
            const fname = r.src.split("/").pop()?.split("?")[0] || r.src;
            console.log(
                `     ${r.ratio}× — ${fname} (rendered ${r.cssW}×${r.cssH} @DPR${r.dpr} = needs ${r.wantW}w, natural ${r.naturalW}w)`,
            );
            flagCount++;
        });
        console.log("");
    }
    await ctx.close();
}

await browser.close();

if (flagCount > 0) {
    console.log(`\n❌ TOTAL: ${flagCount} quality flags. Investigate srcset / sizes attrs.`);
    process.exit(1);
} else {
    console.log(`\n✓ All visible images render at ≥ 1× native resolution. No upscale detected.`);
}
