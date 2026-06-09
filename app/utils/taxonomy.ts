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
    /** Fabric lines offered for this subcategory (Level 3). Omit if N/A. */
    fabrics?: FabricSlug[];
    /** Sleeve cuts offered for this subcategory (Level 4). Omit if N/A. */
    sleeves?: SleeveSlug[];
}

/** shop slug → (subcategory slug → definition) */
export type ShopTaxonomy = Record<string, Record<string, SubcategoryDef>>;

const FULL_SLEEVES: SleeveSlug[] = ["long", "short", "sleeveless", "velo"];

export const TAXONOMY: ShopTaxonomy = {
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
        jumpsuit: { label: "Комбінезони", fabrics: ["sport"], sleeves: FULL_SLEEVES },
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

export const FABRIC_LABELS: Record<FabricSlug, string> = {
    sport: "Sport",
    cotton: "Cotton",
};

export const SLEEVE_LABELS: Record<SleeveSlug, string> = {
    long: "Рукав",
    short: "Короткий рукав",
    sleeveless: "Без рукава",
    velo: "Velo",
};

export const ALLOWED_FABRICS: ReadonlySet<string> = new Set(Object.keys(FABRIC_LABELS));
export const ALLOWED_SLEEVES: ReadonlySet<string> = new Set(Object.keys(SLEEVE_LABELS));

/** Top-level shop slugs, in display order. */
export const SHOP_SLUGS: string[] = Object.keys(TAXONOMY);

/** Subcategory def for a (shop, sub) pair, or undefined. */
export function getSubcategoryDef(shop: string, sub: string): SubcategoryDef | undefined {
    return TAXONOMY[shop]?.[sub];
}

/** Ordered [slug, def] subcategory entries for a shop. */
export function subcategoriesFor(shop: string): Array<[string, SubcategoryDef]> {
    return Object.entries(TAXONOMY[shop] ?? {});
}

/** Fabrics offered for a (shop, sub) — empty when none. */
export function fabricsFor(shop: string, sub: string): FabricSlug[] {
    return TAXONOMY[shop]?.[sub]?.fabrics ?? [];
}

/** Sleeves offered for a (shop, sub) — empty when none. */
export function sleevesFor(shop: string, sub: string): SleeveSlug[] {
    return TAXONOMY[shop]?.[sub]?.sleeves ?? [];
}

/** Union of fabrics across all subcats of a shop (for the shop-root page). */
export function fabricsForShop(shop: string): FabricSlug[] {
    const set = new Set<FabricSlug>();
    Object.values(TAXONOMY[shop] ?? {}).forEach((d) => d.fabrics?.forEach((f) => set.add(f)));
    return [...set];
}

/** Union of sleeves across all subcats of a shop. */
export function sleevesForShop(shop: string): SleeveSlug[] {
    const set = new Set<SleeveSlug>();
    Object.values(TAXONOMY[shop] ?? {}).forEach((d) => d.sleeves?.forEach((s) => set.add(s)));
    return [...set];
}

export function fabricLabel(slug: string): string {
    return FABRIC_LABELS[slug as FabricSlug] ?? slug;
}

export function sleeveLabel(slug: string): string {
    return SLEEVE_LABELS[slug as SleeveSlug] ?? slug;
}
