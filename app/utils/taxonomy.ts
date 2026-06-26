/**
 * Single source of truth for the FULL shop taxonomy.
 *
 *   Level 1  shop         yoga | sport | dance | casual | kids | yogatools   → Product.shopPageSlug
 *   Level 2  subcategory  jumpsuit | leggings | …                            → Product.category
 *   Level 3  fabric       sport | cotton                  (optional per sub) → Product.fabric
 *   Level 4  sleeve       long | short | sleeveless | velo (optional per sub) → Product.sleeve
 *
 * This map drives the mega-menu, the shop-page fabric/sleeve filters, the
 * admin field visibility, and slug validation. Add a category or a deeper
 * attribute HERE and the rest of the app follows. Mirrors the brand
 * category spreadsheet.
 *
 * NOTE: fabric/sleeve are stored on Product via raw SQL (see
 * shopProducts.server.ts read + admin/products/$id.tsx write) because the
 * Prisma client isn't regenerated while PM2 holds the Windows query-engine
 * DLL — same pattern as Category.moodType.
 */

export type FabricSlug = "sport" | "cotton";
export type SleeveSlug = "long" | "short" | "sleeveless" | "velo";

export interface SubcategoryDef {
    label: string;
    /** Fabric lines offered for this subcategory (Level 3). Omit if N/A.
     *  Widened to string[] so the admin can introduce custom fabric CODES
     *  beyond the two built-ins; the built-in slugs above stay the default. */
    fabrics?: string[];
    /** Sleeve cuts offered for this subcategory (Level 4). Omit if N/A. */
    sleeves?: string[];
}

/** shop slug → (subcategory slug → definition) */
export type ShopTaxonomy = Record<string, Record<string, SubcategoryDef>>;

const FULL_SLEEVES: SleeveSlug[] = ["long", "short", "sleeveless", "velo"];

export const DEFAULT_TAXONOMY: ShopTaxonomy = {
    yoga: {
        jumpsuit: { label: "Комбінезони", fabrics: ["sport", "cotton"], sleeves: FULL_SLEEVES },
        leggings: { label: "Легінси", fabrics: ["sport", "cotton"] },
        velo: { label: "VELO", fabrics: ["sport", "cotton"] },
        tops: { label: "Топи", fabrics: ["sport", "cotton"] },
        shorts: { label: "Шорти", fabrics: ["sport", "cotton"] },
        longsleeve: { label: "Лонгсліви", fabrics: ["sport", "cotton"] },
        tshirts: { label: "Футболки, майки" },
    },
    sport: {
        // Sport jumpsuits are all "sport" fabric, so the menu lists the sleeve
        // cuts directly (no redundant fabric line) — matches the brand sheet + KIDS.
        jumpsuit: { label: "Комбінезони", sleeves: FULL_SLEEVES },
        leggings: { label: "Легінси" },
        velo: { label: "VELO" },
        tops: { label: "Топи" },
        shorts: { label: "Шорти" },
        longsleeve: { label: "Лонгсліви" },
        dance: { label: "Dance" },
    },
    dance: {
        jumpsuit: { label: "Комбінезони" },
        "net-models": { label: "Моделі із сітки" },
        "pole-sets": { label: "Комплекти пілон" },
    },
    casual: {
        suits: { label: "Костюми" },
        shirts: { label: "Сорочки" },
        tshirts: { label: "Футболки" },
        singlets: { label: "Майки" },
        shorts: { label: "Шорти" },
        thermo: { label: "Термо" },
        hoodies: { label: "Худі / Світшоти" },
        joggers: { label: "Джоггери" },
    },
    kids: {
        jumpsuit: { label: "Комбінезони", sleeves: FULL_SLEEVES },
    },
    yogatools: {
        yogamats: { label: "Yoga-килимки" },
        blocks: { label: "Блоки" },
        wheel: { label: "Колесо" },
        socks: { label: "Шкарпетки" },
        belts: { label: "Ремені" },
    },
};

// ---- DB-backed active taxonomy --------------------------------------------
// DEFAULT_TAXONOMY above is the permanent fallback. An admin can edit the
// taxonomy (categories + fabric/sleeve per shop), stored as JSON in the DB;
// `TAXONOMY` is the ACTIVE one — starts as the default, replaced at runtime by
// setActiveTaxonomy() once the DB config loads. A missing/empty/malformed row
// falls back to the default, so the menu/filters never break.
export let TAXONOMY: ShopTaxonomy = DEFAULT_TAXONOMY;

/** Swap in the active taxonomy from the DB config (null/empty → default), then
    re-derive the categoryMap-level lookups. The dynamic import avoids a static
    circular dependency. Awaitable so the server can set it before serving and
    the client before hydration. */
