import { z } from "zod";
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

// Write-time validation for the admin filter editor. The READ path
// (parseAndMergeFilterConfig) is intentionally lenient (falls back to defaults on
// bad data), which meant the editor could silently persist malformed JSON and the
// operator would believe it saved. This is the strict gate used before upsert.
const PriceRangeSchema = z
    .object({
        id: z.string().min(1),
        label: z.string().min(1),
        min: z.number().min(0),
        max: z.number().min(0),
    })
    .refine((r) => r.min <= r.max, {
        message: "мін. ціна не може бути більшою за макс.",
    });

const FilterConfigSchema = z.object({
    categories: z.record(z.string(), z.string()),
    colors: z.record(z.string(), z.string()),
    sizes: z.array(z.string()),
    priceRanges: z.array(PriceRangeSchema),
});

export type ValidatedFilterConfig =
    | { ok: true; value: MergedFilterConfig }
    | { ok: false; error: string };

/** Parse + schema-validate a filter config JSON string before it is persisted. */
export function validateFilterConfig(raw: string | null | undefined): ValidatedFilterConfig {
    if (!raw || !raw.trim()) {
        return { ok: false, error: "Порожній конфіг фільтрів." };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, error: "Конфіг фільтрів — некоректний JSON." };
    }
    const result = FilterConfigSchema.safeParse(parsed);
    if (!result.success) {
        const first = result.error.issues[0];
        const path = first?.path?.join(".") || "config";
        return { ok: false, error: `Некоректний конфіг фільтрів (${path}: ${first?.message}).` };
    }
    return { ok: true, value: result.data as MergedFilterConfig };
}
