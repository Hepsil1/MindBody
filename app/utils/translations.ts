/**
 * Entity-level i18n (client-safe half).
 *
 * DB rows that carry owner-editable text (Product, Category, ShopPage) get a
 * `translations` TEXT column holding JSON of the shape:
 *
 *   { "en": { "name": "...", "description": "..." }, "ru": { ... } }
 *
 * Field keys mirror the Ukrainian source columns. A missing locale block,
 * missing field, or broken JSON falls back to the Ukrainian original — the
 * storefront can never break on bad translation data.
 *
 * Server-side fetching/writing lives in translations.server.ts (raw SQL —
 * the moodType pattern, works against any generated Prisma client).
 */
import type { Locale } from "../i18n/config";

export interface EntityTranslations {
    en?: Record<string, string | undefined>;
    ru?: Record<string, string | undefined>;
}

/** Parse a `translations` column value. Never throws. */
export function parseTranslations(raw: string | null | undefined): EntityTranslations {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as EntityTranslations;
        }
        return {};
    } catch {
        return {};
    }
}

/** One translated field with uk fallback. Empty strings count as missing. */
export function trField(
    translations: EntityTranslations,
    locale: Locale,
    field: string,
    fallback: string,
): string {
    if (locale === "uk") return fallback;
    const value = translations[locale]?.[field];
    return value && value.trim() !== "" ? value : fallback;
}

/**
 * Localize the given string fields of an entity in place of the originals.
 * `raw` is the entity's translations JSON (string) or a pre-parsed object.
 */
export function localizeFields<T extends Record<string, unknown>>(
    entity: T,
    raw: string | null | undefined | EntityTranslations,
    locale: Locale,
    fields: string[],
): T {
    if (locale === "uk") return entity;
    const tr =
        typeof raw === "string" || raw === null || raw === undefined ? parseTranslations(raw) : raw;
    const out: Record<string, unknown> = { ...entity };
    for (const f of fields) {
        const original = entity[f];
        if (typeof original === "string" || original === null || original === undefined) {
            out[f] = trField(tr, locale, f, (original ?? "") as string) || original;
        }
    }
    return out as T;
}
