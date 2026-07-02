/**
 * Single source of truth for the site origin (no trailing slash).
 *
 * Permanent domain since 2026-06-11: mindbody-sportwear.com. The launch
 * placeholder saleid.icu was fully retired 2026-06-26 — no Caddy redirect, no
 * DNS record kept intentionally (the owner still needs to remove the upstream
 * DNS records at the registrar/Cloudflare and can let the .icu lapse). Every
 * canonical/OG/JSON-LD/sitemap URL flows from `SITE_URL` (env) and this file.
 * (Sister reference the build can't reach: public/robots.txt.)
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
