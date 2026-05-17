import { describe, it, expect } from "vitest";
import {
    parseAndMergeFilterConfig,
    DEFAULT_FILTER_CONFIG,
    type MergedFilterConfig,
} from "../../app/utils/filters";

describe("DEFAULT_FILTER_CONFIG", () => {
    it("has the four required top-level groups", () => {
        expect(DEFAULT_FILTER_CONFIG).toHaveProperty("categories");
        expect(DEFAULT_FILTER_CONFIG).toHaveProperty("colors");
        expect(DEFAULT_FILTER_CONFIG).toHaveProperty("sizes");
        expect(DEFAULT_FILTER_CONFIG).toHaveProperty("priceRanges");
    });

    it("sizes include the common S/M/L set", () => {
        expect(DEFAULT_FILTER_CONFIG.sizes).toEqual(
            expect.arrayContaining(["XS", "S", "M", "L", "XL"]),
        );
    });

    it("priceRanges have id/label/min/max shape", () => {
        for (const r of DEFAULT_FILTER_CONFIG.priceRanges) {
            expect(typeof r.id).toBe("string");
            expect(typeof r.label).toBe("string");
            expect(typeof r.min).toBe("number");
            expect(typeof r.max).toBe("number");
            expect(r.max).toBeGreaterThanOrEqual(r.min);
        }
    });
});

describe("parseAndMergeFilterConfig", () => {
    it("returns DEFAULT_FILTER_CONFIG when input is null", () => {
        const result = parseAndMergeFilterConfig(null);
        expect(result).toEqual(DEFAULT_FILTER_CONFIG);
    });

    it("returns DEFAULT_FILTER_CONFIG when input is undefined", () => {
        const result = parseAndMergeFilterConfig(undefined);
        expect(result).toEqual(DEFAULT_FILTER_CONFIG);
    });

    it("returns DEFAULT_FILTER_CONFIG when input is empty string", () => {
        const result = parseAndMergeFilterConfig("");
        expect(result).toEqual(DEFAULT_FILTER_CONFIG);
    });

    it("returns DEFAULT_FILTER_CONFIG when JSON is malformed", () => {
        const result = parseAndMergeFilterConfig("{not-valid-json");
        expect(result).toEqual(DEFAULT_FILTER_CONFIG);
    });

    it("overrides categories from the DB config while keeping other defaults", () => {
        const dbConfig = JSON.stringify({
            categories: { yoga: "Yoga", sport: "Sport" },
        });
        const result = parseAndMergeFilterConfig(dbConfig);
        expect(result.categories).toEqual({ yoga: "Yoga", sport: "Sport" });
        // Other groups should fall back to defaults
        expect(result.sizes).toEqual(DEFAULT_FILTER_CONFIG.sizes);
        expect(result.colors).toEqual(DEFAULT_FILTER_CONFIG.colors);
        expect(result.priceRanges).toEqual(DEFAULT_FILTER_CONFIG.priceRanges);
    });

    it("overrides sizes from the DB config", () => {
        const dbConfig = JSON.stringify({ sizes: ["XXS", "M", "XXXL"] });
        const result = parseAndMergeFilterConfig(dbConfig);
        expect(result.sizes).toEqual(["XXS", "M", "XXXL"]);
    });

    it("overrides priceRanges from the DB config", () => {
        const customRanges = [
            { id: "cheap", label: "Cheap", min: 0, max: 500 },
            { id: "lux", label: "Luxury", min: 5000, max: 100000 },
        ];
        const result = parseAndMergeFilterConfig(JSON.stringify({ priceRanges: customRanges }));
        expect(result.priceRanges).toEqual(customRanges);
    });

    it("ignores extra fields in the DB JSON (forward compatibility)", () => {
        const dbConfig = JSON.stringify({
            unknownField: "ignore me",
            categories: { yoga: "Yoga" },
        });
        // Should not throw; returns valid shape.
        const result = parseAndMergeFilterConfig(dbConfig);
        expect(result.categories).toEqual({ yoga: "Yoga" });
        // No "unknownField" property leaks into MergedFilterConfig
        expect(
            (result as MergedFilterConfig & { unknownField?: string }).unknownField,
        ).toBeUndefined();
    });

    it("falls back per-field when a field is explicitly empty/null in DB", () => {
        const dbConfig = JSON.stringify({
            categories: null,
            colors: null,
            sizes: null,
            priceRanges: null,
        });
        const result = parseAndMergeFilterConfig(dbConfig);
        // Defaults take over since `null || DEFAULTS` resolves to DEFAULTS
        expect(result.categories).toEqual(DEFAULT_FILTER_CONFIG.categories);
        expect(result.colors).toEqual(DEFAULT_FILTER_CONFIG.colors);
        expect(result.sizes).toEqual(DEFAULT_FILTER_CONFIG.sizes);
        expect(result.priceRanges).toEqual(DEFAULT_FILTER_CONFIG.priceRanges);
    });
});
