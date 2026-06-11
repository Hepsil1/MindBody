/**
 * i18n runtime — translation lookup, React hooks, localized Link wrappers and
 * money formatting. See config.ts for the locale/URL model.
 *
 * Conventions used across the app:
 *   const { t, lp, locale } = useI18n();
 *   t("Додати в кошик")                      — dictionary key IS the Ukrainian string
 *   t("Знайдено {n} товарів", { n: 5 })      — {param} substitution
 *   lp("/checkout")                          — locale-prefixed internal href
 *   const money = useMoney(); money(2490)    — "2 490 ₴" | "$55"
 *   <LLink to="/wishlist">                   — Link that auto-prefixes `to`
 *
 * Server code (loaders/actions/meta) uses getT(locale) + formatMoney().
 */
import { Link, NavLink, useLocation, useRouteLoaderData } from "react-router";
import type { LinkProps, NavLinkProps } from "react-router";

import {
    FALLBACK_USD_RATE,
    LOCALE_COOKIE,
    type Locale,
    localizePath,
    splitLocalePath,
} from "./config";
import { en } from "./dictionaries/en";
import { ru } from "./dictionaries/ru";
import { enGenerated } from "./dictionaries/en.generated";
import { ruGenerated } from "./dictionaries/ru.generated";
import { formatPrice } from "../utils/format";

export * from "./config";

// Hand-written entries (en.ts/ru.ts) win over the generated bulk — they're
// the place for deliberate fixes when a generated translation reads off.
const DICTS: Record<Exclude<Locale, "uk">, Record<string, string>> = {
    en: { ...enGenerated, ...en },
    ru: { ...ruGenerated, ...ru },
};

/** Substitute {name} placeholders. Missing params are left visible. */
function interpolate(s: string, params?: Record<string, string | number>): string {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (raw, k: string) =>
        params[k] === undefined ? raw : String(params[k]),
    );
}

/**
 * Context separator for ambiguous keys. One Ukrainian word can need different
 * translations per context ("Замовлення" = Order | Orders). Call sites write
 * t("Замовлення@@tab") — uk renders the part before "@@", en/ru look up the
 * full contextual key first, then the base, then fall back to the base text.
 */
const CONTEXT_SEP = "@@";

/** Core lookup: uk returns the key; en/ru fall back to uk when untranslated. */
export function translate(
    locale: Locale,
    key: string,
    params?: Record<string, string | number>,
): string {
    const sepIdx = key.indexOf(CONTEXT_SEP);
    const base = sepIdx === -1 ? key : key.slice(0, sepIdx);
    const s = locale === "uk" ? base : (DICTS[locale][key] ?? DICTS[locale][base] ?? base);
    return interpolate(s, params);
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

/** Bound t() for server code (loaders, actions, meta, emails). */
export function getT(locale: Locale): TFunction {
    return (key, params) => translate(locale, key, params);
}

/**
 * Locale-aware plural. `one/few/many` are the UKRAINIAN forms (dictionary
 * keys). The form is chosen by the TARGET locale's rule, then translated:
 *   en — one when |n|===1, else many ("item"/"items"/"items")
 *   uk/ru — slavic rule (1→one, 2-4→few, 5-20→many)
 */
export function plural(
    locale: Locale,
    count: number,
    one: string,
    few: string,
    many: string,
): string {
    const n = Math.abs(Math.trunc(count));
    let form: string;
    if (locale === "en") {
        form = n === 1 ? one : many;
    } else {
        const mod100 = n % 100;
        const mod10 = n % 10;
        if (mod100 >= 11 && mod100 <= 14) form = many;
        else if (mod10 === 1) form = one;
        else if (mod10 >= 2 && mod10 <= 4) form = few;
        else form = many;
    }
    return translate(locale, form);
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** UAH → whole-dollar conversion used everywhere a $ price is shown. */
export function uahToUsd(uah: number | string, rate: number): number {
    return Math.max(1, Math.round(Number(uah) / rate));
}

/**
 * Format a UAH amount for the locale: uk → "2 490 ₴", en/ru → "$55".
 * EN/RU prices are display-only — orders are always placed in UAH.
 */
export function formatMoney(uah: number | string, locale: Locale, rate: number): string {
    if (locale === "uk") return `${formatPrice(uah)} ₴`;
    return `$${uahToUsd(uah, rate).toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Active locale, derived from the URL — works everywhere (including the root
 * ErrorBoundary, where loader data may be missing) and can never mismatch
 * between server and client.
 */
export function useLocale(): Locale {
    const location = useLocation();
    return splitLocalePath(location.pathname).locale;
}

export interface I18n {
    locale: Locale;
    t: TFunction;
    /** Locale-prefix an internal path: lp("/checkout") → "/en/checkout". */
    lp: (to: string) => string;
}

export function useI18n(): I18n {
    const locale = useLocale();
    return {
        locale,
        t: (key, params) => translate(locale, key, params),
        lp: (to) => localizePath(to, locale),
    };
}

/** USD rate the root loader fetched (NBU, cached server-side). */
export function useUsdRate(): number {
    const data = useRouteLoaderData("root") as { usdRate?: number } | undefined;
    return data?.usdRate ?? FALLBACK_USD_RATE;
}

/** Bound money formatter for components: const money = useMoney(); money(2490). */
export function useMoney(): (uah: number | string) => string {
    const locale = useLocale();
    const rate = useUsdRate();
    return (uah) => formatMoney(uah, locale, rate);
}

/** Persist the visitor's explicit choice (gate / header switcher). */
export function setLocaleCookie(locale: Locale) {
    if (typeof document === "undefined") return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

// ---------------------------------------------------------------------------
// Localized Link wrappers — drop-in replacements for react-router's Link /
// NavLink that prefix string `to` paths with the active locale.
// ---------------------------------------------------------------------------

export function LLink({ to, ...rest }: LinkProps & React.RefAttributes<HTMLAnchorElement>) {
    const locale = useLocale();
    return <Link to={typeof to === "string" ? localizePath(to, locale) : to} {...rest} />;
}

export function LNavLink({ to, ...rest }: NavLinkProps & React.RefAttributes<HTMLAnchorElement>) {
    const locale = useLocale();
    return <NavLink to={typeof to === "string" ? localizePath(to, locale) : to} {...rest} />;
}
