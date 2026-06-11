/**
 * Single source of truth for the site origin (no trailing slash).
 *
 * Permanent domain since 2026-06-11: mindbody-sportwear.com (migrated from the
 * launch placeholder saleid.icu). `SITE_URL` in the production environment
 * overrides this default; both should match the live canonical domain — every
 * canonical/OG/JSON-LD/sitemap URL flows from these two places. (Sister
 * references the build can't reach: public/robots.txt, Caddyfile, and the
 * 301 redirect from the old origin.)
 *
 * `DEFAULT_SITE_URL` is a plain literal safe to import anywhere (incl. client meta).
 * `resolveSiteUrl()` reads the env override and is server-only (call it in loaders),
 * so it is tree-shaken out of client bundles for routes that import only the literal.
 */
export const DEFAULT_SITE_URL = "https://mindbody-sportwear.com";

export function resolveSiteUrl(): string {
    const fromEnv = typeof process !== "undefined" ? process.env.SITE_URL : undefined;
    return (fromEnv || DEFAULT_SITE_URL).replace(/\/+$/, "");
}
