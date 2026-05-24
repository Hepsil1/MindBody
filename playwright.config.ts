import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for E2E smoke tests.
 *
 * Scope: a single happy-path test for the checkout flow. We deliberately
 * don't run this in CI yet (Playwright browser install adds ~90s + needs
 * a real Postgres + seed) — run locally with `npm run test:e2e` before
 * merging PRs that touch checkout / cart / product.
 *
 * Important env overrides (in webServer.env below):
 * - TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are forced empty so
 *   api.orders.create.tsx's "if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)"
 *   gate skips the Telegram notify call. No real outbound HTTP.
 * - RESEND_API_KEY is also blanked — the order confirmation email path
 *   already skips when the address ends in `@mindbody.local`, but this is
 *   defence in depth (if the test ever uses a different email it still
 *   won't ship a real Resend message).
 *
 * What we DON'T override:
 * - DATABASE_URL — the test does write a real Order row. That row is
 *   recognisable by its `@mindbody.local` customer email; periodic cleanup
 *   is documented in RUNBOOK.md.
 */
export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false, // single-worker — tests touch shared DB
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "list",

    use: {
        // Use port 3001 (NOT 3000) so the test never collides with the
        // PM2-managed production process that listens on 3000 on the VPS.
        baseURL: "http://localhost:3001",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        // Real-user behaviour: don't dismiss dialogs automatically.
        actionTimeout: 10_000,
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
            // Desktop project runs every spec EXCEPT the mobile-only ones.
            testIgnore: /mobile-.*\.spec\.ts/,
        },
        {
            // Mobile project runs ONLY mobile-*.spec.ts at a phone viewport
            // (Pixel 7 = 412x915). Catches horizontal-overflow / broken
            // mobile-menu regressions that desktop Chrome can't see.
            name: "Mobile Chrome",
            use: { ...devices["Pixel 7"] },
            testMatch: /mobile-.*\.spec\.ts/,
        },
        {
            // iPhone 14 — real WebKit engine.  This is the closest free
            // approximation to Safari iOS: it's the same engine, with the
            // same default CSS behaviours that Chromium-with-iOS-UA gets
            // wrong (empty <span> width, 100vh URL-bar quirk, hover:hover
            // matching).  Caught the .header__burger span 0-width bug
            // that Chromium emulation missed.
            name: "Mobile Safari",
            use: { ...devices["iPhone 14"] },
            testMatch: /mobile-.*\.spec\.ts/,
        },
        {
            // iPhone SE — smallest viable current iPhone (375×667 DPR 2).
            // Catches narrow-viewport overflow + sticky-CTA-clearance bugs
            // that the bigger phones hide.
            name: "Mobile Safari SE",
            use: { ...devices["iPhone SE"] },
            testMatch: /mobile-.*\.spec\.ts/,
        },
    ],

    // Auto-start the React Router dev server before tests, kill it after.
    // reuseExistingServer lets you start the dev server manually first and
    // attach to it (faster iteration).
    webServer: {
        // Port 3001 so we don't touch the production PM2 process that owns 3000.
        command: "npx react-router dev --port 3001",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
        env: {
            // Disable outbound notifications during E2E — see header comment.
            TELEGRAM_BOT_TOKEN: "",
            TELEGRAM_CHAT_ID: "",
            RESEND_API_KEY: "",
        },
    },
});
