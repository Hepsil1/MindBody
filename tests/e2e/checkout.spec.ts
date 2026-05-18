import { test, expect } from "@playwright/test";

/**
 * Happy-path E2E: home → product → add to cart → cart drawer → checkout
 * → fill form → submit → success.
 *
 * Why this test exists: 72 unit tests cover validation/auth/rate-limit
 * logic, but nothing covers the user's actual path through the site.
 * If a hydration bug or routing regression breaks "add to cart", we
 * find out from customers — this test finds out from CI/the dev.
 *
 * Outbound side-effects in this run:
 *   - Telegram: SKIPPED (env vars blanked in playwright.config.ts)
 *   - Resend email: SKIPPED (api.orders.create.tsx skips when the
 *     customer email ends in `@mindbody.local`)
 *   - DB write: YES — creates an Order row + decrements stock.
 *     Cleanup is documented in RUNBOOK.md (manual periodic DELETE).
 *   - Nova Poshta API: MOCKED via page.route so we don't hammer
 *     their service from CI/dev and don't depend on their uptime.
 */

const MOCK_CITY = {
    Ref: "e221d627-391c-11dd-90d9-001a92567626", // Kyiv ref (anonymous public ref)
    Description: "Київ",
    DescriptionRu: "Киев",
    AreaDescription: "Київська",
    AreaDescriptionRu: "Киевская",
    SettlementTypeDescription: "місто",
};

const MOCK_WAREHOUSE = {
    Ref: "1ec09d2e-e1c2-11e3-8c4a-0050568002cf",
    Description: "Відділення №1: вул. Тестова, 42",
    DescriptionRu: "Отделение №1: ул. Тестовая, 42",
    CityRef: MOCK_CITY.Ref,
    CityDescription: "Київ",
    SettlementAreaDescription: "Київська область",
};

