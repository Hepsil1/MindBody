import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR =
    "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

async function main() {
    const browser = await chromium.launch({ headless: true });

    // Test 1: Desktop 1440x900 - Rest / Default Active Look 01 (The Duo)
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
            path: path.join(ARTIFACT_DIR, "runway_1440_01_the_duo_lineup.png"),
            fullPage: false,
        });
        console.log("Captured 1440x900 Look 01 (The Duo in Lineup Mode)");

        // Test 2: Hover over Look 02 (Sculpted Plum)
        const colPlum = page.locator(".runway-col").nth(1);
        await colPlum.hover();
        await page.waitForTimeout(700);

        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "runway_1440_02_sculpted_front.png"),
            fullPage: false,
        });
        console.log("Captured 1440x900 Look 02 (Sculpted Front)");

        // Click [ СПИНА ]
        const backBtn = page.locator(".runway-turn-btn:has-text('Спина')");
        if ((await backBtn.count()) > 0) {
            await backBtn.first().click();
            await page.waitForTimeout(500);
            await page.screenshot({
                path: path.join(ARTIFACT_DIR, "runway_1440_02_sculpted_back.png"),
                fullPage: false,
            });
            console.log("Captured 1440x900 Look 02 (Sculpted Back)");
        }

        // Test 3: Hover over Look 04 (Petrol Lacing) & activate 2.4x Loupe
        const colPetrol = page.locator(".runway-col").nth(3);
        await colPetrol.hover();
        await page.waitForTimeout(700);

        const loupeBtn = page.locator(".runway-lens-toggle");
        if ((await loupeBtn.count()) > 0) {
            await loupeBtn.first().click();
            // Move mouse over the column to position loupe
            await page.mouse.move(800, 450);
            await page.waitForTimeout(400);
            await page.screenshot({
                path: path.join(ARTIFACT_DIR, "runway_1440_04_petrol_loupe.png"),
                fullPage: false,
            });
            console.log("Captured 1440x900 Look 04 (Petrol 2.4x Loupe)");
        }

        // Test 4: Switch to Cinematic Fullscreen Mode [ На весь екран ]
        const cinematicBtn = page.locator(".runway-mode-btn:has-text('На весь екран')");
        if ((await cinematicBtn.count()) > 0) {
            await cinematicBtn.first().click();
            await page.waitForTimeout(800);
            await page.screenshot({
                path: path.join(ARTIFACT_DIR, "runway_1440_cinematic_fullscreen.png"),
                fullPage: false,
            });
            console.log("Captured 1440x900 Cinematic Fullscreen Mode");
        }

        await context.close();
    }

    // Test 5: Ultrawide 1920x900
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
            path: path.join(ARTIFACT_DIR, "runway_1920_ultrawide_lineup.png"),
            fullPage: false,
        });
        console.log("Captured 1920x900 Ultrawide Lineup");
        await context.close();
    }

    // Test 6: Mobile iPhone 390x844
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
            path: path.join(ARTIFACT_DIR, "runway_mobile_390_01_duo.png"),
            fullPage: false,
        });
        console.log("Captured Mobile 390x844 Look 01 (Duo)");

        // Scroll/swipe to look 02
        const slider = page.locator(".runway-mobile");
        await slider.evaluate((el) => {
            el.scrollTo({ left: 390, behavior: "instant" });
        });
        await page.waitForTimeout(500);

        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "runway_mobile_390_02_sculpted.png"),
            fullPage: false,
        });
        console.log("Captured Mobile 390x844 Look 02 (Sculpted)");

        await context.close();
    }

    await browser.close();
    console.log("All Playwright verification screenshots completed successfully!");
}

main().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
