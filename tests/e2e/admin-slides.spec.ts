import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the admin visual editor after the slides.tsx refactor
 * (4768-line god-component split into 5 modules).
 *
 * Why this exists: the customer-facing E2E (checkout, subcategory) never
 * touches /admin/*, so a broken import or prop mismatch in the extracted
 * AdminIcons / ImageCropSelector / FilterEditorModal / AboutSlidesModal
 * components would ship undetected. These tests log in and actually
 * render each piece.
 *
 * The dev server (port 3001, started by playwright.config.ts) reads the
 * project .env, so ADMIN_PASSWORD matches the value below.
 */

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "Admin";

test.describe("admin visual editor", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/admin/login");
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        // A correct password redirects to /admin; a wrong one stays on
        // /admin/login with an error — waitForURL fails fast in that case.
        await page.waitForURL(/\/admin(\/|$)/);
    });

    test("/admin/slides mounts AdminVisualEditor without uncaught errors", async ({ page }) => {
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));

        await page.goto("/admin/slides");

        // The three view tabs only render if AdminVisualEditor mounted —
        // which means the AdminIcons + ImageCropSelector imports resolved.
        await expect(page.getByRole("button", { name: "Головна (Слайди)" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Магазин (Категорії)" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Про бренд" })).toBeVisible();

        expect(pageErrors, "no uncaught render errors on /admin/slides").toEqual([]);
    });

    test("FilterEditorModal (extracted module) opens and renders", async ({ page }) => {
        await page.goto("/admin/slides");
        await page.getByRole("button", { name: "Магазин (Категорії)" }).click();
        await page.getByRole("button", { name: /Редагувати фільтри/i }).click();
        // Heading inside FilterEditorModal — proves the extracted file
        // imports/renders correctly.
        await expect(page.getByRole("heading", { name: "Керування фільтрами" })).toBeVisible();
    });

    test("AboutSlidesModal (extracted module) opens and renders", async ({ page }) => {
        await page.goto("/admin/slides");
        await page.getByRole("button", { name: "Про бренд" }).click();
        await page.getByRole("button", { name: /Редагувати слайди/i }).click();
        // AboutSlidesModal's own heading. It internally uses ImageCropSelector
        // + AdminIcons, so a broken import would crash before this point.
        await expect(page.getByRole("heading", { name: /Слайди.*Про бренд/ })).toBeVisible();
    });
});
