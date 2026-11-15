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

    await page.goto("http://localhost:3000/?hero=s1", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Click "СПИНА"
    const backBtn = await page.$('.hero-turn-switch__btn:has-text("СПИНА")');
    if (backBtn) {
        await backBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "fable_desktop_1440_01_turn_back_verified.png"),
        });
        console.log("Captured Turn BACK full view!");
    }

    await browser.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
