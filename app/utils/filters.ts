import { buildFilterCategories } from "./categoryMap";

export interface PriceRange {
    id: string;
    label: string;
    min: number;
    max: number;
}

export interface MergedFilterConfig {
    categories: Record<string, string>;
    colors: Record<string, string>;
    sizes: string[];
    priceRanges: PriceRange[];
}

export const DEFAULT_FILTER_CONFIG: MergedFilterConfig = {
    categories: buildFilterCategories([
        "jumpsuit",
        "leggings",
        "tops",
        "shorts",
        "longsleeve",
        "tshirts",
        "singlets",
        "sets",
        "jackets",
        "velo",
        "net-models",
        "pole-sets",
        "suits",
        "shirts",
        "thermo",
        "hoodies",
        "joggers",
    ]),
    colors: {
        black: "Чорний",
        white: "Білий",
        blue: "Синій",
        pink: "Рожевий",
        green: "Зелений",
        gray: "Сірий",
        red: "Червоний",
        other: "Інші",
    },
    sizes: ["XS", "S", "M", "L", "XL"],
    priceRanges: [
        { id: "low", label: "До 1000 ₴", min: 0, max: 1000 },
        { id: "mid", label: "1000 - 3000 ₴", min: 1000, max: 3000 },
        { id: "high", label: "3000 - 5000 ₴", min: 3000, max: 5000 },
        { id: "premium", label: "Від 5000 ₴", min: 5000, max: 999999 },
    ],
};

// What the DB-stored JSON may contain — every field is optional and may be
// missing/malformed, so we merge with DEFAULT_FILTER_CONFIG defensively.
type PartialFilterConfig = Partial<MergedFilterConfig>;

export function parseAndMergeFilterConfig(
    dbConfigString: string | null | undefined,
): MergedFilterConfig {
    let parsedConfig: PartialFilterConfig = {};
    if (dbConfigString) {
        try {
            parsedConfig = JSON.parse(dbConfigString) as PartialFilterConfig;
        } catch (e) {
            console.error("Failed to parse DB FilterConfig", e);
        }
    }

    return {
        categories: parsedConfig.categories || DEFAULT_FILTER_CONFIG.categories,
        colors: parsedConfig.colors || DEFAULT_FILTER_CONFIG.colors,
        sizes: parsedConfig.sizes || DEFAULT_FILTER_CONFIG.sizes,
        priceRanges: parsedConfig.priceRanges || DEFAULT_FILTER_CONFIG.priceRanges,
    };
}