test.describe("checkout happy path", () => {
    test.beforeEach(async ({ page }) => {
        // Intercept Nova Poshta calls so the test doesn't depend on the
        // upstream API or the live key. The page sends multipart/form-data
        // POST bodies (via FormData), so we parse the `action` field with
        // a regex — URLSearchParams can't read multipart.
        await page.route("**/api/novaposhta**", async (route) => {
            const request = route.request();
            const post = request.postData() ?? "";
            const url = new URL(request.url());

            // Multipart: lines look like:
            //   Content-Disposition: form-data; name="action"
            //   (blank)
            //   searchCities
            const multipartActionMatch = post.match(/name="action"\s*\r?\n\s*\r?\n\s*([A-Za-z]+)/);
            const urlEncodedAction = new URLSearchParams(post).get("action");
            const queryAction = url.searchParams.get("action");
            const action = multipartActionMatch?.[1] ?? urlEncodedAction ?? queryAction ?? "";

            if (action === "searchCities") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ success: true, data: [MOCK_CITY] }),
                });
            } else if (action === "getWarehouses") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ success: true, data: [MOCK_WAREHOUSE] }),
                });
            } else {
                await route.fulfill({
                    status: 400,
                    contentType: "application/json",
                    body: JSON.stringify({
                        success: false,
                        error: `Unknown action (parsed='${action}', body-len=${post.length})`,
                    }),
                });
            }
        });
    });

    test("user can add a product to cart and place an order", async ({ page }) => {
        // ── 1. Land on home (proves SSR + navigation work) ─────────────
        await page.goto("/");
        await expect(page).toHaveTitle(/MIND BODY/i);

        // ── 2. Discover a real product ID from the search API ──────────
        // /api/search returns active products with stock — pick the first
        // one. Doesn't rely on the carousel layout or any hard-coded UUID
        // (UUIDs change between seed runs).
        const productResp = await page.request.get("/api/search?q=mini");
        const productData = (await productResp.json()) as {
            products: Array<{ id: string }>;
        };
        if (!productData.products?.length) {
            throw new Error("No products returned from /api/search — DB might be empty");
        }
        const productId = productData.products[0].id;

        await page.goto(`/product/${productId}`);
        await page.waitForLoadState("networkidle");

        // ── 3. Pick a size (if product has them) and click Add to Cart ─
        // Color is auto-defaulted to product.colors[0] by the loader.
        // Wait until size chips render before trying to click.
        await page
            .locator(".size-chip")
            .first()
            .waitFor({ state: "visible", timeout: 5_000 })
            .catch(() => {});

        const availableSize = page.locator(".size-chip:not([disabled]):not(.unavailable)").first();
        const hasAvailableSize = await availableSize.isVisible().catch(() => false);
        if (hasAvailableSize) {
            await availableSize.click();
            // Verify the chip actually got selected (class flips to selected).
            await expect(availableSize).toHaveClass(/selected/, { timeout: 3_000 });
        }

        // The CTA may be wrapped in a span — match by text within the
        // button rather than accessible name. Also handle the case of
        // multiple buttons (desktop + mobile sticky) by clicking the
        // first visible one.
        const addToCartLocator = page.locator("button", { hasText: "Додати в кошик" });
        const buttonCount = await addToCartLocator.count();

        // Diagnostic: if we still see "Оберіть розмір", the click didn't
        // register or the size we picked is the same as a no-op state.
        const allButtonTexts = await page.locator("button").allInnerTexts();
        const ctaTexts = allButtonTexts.filter(
            (t) =>
                t.includes("Додати в кошик") ||
                t.includes("Оберіть розмір") ||
                t.includes("Немає в наявності"),
        );
        if (buttonCount === 0) {
            throw new Error(
                `No "Додати в кошик" button after size pick. CTA-like buttons seen: ${JSON.stringify(ctaTexts)}`,
            );
        }

        let clicked = false;
        for (let i = 0; i < buttonCount; i++) {
            const btn = addToCartLocator.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                await btn.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) {
            throw new Error(
                `Found ${buttonCount} matching buttons but none visible. Texts: ${JSON.stringify(ctaTexts)}`,
            );
        }

        // ── 4. Cart drawer → checkout ──────────────────────────────────
        // The cart drawer auto-opens after add-to-cart. The toast confirms
        // the action; wait briefly so the toast doesn't intercept our
        // next click.
        await page.waitForSelector(".cart-drawer.cart-drawer--open", { timeout: 5_000 });
        // Toast displays for ~3s and overlays clickable elements until it
        // fades — wait it out so the next click hits the right target.
        await page.waitForFunction(() => !document.querySelector(".toast-container > *"), null, {
            timeout: 6_000,
        });

        const goToCheckout = page.locator(".cart-drawer__checkout-btn", {
            hasText: "Оформити замовлення",
        });
        await expect(goToCheckout).toBeVisible({ timeout: 5_000 });
        await goToCheckout.click();

        // ── 5. Checkout page lands on the "cart" step; click the primary
        //      CTA to advance to the "info" step where the form lives.
        await page.waitForURL(/\/checkout/);
        await page.waitForLoadState("networkidle");
        // Give React time to hydrate the cart from localStorage.
        await page.waitForTimeout(500);

        // The cart-step "Оформити замовлення" is a <button class=cart-btn--primary>.
        // We scope to that class to avoid hitting any leftover cart-drawer link.
        const advanceToInfo = page.locator("button.cart-btn--primary", {
            hasText: "Оформити замовлення",
        });
        if (await advanceToInfo.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await advanceToInfo.click();
        } else {
            // Diagnostic: dump current button labels so a failure here tells us
            // which step is rendered.
            const labels = await page.locator("button").allInnerTexts();
            const ctaLike = labels.filter((t) => t.trim().length > 0 && t.length < 80);
            throw new Error(
                `Could not find cart-step CTA. Visible buttons: ${JSON.stringify(ctaLike.slice(0, 10))}`,
            );
        }

        const email = `e2e-${Date.now()}@mindbody.local`;

        await page.locator("#name").waitFor({ state: "visible", timeout: 10_000 });
        await page.locator("#name").fill("E2E Test");
        await page.locator("#email").fill(email);
        await page.locator("#phone").fill("+380501112233");

        // Nova Poshta city autocomplete (mocked)
        const cityInput = page.locator("#city");
        await cityInput.fill("Київ");
        const cityOption = page
            .locator(".autocomplete-dropdown button", { hasText: "Київ" })
            .first();
        await cityOption.click({ timeout: 5_000 });

        // Warehouse autocomplete (mocked)
        const warehouseInput = page.locator("#warehouse, input[placeholder*='Відділення' i]");
        await warehouseInput.first().fill("1");
        const warehouseOption = page
            .locator(".autocomplete-dropdown button", { hasText: "Відділення" })
            .first();
        await warehouseOption.click({ timeout: 5_000 });

        // ── 6. Submit + capture the order-create response for diagnosis
        const orderResponsePromise = page.waitForResponse(
            (res) => res.url().includes("/api/orders/create") && res.request().method() === "POST",
            { timeout: 15_000 },
        );

        const submit = page.getByRole("button", { name: "Підтвердити замовлення" });
        await expect(submit).toBeEnabled();
        await submit.click();

        const orderResponse = await orderResponsePromise;
        const orderBody = await orderResponse.json().catch(() => ({}));
        if (!orderResponse.ok() || orderBody?.success !== true) {
            throw new Error(
                `Order create failed: status=${orderResponse.status()} body=${JSON.stringify(orderBody)}`,
            );
        }

        // ── 7. Verify success state ───────────────────────────────────
        // The success step renders an H2 "Дякуємо за замовлення!" + the
        // order number. We assert the heading is visible.
        await expect(page.getByRole("heading", { name: /Дякуємо за замовлення/ })).toBeVisible({
            timeout: 10_000,
        });
    });
});
