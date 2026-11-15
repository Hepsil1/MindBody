import { chromium } from "playwright";
import path from "path";

const artifactDir = "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
    });
    const page = await context.newPage();

    console.log("Navigating to http://localhost:3000/ ...");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

    // Wait for hero to be visible
    await page.waitForSelector(".slook");

    // Accept cookies if present to get clean view
    try {
        const acceptBtn = await page.$('button:has-text("ПРИЙНЯТИ")');
        if (acceptBtn) {
            await acceptBtn.click();
            await page.waitForTimeout(500);
        }
    } catch {}

    // Find timeline dots or slides
    const buttons = await page.$$(".slook__timeline-btn");
    console.log(`Found ${buttons.length} timeline buttons`);

    for (let i = 0; i < buttons.length; i++) {
        await buttons[i].click();
        await page.waitForTimeout(800); // Wait for transition
        const outPath = path.join(artifactDir, `live_verified_mobile_slide_${i + 1}_390x844.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`Captured slide ${i + 1} to ${outPath}`);
    }

    await browser.close();
    console.log("All mobile slides captured!");
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
