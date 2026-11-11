import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const ARTIFACT_DIR =
    "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";

const VIEWPORTS = [
    { name: "desktop_1440", width: 1440, height: 900 },
    { name: "ultrawide_1920", width: 1920, height: 900 },
    { name: "mobile_390", width: 390, height: 844 },
];

const SLIDES = [
    { id: "s1", name: "01_solo_plum_laced_back" },
    { id: "s2", name: "02_duo_studio_campaign" },
    { id: "s3", name: "03_trio_tricolor_triad" },
    { id: "s4", name: "04_macro_tactile_lens" },
    { id: "s5", name: "05_espresso_runway_fur" },
];

async function main() {
    const browser = await chromium.launch({ headless: true });

    for (const vp of VIEWPORTS) {
        console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2, // Retina 2x rendering
        });
        const page = await context.newPage();

        for (const slide of SLIDES) {
            const url = `http://localhost:3000/?hero=${slide.id}`;
            await page.goto(url, { waitUntil: "networkidle" });

            // Wait for hero element
            await page.waitForSelector(".fable-luxury-hero");

            // Dismiss cookie banner if present
            try {
                const cookieBtn = await page.$(
                    'button:has-text("ЛИШЕ НЕОБХІДНІ"), button:has-text("ПРИЙНЯТИ")',
                );
                if (cookieBtn) {
                    await cookieBtn.click();
                    await page.waitForTimeout(200);
                }
            } catch {}

            // Allow CSS transitions and images to fully render
            await page.waitForTimeout(600);

            // If it's macro slide, simulate pointer move to test Dual-Focus Lens
            if (slide.id === "s4") {
                const stage = await page.$(".hero__stage--macro");
                if (stage) {
                    const box = await stage.boundingBox();
                    if (box) {
                        // Move cursor over lacing region (center-right)
                        await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.42);
                        await page.waitForTimeout(300);
                    }
                }
            }

            const filename = `fable_${vp.name}_${slide.name}.png`;
            const outPath = path.join(ARTIFACT_DIR, filename);
            await page.screenshot({ path: outPath });
            console.log(`Saved screenshot: ${filename}`);
        }
        await context.close();
    }

    await browser.close();
    console.log("\nAll visual verifications completed successfully!");
}

main().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
