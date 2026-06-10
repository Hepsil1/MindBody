/**
 * Single source of truth for the site origin (no trailing slash).
 *
 * DOMAIN MIGRATION: when moving saleid.icu → the permanent domain, change
 * `DEFAULT_SITE_URL` here AND set `SITE_URL` in the production environment — every
 * canonical/OG/JSON-LD/sitemap URL flows from these two places. (Also update the
 * non-app references the build can't reach: public/robots.txt, Caddyfile, and the
 * 301 redirect — see the migration checklist.)
 *
 * `DEFAULT_SITE_URL` is a plain literal safe to import anywhere (incl. client meta).
 * `resolveSiteUrl()` reads the env override and is server-only (call it in loaders),
 * so it is tree-shaken out of client bundles for routes that import only the literal.
 */
export const DEFAULT_SITE_URL = "https://saleid.icu";

export function resolveSiteUrl(): string {
    const fromEnv = typeof process !== "undefined" ? process.env.SITE_URL : undefined;
    return (fromEnv || DEFAULT_SITE_URL).replace(/\/+$/, "");
}
