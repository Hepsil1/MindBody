/**
 * Single source of truth for subcategory slug ↔ label mapping.
 * Slug = what goes in URL (?categories=jumpsuit)
 * Label = Ukrainian display name shown to user
 *
 * When adding a new subcategory:
 *   1. Add entry here
 *   2. Make sure products in DB use the slug as their `category` field
 */

export const CATEGORY_MAP: Record<string, string> = {
    // Common across sections
    jumpsuit: "Комбінезони",
    leggings: "Легінси",
    tops: "Топи",
    shorts: "Шорти",
    longsleeve: "Лонгсліви",
    tshirts: "Футболки",
    singlets: "Майки",
    sets: "Комплекти",
    jackets: "Куртки",
    velo: "VELO",
    // Dance specific
    "net-models": "Моделі із сітки",
    "pole-sets": "Комплекти пілон",
    // Casual specific
    suits: "Костюми",
    shirts: "Сорочки",
    thermo: "Термо",
    hoodies: "Худі / Світшоти",
    joggers: "Джоггери",
    // Kids specific
    "kids-jumpsuit": "Комбінезони",
    // Yoga tools (yogatools ShopPage)
    tools: "Інвентар",
};

/**
 * Per-shop whitelist of allowed subcategory slugs.
 *
 * Used by the /shop/:category/:subcategory route to validate that a given
 * combination is real (e.g. /shop/yoga/pole-sets must 301 → /shop/yoga
 * because pole-sets only exists for dance).
 *
 * Source of truth: app/components/Header.tsx nav links + the yogatools
 * ShopPage (no header link but has real products in DB).
 */
export const CATEGORY_BY_SHOP_PAGE: Record<string, string[]> = {
    yoga: ["jumpsuit", "leggings", "velo", "tops", "shorts", "longsleeve", "tshirts"],
    sport: ["jumpsuit", "leggings", "velo", "tops", "shorts", "longsleeve", "sets"],
    dance: ["jumpsuit", "net-models", "pole-sets"],
    casual: ["suits", "shirts", "tshirts", "singlets", "shorts", "thermo", "hoodies", "joggers"],
    kids: ["jumpsuit"],
    yogatools: ["tools"],
};

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
