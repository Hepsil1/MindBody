import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR =
    "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

async function main() {
    const browser = await chromium.launch({ headless: true });

    // Test 1: Desktop 1440x900 - Issue 01 (The Duo)
    {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

        // Dismiss cookie banner if present
        const cookieBtn = page.locator("button:has-text('Зрозуміло'), button:has-text('Прийняти')");
        if ((await cookieBtn.count()) > 0) {
            await cookieBtn
                .first()
                .click()
                .catch(() => {});
        }
        await page.waitForTimeout(600);

        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "issue_1440_01_the_duo.png"),
            fullPage: false,
        });
        console.log("Captured 1440x900 Issue 01 (The Duo)");

        // Test 2: Click peel corner to flip to Issue 02
        const peelBtn = page.locator(".issue-peel-corner");
        if ((await peelBtn.count()) > 0) {
            await peelBtn.click();
            await page.waitForTimeout(800);
            await page.screenshot({
                path: path.join(ARTIFACT_DIR, "issue_1440_02_sculpted_front.png"),
                fullPage: false,
            });
            console.log("Captured 1440x900 Issue 02 (Sculpted Front)");

            // Click [ СПИНА ] on Issue 02
            const backBtn = page.locator(".issue-turn-btn:has-text('Спина')");
            if ((await backBtn.count()) > 0) {
                await backBtn.click();
                await page.waitForTimeout(500);
                await page.screenshot({
                    path: path.join(ARTIFACT_DIR, "issue_1440_02_sculpted_back.png"),
                    fullPage: false,
                });
                console.log("Captured 1440x900 Issue 02 (Sculpted Back)");
            }
        }

        // Test 3: Jump to Issue 04 via Nav
        const navItem4 = page.locator(".issue-nav-item").nth(3);
        if ((await navItem4.count()) > 0) {
            await navItem4.click();
            await page.waitForTimeout(800);
            await page.screenshot({
                path: path.join(ARTIFACT_DIR, "issue_1440_04_espresso_fur.png"),
                fullPage: false,
            });
            console.log("Captured 1440x900 Issue 04 (Espresso Fur)");
        }

        await context.close();
    }

    // Test 4: Ultrawide 1920x900
    {
        const context = await browser.newContext({ viewport: { width: 1920, height: 900 } });
        const page = await context.newPage();
        await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
        const cookieBtn = page.locator("button:has-text('Зрозуміло'), button:has-text('Прийняти')");
        if ((await cookieBtn.count()) > 0) {
            await cookieBtn
                .first()
                .click()
                .catch(() => {});
        }
        await page.waitForTimeout(600);

        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "issue_1920_ultrawide_duo.png"),
            fullPage: false,
        });
        console.log("Captured 1920x900 Ultrawide Issue 01");
        await context.close();
    }

    // Test 5: Mobile iPhone 390x844
    {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            userAgent:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            isMobile: true,
            hasTouch: true,
        });
        const page = await context.newPage();
        await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
        const cookieBtn = page.locator("button:has-text('Зрозуміло'), button:has-text('Прийняти')");
        if ((await cookieBtn.count()) > 0) {
            await cookieBtn
                .first()
                .click()
                .catch(() => {});
        }
        await page.waitForTimeout(600);

        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "issue_mobile_390_01_duo.png"),
            fullPage: false,
        });
        console.log("Captured Mobile 390x844 Issue 01 (Duo)");

        // Flip to Issue 02 on mobile
        const peelBtn = page.locator(".issue-peel-corner");
        if ((await peelBtn.count()) > 0) {
            await peelBtn.click();
            await page.waitForTimeout(800);
            await page.screenshot({
                path: path.join(ARTIFACT_DIR, "issue_mobile_390_02_sculpted.png"),
                fullPage: false,
            });
            console.log("Captured Mobile 390x844 Issue 02 (Sculpted)");
        }

        await context.close();
    }

    await browser.close();
    console.log("All Issue Cover Hero verifications completed successfully!");
}

main().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
