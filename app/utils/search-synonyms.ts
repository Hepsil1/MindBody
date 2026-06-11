/**
 * Search synonyms — bridge the gap between what buyers type and what
 * the catalogue actually calls things.
 *
 * The audit caught a brutal example: the navigation labels the section
 * «ЛЕГІНСИ» but every product in it is named «Лосини…». A SQL
 * `contains` search for «легінси» therefore returned zero hits — the
 * single most likely first search a buyer would type on this site.
 *
 * This isn't a full-blown text-search engine; it's a hand-curated map
 * of pairs known to matter for activewear in Ukrainian + the
 * Anglicisms our admins use as aliases (Velo, SET). Each query
 * expands into the set of terms we'll OR-match against name /
 * description / category in the Prisma where clause.
 *
 * Keep entries lowercased without diacritics noise; the matcher does
 * the case-folding via Prisma `mode: "insensitive"`. Both sides of
 * each pair are listed so the lookup is direction-agnostic.
 */

const SYNONYM_GROUPS: string[][] = [
    // Leggings — the F-014 example. Site/menu uses one term, product
    // names use the other; buyers type either. + en/ru storefront terms
    // (product names in the DB are Ukrainian, so en/ru queries must map
    // onto the uk vocabulary to hit anything).
    ["легінси", "лосини", "leggings", "leg", "леггинсы", "лосины", "tights"],
    // Apparel sets — "комплект" in catalogue, but buyers also reach
    // for "костюм", "сет".
    ["комплект", "костюм", "сет", "set", "co-ord", "suit"],
    // Bike-shorts / "велосипедки" / our internal Velo line.
    ["велосипедки", "velo", "велошорти", "велики", "bike shorts", "велосипедки"],
    // Long-sleeves — Cyrillic + the SKU prefix admins type.
    ["лонгслів", "longsleeve", "лонгслив", "long sleeve"],
    // T-shirts / tops basics.
    ["футболка", "tshirt", "майка", "tee", "t-shirt", "shirt", "tank"],
    // Tops (sport tops, brassieres).
    ["топ", "top", "топік", "bra", "топик"],
    // Jumpsuit / one-piece in catalogue; buyers say "комбінезон" too.
    ["комбінезон", "jumpsuit", "комбез", "ромпер", "комбинезон", "romper", "one-piece"],
    // Hoodies & sweatshirts.
    ["худі", "hoodie", "толстовка", "худи", "свитшот", "світшот", "sweatshirt"],
    // Joggers / sweatpants.
    ["джогери", "joggers", "штани", "брюки", "джоггеры", "штаны", "sweatpants", "pants"],
    // Shorts.
    ["шорти", "shorts", "шорты"],
    // Yoga props (mats, blocks).
    ["килимок", "mat", "коврик", "yoga mat"],
    ["блок", "block", "цегла", "блоки"],
    // Kids line.
    ["дитячий", "kids", "детский", "дитячі", "детские"],
    // Thermal underwear.
    ["термо", "thermal", "термобілизна", "термобельё", "термобелье"],
];

// Build a one-shot map at module load (cold once, hot forever).
// Key: a term. Value: the full synonym set including itself.
const SYNONYM_INDEX: Map<string, string[]> = (() => {
    const m = new Map<string, string[]>();
    for (const group of SYNONYM_GROUPS) {
        for (const term of group) {
            m.set(term.toLowerCase(), group);
        }
    }
    return m;
})();

/**
 * Returns the set of terms to search for, given the raw user input.
 * Always includes the original (trimmed/lowercased) so a non-synonym
 * query still works. Maxed at 8 terms to keep the Prisma OR-tree sane.
 */
export function expandSearchTerms(raw: string): string[] {
    const cleaned = raw.trim().replace(/[%_]/g, "").toLowerCase();
    if (!cleaned) return [];
    const group = SYNONYM_INDEX.get(cleaned);
    if (!group) return [cleaned];
    // Original first so the highest-priority hit (exact what the user
    // typed) stays at the front of the OR-tree.
    const dedup = Array.from(new Set([cleaned, ...group]));
    return dedup.slice(0, 8);
}
