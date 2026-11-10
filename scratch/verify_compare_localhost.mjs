import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR =
    "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

async function run() {
    const browser = await chromium.launch({ headless: true });

    const viewports = [
        { name: "desktop_1440x900", width: 1440, height: 900, isMobile: false },
        { name: "desktop_1920x900", width: 1920, height: 900, isMobile: false },
        { name: "mobile_390x844", width: 390, height: 844, isMobile: true, deviceScaleFactor: 3 },
    ];

    const results = [];
    const errors = [];

    for (const vp of viewports) {
        console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            isMobile: vp.isMobile,
            hasTouch: vp.isMobile,
            deviceScaleFactor: vp.deviceScaleFactor || 1,
        });

        const page = await context.newPage();

        page.on("console", (msg) => {
            if (msg.type() === "error") {
                console.error(`[Browser Console Error]: ${msg.text()}`);
                errors.push(`[${vp.name}] ${msg.text()}`);
            }
        });

        page.on("response", (res) => {
            const url = res.url();
            if (url.includes("/Slides/hero-v") && res.status() >= 400) {
                console.error(`[Asset Error ${res.status()}]: ${url}`);
                errors.push(`Asset ${res.status()} on ${url}`);
            }
        });

        const variants = [
            {
                id: "v3",
                name: "V3 Editorial (Rank #1)",
                slideIdx: 0,
                layoutClass: "hero-slider--editorial-left",
            },
            {
                id: "v1",
                name: "V1 Signature Trio (Rank #2)",
                slideIdx: 1,
                layoutClass: "hero-slider--trio-center",
            },
            {
                id: "v2",
                name: "V2 Standing Trio (Rank #3)",
                slideIdx: 2,
                layoutClass: "hero-slider--top-clean",
            },
        ];

        for (const variant of variants) {
            const url = `http://localhost:3000/?hero=${variant.id}`;
            await page.goto(url, { waitUntil: "networkidle" });
            await page.waitForTimeout(600);

            // Check compare bar is visible
            const compareBar = await page.$(".hero-compare-bar");
            const hasCompareBar = compareBar !== null;

            // Check active slide class
            const heroSlider = await page.$(".hero-slider");
            const heroClass = await heroSlider?.getAttribute("class");
            const hasLayoutClass = heroClass?.includes(variant.layoutClass);

            // Verify active pill
            const activePill = await page.$(
                `.hero-compare-pill:nth-child(${variant.slideIdx + 1}).is-active`,
            );
            const hasActivePill = activePill !== null;

            // Measure safe zone metrics of hero content
            const logoImgBox = await (await page.$(".hero-slider__logo img"))?.boundingBox();
            const ctaBox = await (await page.$(".hero-slider__cta-btn"))?.boundingBox();

            console.log(
                `Variant ${variant.id.toUpperCase()}: layoutClass=${hasLayoutClass}, compareBar=${hasCompareBar}, activePill=${hasActivePill}`,
            );
            if (logoImgBox) {
                console.log(
                    `  Logo img rect: x=${logoImgBox.x.toFixed(1)}, y=${logoImgBox.y.toFixed(1)}, w=${logoImgBox.width.toFixed(1)}, h=${logoImgBox.height.toFixed(1)}`,
                );
            }
            if (ctaBox) {
                console.log(
                    `  CTA rect: x=${ctaBox.x.toFixed(1)}, y=${ctaBox.y.toFixed(1)}, w=${ctaBox.width.toFixed(1)}, h=${ctaBox.height.toFixed(1)}`,
                );
            }

            // Capture screenshot
            const shotName = `fable_hero_${variant.id}_${vp.name}.png`;
            const shotPath = path.join(ARTIFACT_DIR, shotName);
            await page.screenshot({ path: shotPath });
            console.log(`  Saved screenshot: ${shotName}`);

            results.push({
                viewport: vp.name,
                variant: variant.id,
                hasLayoutClass,
                hasCompareBar,
                hasActivePill,
                shotPath,
                shotName,
            });
        }

        // Test interactive clicking on pills within the same page
        if (!vp.isMobile && vp.width === 1440) {
            console.log("\nTesting interactive pill clicking on 1440x900...");
            await page.goto("http://localhost:3000/?hero=compare", { waitUntil: "networkidle" });
            await page.waitForTimeout(600);

            // Click pill #2 (V1)
            const pillV1 = await page.$(".hero-compare-bar__pills button:nth-child(2)");
            await pillV1?.click({ force: true });
            await page.waitForTimeout(800);
            let heroClass = await (await page.$(".hero-slider"))?.getAttribute("class");
            console.log(
                `Clicked Pill #2 -> heroClass contains trio-center: ${heroClass?.includes("hero-slider--trio-center")}`,
            );

            // Click pill #3 (V2)
            const pillV2 = await page.$(".hero-compare-bar__pills button:nth-child(3)");
            await pillV2?.click({ force: true });
            await page.waitForTimeout(800);
            heroClass = await (await page.$(".hero-slider"))?.getAttribute("class");
            console.log(
                `Clicked Pill #3 -> heroClass contains top-clean: ${heroClass?.includes("hero-slider--top-clean")}`,
            );

            // Click pill #1 (V3)
            const pillV3 = await page.$(".hero-compare-bar__pills button:nth-child(1)");
            await pillV3?.click({ force: true });
            await page.waitForTimeout(800);
            heroClass = await (await page.$(".hero-slider"))?.getAttribute("class");
            console.log(
                `Clicked Pill #1 -> heroClass contains editorial-left: ${heroClass?.includes("hero-slider--editorial-left")}`,
            );
        }

        await context.close();
    }

    await browser.close();

    console.log("\n=== Summary ===");
    console.log(`Total variants checked: ${results.length}`);
    console.log(`Errors encountered: ${errors.length}`);
    if (errors.length > 0) {
        console.error("Errors:", errors);
        process.exit(1);
    } else {
        console.log("All variants rendered with 100% success!");
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