export async function setActiveTaxonomy(t: ShopTaxonomy | null | undefined): Promise<void> {
    TAXONOMY = t && typeof t === "object" && Object.keys(t).length > 0 ? t : DEFAULT_TAXONOMY;
    const m = await import("./categoryMap");
    m.refreshTaxonomyDerived();
}

// Built-in fabric/sleeve vocabulary — the permanent fallback. The admin can
// rename these labels and add new CODES via the editor; overrides live in the
// TaxonomyConfig envelope and are merged in by setVocabLabels() at load. Slugs
// (keys) are immutable structural glue (URLs + Product.fabric/sleeve rows); only
// labels are editable + new codes appendable.
export const DEFAULT_FABRIC_LABELS: Record<string, string> = {
    sport: "Sport",
    cotton: "Cotton",
};

export const DEFAULT_SLEEVE_LABELS: Record<string, string> = {
    long: "Рукав",
    short: "Короткий рукав",
    sleeveless: "Без рукава",
    velo: "Velo",
};

// Mutable `let` (ESM live bindings) — every importer sees the merged labels after
// setVocabLabels() runs, with no consumer changes (same pattern as TAXONOMY).
export let FABRIC_LABELS: Record<string, string> = { ...DEFAULT_FABRIC_LABELS };
export let SLEEVE_LABELS: Record<string, string> = { ...DEFAULT_SLEEVE_LABELS };
export let ALLOWED_FABRICS: ReadonlySet<string> = new Set(Object.keys(FABRIC_LABELS));
export let ALLOWED_SLEEVES: ReadonlySet<string> = new Set(Object.keys(SLEEVE_LABELS));

/** Apply the saved fabric/sleeve vocabulary. The saved map is AUTHORITATIVE —
    the editor always posts the FULL intended set, so a built-in the owner renamed
    or DELETED is honored exactly (no silent merge-back of defaults). Falls back to
    the built-in defaults only when no vocabulary is saved (legacy/empty config).
    Refreshes the ALLOWED_* sets so new codes validate and deleted ones don't. */
export function setVocabLabels(
    fabricLabels?: Record<string, string> | null,
    sleeveLabels?: Record<string, string> | null,
): void {
    const has = (m: unknown): m is Record<string, string> =>
        !!m && typeof m === "object" && !Array.isArray(m) && Object.keys(m).length > 0;
    FABRIC_LABELS = has(fabricLabels) ? { ...fabricLabels } : { ...DEFAULT_FABRIC_LABELS };
    SLEEVE_LABELS = has(sleeveLabels) ? { ...sleeveLabels } : { ...DEFAULT_SLEEVE_LABELS };
    ALLOWED_FABRICS = new Set(Object.keys(FABRIC_LABELS));
    ALLOWED_SLEEVES = new Set(Object.keys(SLEEVE_LABELS));
}

/** Top-level shop slugs, in display order. Fixed set (the editor manages the
    categories WITHIN each shop, not the shops themselves), so derive from the
    default — stable regardless of the active taxonomy. */
export const SHOP_SLUGS: string[] = Object.keys(DEFAULT_TAXONOMY);

/** Subcategory def for a (shop, sub) pair, or undefined. */
export function getSubcategoryDef(shop: string, sub: string): SubcategoryDef | undefined {
    return TAXONOMY[shop]?.[sub];
}

/** Ordered [slug, def] subcategory entries for a shop. */
export function subcategoriesFor(shop: string): Array<[string, SubcategoryDef]> {
    return Object.entries(TAXONOMY[shop] ?? {});
}

/** Fabrics offered for a (shop, sub) — empty when none. */
export function fabricsFor(shop: string, sub: string): string[] {
    return TAXONOMY[shop]?.[sub]?.fabrics ?? [];
}

/** Sleeves offered for a (shop, sub) — empty when none. */
export function sleevesFor(shop: string, sub: string): string[] {
    return TAXONOMY[shop]?.[sub]?.sleeves ?? [];
}

/** Union of fabrics across all subcats of a shop (for the shop-root page). */
export function fabricsForShop(shop: string): string[] {
    const set = new Set<string>();
    Object.values(TAXONOMY[shop] ?? {}).forEach((d) => d.fabrics?.forEach((f) => set.add(f)));
    return [...set];
}

/** Union of sleeves across all subcats of a shop. */
export function sleevesForShop(shop: string): string[] {
    const set = new Set<string>();
    Object.values(TAXONOMY[shop] ?? {}).forEach((d) => d.sleeves?.forEach((s) => set.add(s)));
    return [...set];
}

export function fabricLabel(slug: string): string {
    return FABRIC_LABELS[slug] ?? slug;
}

export function sleeveLabel(slug: string): string {
    return SLEEVE_LABELS[slug] ?? slug;
}
