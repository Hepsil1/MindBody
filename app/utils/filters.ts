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

    // Backfill a stable `id` on every price range. Older stored configs (and
    // manually-seeded ones) may have ranges without an id; the strict write
    // validator (validateFilterConfig) requires `id`, so without this the editor
    // could LOAD such a config but never save it — the Save silently failed with
    // "priceRanges.0.id: expected string". Deterministic (`range-<i>`) so the
    // dirty check stays stable across reloads.
    const rawRanges = parsedConfig.priceRanges || DEFAULT_FILTER_CONFIG.priceRanges;
    const priceRanges = (
        Array.isArray(rawRanges) ? rawRanges : DEFAULT_FILTER_CONFIG.priceRanges
    ).map((r, i) => ({
        id: r && typeof r.id === "string" && r.id.length ? r.id : `range-${i}`,
        label: r?.label ?? "",
        min: typeof r?.min === "number" ? r.min : 0,
        max: typeof r?.max === "number" ? r.max : 0,
    }));

    return {
        categories: parsedConfig.categories || DEFAULT_FILTER_CONFIG.categories,
        colors: parsedConfig.colors || DEFAULT_FILTER_CONFIG.colors,
        sizes: parsedConfig.sizes || DEFAULT_FILTER_CONFIG.sizes,
        priceRanges,
    };
}

/** Per-page facet counts (categories/colors/sizes -> product count). */
export interface FacetCounts {
    categories: Record<string, number>;
    colors: Record<string, number>;
    sizes: Record<string, number>;
}

/**
 * Single source of truth for "what filters actually exist on each shop page",
 * so the admin «Керування фільтрами» editor mirrors the live storefront (a
 * facet with 0 products on a page is hidden there too). Counts the RAW stored
 * values (slug OR legacy label form) — the consumer reconciles slug-vs-label at
 * display time. A "global" bucket sums across all pages = the master vocabulary.
 * Pure (no DB / no server-only imports) so it is safe to import from a route
 * file without dragging server code into the client bundle.
 */
export function deriveAvailableFacets(
    rows: Array<{
        shopPageSlug: string | null;
        category: string | null;
        colors: string | null;
        sizes: string | null;
    }>,
): Record<string, FacetCounts> {
    const parseArr = (s: string | null): string[] => {
        if (!s) return [];
        try {
            const v = JSON.parse(s);
            return Array.isArray(v) ? v : [];
        } catch {
            return [];
        }
    };
    const out: Record<string, FacetCounts> = {};
    const ensure = (slug: string): FacetCounts => {
        out[slug] ??= { categories: {}, colors: {}, sizes: {} };
        return out[slug];
    };
    const bump = (bucket: Record<string, number>, key: unknown) => {
        if (typeof key !== "string" || !key) return;
        bucket[key] = (bucket[key] || 0) + 1;
    };
    const global = ensure("global");
    for (const r of rows) {
        if (!r.shopPageSlug) continue;
        const page = ensure(r.shopPageSlug);
        bump(page.categories, r.category);
        bump(global.categories, r.category);
        for (const c of parseArr(r.colors)) {
            bump(page.colors, c);
            bump(global.colors, c);
        }
        for (const s of parseArr(r.sizes)) {
            bump(page.sizes, s);
            bump(global.sizes, s);
        }
    }
    return out;
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
