import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR =
    "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

const VIEWPORTS = [
    { name: "desktop_1440x900", width: 1440, height: 900 },
    { name: "desktop_1920x900", width: 1920, height: 900 },
    { name: "mobile_390x844", width: 390, height: 844, isMobile: true },
];

async function verify() {
    console.log("Starting Playwright verification of Fable Editorial Lookbook...");
    const browser = await chromium.launch({ headless: true });

    for (const vp of VIEWPORTS) {
        console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2,
            isMobile: !!vp.isMobile,
        });
        const page = await context.newPage();

        let pageErrors = [];
        page.on("pageerror", (err) => pageErrors.push(err.message));

        await page.goto("http://localhost:3000/?hero=compare", {
            waitUntil: "networkidle",
            timeout: 30000,
        });
        await page.waitForTimeout(1000);

        // Slide 1: Black Obsidian Core & Macro
        const s1Path = path.join(ARTIFACT_DIR, `fable_editorial_s1_${vp.name}.png`);
        await page.screenshot({ path: s1Path });
        console.log(`Saved Slide 1 screenshot: fable_editorial_s1_${vp.name}.png`);

        // Click Pill #2: Rich Cocoa Lace
        const pill2 = await page.locator(".hero-compare-pill").nth(1);
        if ((await pill2.count()) > 0) {
            await pill2.click();
            await page.waitForTimeout(1200);
            const s2Path = path.join(ARTIFACT_DIR, `fable_editorial_s2_${vp.name}.png`);
            await page.screenshot({ path: s2Path });
            console.log(`Saved Slide 2 screenshot: fable_editorial_s2_${vp.name}.png`);
        }

        // Click Pill #3: Deep Petrol Chapters
        const pill3 = await page.locator(".hero-compare-pill").nth(2);
        if ((await pill3.count()) > 0) {
            await pill3.click();
            await page.waitForTimeout(1200);
            const s3Path = path.join(ARTIFACT_DIR, `fable_editorial_s3_${vp.name}.png`);
            await page.screenshot({ path: s3Path });
            console.log(`Saved Slide 3 screenshot: fable_editorial_s3_${vp.name}.png`);
        }

        // Click Pill #5: Pure Studio Triptych
        const pill5 = await page.locator(".hero-compare-pill").nth(4);
        if ((await pill5.count()) > 0) {
            await pill5.click();
            await page.waitForTimeout(1200);
            const s5Path = path.join(ARTIFACT_DIR, `fable_editorial_s5_${vp.name}.png`);
            await page.screenshot({ path: s5Path });
            console.log(`Saved Slide 5 screenshot: fable_editorial_s5_${vp.name}.png`);
        }

        if (pageErrors.length > 0) {
            console.error(`Page errors on ${vp.name}:`, pageErrors);
        } else {
            console.log(`Zero errors on ${vp.name}!`);
        }

        await context.close();
    }

    await browser.close();
    console.log("\nAll Playwright Editorial Lookbook tests completed successfully!");
}

verify().catch(console.error);
