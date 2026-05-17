import { buildFilterCategories } from "./categoryMap";

export const DEFAULT_FILTER_CONFIG = {
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

export function parseAndMergeFilterConfig(dbConfigString: string | null | undefined) {
    let parsedConfig: any = {};
    if (dbConfigString) {
        try {
            parsedConfig = JSON.parse(dbConfigString);
        } catch (e) {
            console.error("Failed to parse DB FilterConfig", e);
        }
    }

    return {
        ...DEFAULT_FILTER_CONFIG,
        ...parsedConfig,
        categories: parsedConfig.categories || DEFAULT_FILTER_CONFIG.categories,
        colors: parsedConfig.colors || DEFAULT_FILTER_CONFIG.colors,
        sizes: parsedConfig.sizes || DEFAULT_FILTER_CONFIG.sizes,
        priceRanges: parsedConfig.priceRanges || DEFAULT_FILTER_CONFIG.priceRanges,
    };
}
