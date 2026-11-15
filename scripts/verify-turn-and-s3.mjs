import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR =
    "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Test Slide 3 safe zone
    await page.goto("http://localhost:3000/?hero=s3", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({
        path: path.join(ARTIFACT_DIR, "fable_desktop_1440_03_trio_tricolor_triad.png"),
    });
    console.log("Captured refined Slide 3 desktop");

    // 2. Test Slide 1 Turn mechanism
    await page.goto("http://localhost:3000/?hero=s1", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Click "ПЕРЕД" turn button
    const frontBtn = await page.$('.hero-turn-btn:has-text("ПЕРЕД")');
    if (frontBtn) {
        await frontBtn.click();
        await page.waitForTimeout(800); // Wait for clip-path curtain
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "fable_desktop_1440_01_turn_front_verified.png"),
        });
        console.log("Captured Turn FRONT view");
    }

    await browser.close();
    console.log("Turn verification complete!");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
