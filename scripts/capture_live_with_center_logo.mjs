import { chromium } from "playwright";
import path from "path";

const artifactDir = "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

async function run() {
    const browser = await chromium.launch({ headless: true });

    // 1. Desktop (1440x900)
    console.log("Testing Desktop 1440x900...");
    const dContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
    });
    const dPage = await dContext.newPage();
    await dPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await dPage.waitForSelector(".slook");

    try {
        const acceptBtn = await dPage.$('button:has-text("ПРИЙНЯТИ")');
        if (acceptBtn) {
            await acceptBtn.click();
            await dPage.waitForTimeout(400);
        }
    } catch {}

    const dButtons = await dPage.$$(".slook__timeline-btn");
    console.log(`Desktop: Found ${dButtons.length} timeline buttons`);

    for (let i = 0; i < dButtons.length; i++) {
        await dButtons[i].click();
        await dPage.waitForTimeout(800);
        const outPath = path.join(
            artifactDir,
            `live_verified_center_logo_slide_${i + 1}_1440x900.png`,
        );
        await dPage.screenshot({ path: outPath, fullPage: false });
        console.log(`Desktop Slide ${i + 1} captured to ${outPath}`);
    }

    // 2. Mobile (390x844)
    console.log("Testing Mobile 390x844...");
    const mContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
    });
    const mPage = await mContext.newPage();
    await mPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await mPage.waitForSelector(".slook");

    try {
        const acceptBtn = await mPage.$('button:has-text("ПРИЙНЯТИ")');
        if (acceptBtn) {
            await acceptBtn.click();
            await mPage.waitForTimeout(400);
        }
    } catch {}

    const mButtons = await mPage.$$(".slook__timeline-btn");
    console.log(`Mobile: Found ${mButtons.length} timeline buttons`);

    for (let i = 0; i < mButtons.length; i++) {
        await mButtons[i].click();
        await mPage.waitForTimeout(800);
        const outPath = path.join(
            artifactDir,
            `live_verified_center_logo_mobile_slide_${i + 1}_390x844.png`,
        );
        await mPage.screenshot({ path: outPath, fullPage: false });
        console.log(`Mobile Slide ${i + 1} captured to ${outPath}`);
    }

    await browser.close();
    console.log("All live screenshots captured successfully!");
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
