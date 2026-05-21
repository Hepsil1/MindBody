import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the path-based subcategory URL migration.
 *
 * What we lock down here:
 *  - /shop/<cat>/<sub> renders with subcategory-specific meta, canonical
 *    and CollectionPage JSON-LD (3-level BreadcrumbList).
 *  - Invalid (cat, sub) pairs 301-redirect to the parent shop page.
 *  - Legacy query parameters (?categories=, ?cat=, percent-encoded UA
 *    labels) 301-redirect to the new canonical path.
 *  - Multi-select queries (?categories=a,b) are NOT redirected — they
 *    stay on the parent route as an ad-hoc filter view.
 *
 * Runs against the same dev server as checkout.spec.ts (port 3001).
 */

test.describe("subcategory path URLs", () => {
    test("/shop/sport/longsleeve renders with the right meta + JSON-LD", async ({ page }) => {
        const response = await page.goto("/shop/sport/longsleeve");
        expect(response?.status()).toBe(200);

        await expect(page).toHaveTitle(/Лонгсліви.*SPORT.*MIND BODY/);

        const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
        expect(canonical).toMatch(/\/shop\/sport\/longsleeve$/);

        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
        expect(ogTitle).toMatch(/Лонгсліви/);

        // BreadcrumbList must have 3 items: Home → SPORT → Лонгсліви
        const ldNodes = await page.locator('script[type="application/ld+json"]').allTextContents();
        const breadcrumb = ldNodes
            .map((s) => JSON.parse(s) as { "@type"?: string; itemListElement?: unknown[] })
            .find((j) => j["@type"] === "BreadcrumbList");
        expect(breadcrumb).toBeDefined();
        expect(breadcrumb?.itemListElement).toHaveLength(3);

        const collection = ldNodes
            .map((s) => JSON.parse(s) as { "@type"?: string })
            .find((j) => j["@type"] === "CollectionPage");
        expect(collection).toBeDefined();
    });

    test("invalid (cat, sub) pair 301-redirects to parent shop", async ({ page }) => {
        // pole-sets only exists for dance — yoga must redirect.
        const response = await page.goto("/shop/yoga/pole-sets");
        expect(response?.status()).toBe(200); // final landing page
        await expect(page).toHaveURL(/\/shop\/yoga$/);
    });

    test("legacy ?categories=<slug> 301-redirects to path form", async ({ page }) => {
        const response = await page.goto("/shop/sport?categories=longsleeve");
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/\/shop\/sport\/longsleeve$/);
    });

    test("legacy ?categories=<UA-label> 301-redirects to slug path", async ({ page }) => {
        const response = await page.goto(
            "/shop/sport?categories=%D0%9B%D0%BE%D0%BD%D0%B3%D1%81%D0%BB%D1%96%D0%B2%D0%B8",
        );
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/\/shop\/sport\/longsleeve$/);
    });

    test("legacy ?cat=<UA-label> still redirects (old parameter name)", async ({ page }) => {
        const response = await page.goto(
            "/shop/sport?cat=%D0%9B%D0%BE%D0%BD%D0%B3%D1%81%D0%BB%D1%96%D0%B2%D0%B8",
        );
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/\/shop\/sport\/longsleeve$/);
    });

    test("multi-select ?categories=a,b stays on parent (no path redirect)", async ({ page }) => {
        const response = await page.goto("/shop/sport?categories=longsleeve,velo");
        expect(response?.status()).toBe(200);
        // URL must NOT have been rewritten to /shop/sport/<one-slug>.
        // Browsers may keep the comma raw OR percent-encode it as %2C — either is fine.
        await expect(page).toHaveURL(/\/shop\/sport\?categories=longsleeve(,|%2C)velo/);
    });

    test("sitemap.xml lists subcategory URLs after DB migration", async ({ page }) => {
        const response = await page.goto("/sitemap.xml");
        expect(response?.status()).toBe(200);
        const xml = await response!.text();
        // After the DB migration, every (shop, slug) pair with at least
        // one active product should appear in the sitemap.
        expect(xml).toMatch(/<loc>[^<]*\/shop\/sport\/longsleeve<\/loc>/);
        expect(xml).toMatch(/<loc>[^<]*\/shop\/dance\/pole-sets<\/loc>/);
    });
});
