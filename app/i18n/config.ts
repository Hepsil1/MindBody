/**
 * i18n core config — client-safe, framework-free (no React imports).
 *
 * Locale model:
 *   uk — default, NO URL prefix (https://site/...)        currency ₴
 *   en — /en prefix (https://site/en/...)                 currency $ (NBU rate)
 *   ru — /ru prefix (https://site/ru/...)                 currency $ (NBU rate)
 *
 * The URL is the single source of truth for the active locale (SEO: each
 * language is a crawlable URL tree + hreflang alternates). The mb_locale
 * cookie only remembers the visitor's choice for the first-visit gate and
 * the landing redirect of "/".
 */

export const LOCALES = ["uk", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uk";

/** Cookie that remembers the visitor's explicit language choice. */
export const LOCALE_COOKIE = "mb_locale";

export function isLocale(v: unknown): v is Locale {
    return v === "uk" || v === "en" || v === "ru";
}

/** <html lang> / hreflang values. */
export const HTML_LANG: Record<Locale, string> = {
    uk: "uk",
    en: "en",
    ru: "ru",
};

/** Native display names for switcher / gate. */
export const LOCALE_NAMES: Record<Locale, string> = {
    uk: "Українська",
    en: "English",
    ru: "Русский",
};

/** Short labels for the compact header switcher. */
export const LOCALE_SHORT: Record<Locale, string> = {
    uk: "UA",
    en: "EN",
    ru: "RU",
};

/**
 * Split a pathname into its locale and the locale-less path.
 * "/en/shop/yoga" → { locale: "en", path: "/shop/yoga" }
 * "/shop/yoga"    → { locale: "uk", path: "/shop/yoga" }
 * "/en"           → { locale: "en", path: "/" }
 */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
    const m = pathname.match(/^\/(en|ru)(\/|$)/);
    if (m) {
        const rest = pathname.slice(m[1].length + 1);
        return { locale: m[1] as Locale, path: rest === "" ? "/" : rest };
    }
    return { locale: "uk", path: pathname || "/" };
}

/**
 * Prefix an internal path for the given locale. Accepts paths with
 * search/hash ("/shop/yoga?page=2#top"). Idempotent: strips any existing
 * locale prefix first. /admin and /api are never prefixed.
 */
export function localizePath(to: string, locale: Locale): string {
    if (!to.startsWith("/")) return to; // external/relative/hash — leave alone
    if (to.startsWith("/admin") || to.startsWith("/api")) return to;
    // separate path from ?search#hash
    const tailIdx = to.search(/[?#]/);
    const path = tailIdx === -1 ? to : to.slice(0, tailIdx);
    const tail = tailIdx === -1 ? "" : to.slice(tailIdx);
    const { path: bare } = splitLocalePath(path);
    if (locale === "uk") return (bare === "/" ? "/" : bare) + tail;
    return `/${locale}${bare === "/" ? "" : bare}` + tail;
}

/**
 * Resolve the locale from a route's optional :lang param.
 * Throws 404 for garbage prefixes ("/xyz/..." must not render content).
 */
/** Read the remembered locale from a Cookie header (server-side). */
export function localeFromCookieHeader(header: string | null): Locale | null {
    if (!header) return null;
    const m = header.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(uk|en|ru)(?:;|$)`));
    return m ? (m[1] as Locale) : null;
}

/**
 * Last-resort UAH-per-USD rate when the NBU API, the DB cache and the memory
 * cache are all unavailable (see utils/currency.server.ts). Updated manually
 * on major rate moves; the live rate normally overrides it within one request.
 */
export const FALLBACK_USD_RATE = 44.93;

export function localeFromParam(lang: string | undefined): Locale {
    if (lang === undefined) return "uk";
    if (lang === "en" || lang === "ru") return lang;
    throw new Response("Not Found", { status: 404 });
}
