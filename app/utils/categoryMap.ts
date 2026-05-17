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
};

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
