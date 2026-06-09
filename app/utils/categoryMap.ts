/**
 * Subcategory slug ↔ label mapping + per-shop validation.
 * Slug = what goes in URL (/shop/yoga/jumpsuit)
 * Label = Ukrainian display name shown to user
 *
 * As of the "full depth" change this is DERIVED from the single source of
 * truth in `taxonomy.ts` (TAXONOMY). To add/rename a subcategory, edit
 * TAXONOMY — not this file. A small LEGACY layer below keeps older product
 * slugs (sets, tools, …) valid even though they're no longer in the menu,
 * so existing DB rows never 404.
 *
 * When adding a new subcategory: add it to TAXONOMY, then make sure
 * products in DB use the slug as their `category` field.
 */

import { TAXONOMY } from "./taxonomy";

/**
 * Slugs that existed before the taxonomy refactor and may still be on
 * products in the DB, but aren't part of the new menu structure. Kept valid
 * so /shop/:cat/:legacy doesn't 301 away and slugToLabel still resolves.
 */
const LEGACY_LABELS: Record<string, string> = {
    sets: "Комплекти",
    jackets: "Куртки",
    "kids-jumpsuit": "Комбінезони",
    tools: "Інвентар",
};

/** Legacy (shop → subcats) still accepted by isValidSubcategory. */
const LEGACY_BY_SHOP: Record<string, string[]> = {
    sport: ["sets"],
    yogatools: ["tools"],
};

/** slug → Ukrainian label, derived from TAXONOMY (first occurrence wins) + legacy. */
export const CATEGORY_MAP: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const subs of Object.values(TAXONOMY)) {
        for (const [slug, def] of Object.entries(subs)) {
            if (!(slug in map)) map[slug] = def.label;
        }
    }
    return { ...map, ...LEGACY_LABELS };
})();

/**
 * Per-shop whitelist of allowed subcategory slugs. Used by the
 * /shop/:category/:subcategory route to validate that a given combination
 * is real (e.g. /shop/yoga/pole-sets must 301 → /shop/yoga because
 * pole-sets only exists for dance).
 *
 * Source of truth: TAXONOMY + the LEGACY_BY_SHOP back-compat list.
 */
export const CATEGORY_BY_SHOP_PAGE: Record<string, string[]> = (() => {
    const out: Record<string, string[]> = {};
    for (const [shop, subs] of Object.entries(TAXONOMY)) {
        const legacy = LEGACY_BY_SHOP[shop] ?? [];
        out[shop] = [...Object.keys(subs), ...legacy];
    }
    // Shops that only have legacy subcats (none today, but future-proof).
    for (const [shop, legacy] of Object.entries(LEGACY_BY_SHOP)) {
        if (!out[shop]) out[shop] = [...legacy];
    }
    return out;
})();

/** Set of every slug we accept anywhere (for fast O(1) validation in actions). */
export const ALLOWED_CATEGORY_SLUGS: ReadonlySet<string> = new Set(Object.keys(CATEGORY_MAP));

/** True if (shop, sub) is a real combination — see CATEGORY_BY_SHOP_PAGE. */
export function isValidSubcategory(shop: string, sub: string): boolean {
    return CATEGORY_BY_SHOP_PAGE[shop]?.includes(sub) ?? false;
}

/** Centralised path builder so links never accidentally use kyrillic. */
export const buildSubcategoryUrl = (shop: string, sub: string): string => `/shop/${shop}/${sub}`;

/** slug → Ukrainian label */
export function slugToLabel(slug: string): string {
    return CATEGORY_MAP[slug] ?? slug;
}

/**
 * label → slug (for legacy ?cat=Комбінезони redirect support)
 * Returns null if no matching slug found
 */
export function labelToSlug(label: string): string | null {
    const entry = Object.entries(CATEGORY_MAP).find(([, v]) => v === label);
    return entry ? entry[0] : null;
}

/**
 * Build categories object for FilterConfig (slug → label format only)
 * Used in DEFAULT_FILTER_CONFIG
 */
export function buildFilterCategories(slugs: string[]): Record<string, string> {
    return Object.fromEntries(slugs.map((slug) => [slug, slugToLabel(slug)]));
}
