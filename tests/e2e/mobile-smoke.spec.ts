import { test, expect } from "@playwright/test";

/**
 * Mobile-viewport smoke tests. Runs ONLY under the "Mobile Chrome"
 * project (Pixel 7, 412x915) — see playwright.config.ts.
 *
 * Locks down the two regressions found in the mobile audit:
 *  - C1: horizontal overflow (the closed CartDrawer extended the document
 *    scroll width → the whole page scrolled sideways on phones).
 *  - H1: the hamburger menu had no height and a translucent background,
 *    so page content showed through it.
 *
 * If either returns, these fail in CI instead of reaching customers.
 */

const PAGES = ["/", "/shop/sport", "/shop/sport/longsleeve"];

test.describe("mobile layout smoke", () => {
    for (const path of PAGES) {
        test(`no horizontal overflow on ${path}`, async ({ page }) => {
            await page.goto(path);
            // 1px tolerance for sub-pixel rounding.
            const overflow = await page.evaluate(() => {
                const d = document.documentElement;
                return d.scrollWidth - d.clientWidth;
            });
            expect(overflow, `${path} must not scroll sideways`).toBeLessThanOrEqual(1);
        });
    }

    test("hamburger menu opens as a full-height opaque panel", async ({ page }) => {
        await page.goto("/shop/sport");
        await page.getByRole("button", { name: "Меню" }).click();

        const nav = page.locator(".header__nav--active");
        await expect(nav).toBeVisible();

        // The panel must stretch most of the viewport height — proves it
        // has a real height and isn't just a content-tall sliver with the
        // page showing through underneath.
        const box = await nav.boundingBox();
        const viewportH = page.viewportSize()!.height;
        expect(box, "menu panel should have a layout box").not.toBeNull();
        expect(box!.height).toBeGreaterThan(viewportH * 0.6);

        // Background must be fully opaque (no page bleed-through).
        const bgAlpha = await nav.evaluate((el) => {
            const bg = getComputedStyle(el).backgroundColor;
            const m = bg.match(/rgba?\([^)]*\)/);
            if (!m) return 1;
            const parts = m[0].replace(/rgba?\(|\)/g, "").split(",");
            return parts.length === 4 ? parseFloat(parts[3]) : 1;
        });
        expect(bgAlpha, "menu background must be opaque").toBe(1);
    });
});
