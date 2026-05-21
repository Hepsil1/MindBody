import { describe, it, expect } from "vitest";
import {
    CATEGORY_MAP,
    CATEGORY_BY_SHOP_PAGE,
    ALLOWED_CATEGORY_SLUGS,
    isValidSubcategory,
    buildSubcategoryUrl,
    slugToLabel,
    labelToSlug,
} from "../../app/utils/categoryMap";

describe("CATEGORY_MAP", () => {
    it("has the canonical entries we rely on in URLs", () => {
        // These are the slugs referenced from Header.tsx and the
        // /shop/:cat/:sub route — break them and links 404.
        expect(CATEGORY_MAP.longsleeve).toBe("Лонгсліви");
        expect(CATEGORY_MAP.leggings).toBe("Легінси");
        expect(CATEGORY_MAP.jumpsuit).toBe("Комбінезони");
        expect(CATEGORY_MAP.tools).toBe("Інвентар");
    });

    it("uses lowercase-with-hyphen slugs only", () => {
        for (const slug of Object.keys(CATEGORY_MAP)) {
            expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
        }
    });
});

describe("slugToLabel / labelToSlug", () => {
    it("converts known slugs to their Ukrainian label", () => {
        expect(slugToLabel("longsleeve")).toBe("Лонгсліви");
        expect(slugToLabel("hoodies")).toBe("Худі / Світшоти");
    });

    it("falls back to the slug itself when unknown", () => {
        expect(slugToLabel("not-a-real-slug")).toBe("not-a-real-slug");
    });

    it("converts known labels to slug (legacy ?cat= support)", () => {
        expect(labelToSlug("Лонгсліви")).toBe("longsleeve");
        expect(labelToSlug("Легінси")).toBe("leggings");
    });

    it("returns null for unknown labels", () => {
        expect(labelToSlug("Невідома категорія")).toBeNull();
    });
});

describe("CATEGORY_BY_SHOP_PAGE / isValidSubcategory", () => {
    it("covers all five storefront shops + yogatools", () => {
        expect(Object.keys(CATEGORY_BY_SHOP_PAGE).sort()).toEqual(
            ["casual", "dance", "kids", "sport", "yoga", "yogatools"].sort(),
        );
    });

    it("each whitelisted slug exists in CATEGORY_MAP", () => {
        for (const [shop, subs] of Object.entries(CATEGORY_BY_SHOP_PAGE)) {
            for (const sub of subs) {
                expect(ALLOWED_CATEGORY_SLUGS.has(sub)).toBe(true);
                expect(CATEGORY_MAP[sub], `${shop}/${sub} missing label`).toBeDefined();
            }
        }
    });

    it("accepts real shop/subcategory pairs", () => {
        expect(isValidSubcategory("yoga", "longsleeve")).toBe(true);
        expect(isValidSubcategory("dance", "pole-sets")).toBe(true);
        expect(isValidSubcategory("yogatools", "tools")).toBe(true);
    });

    it("rejects pairs where the sub does not belong to that shop", () => {
        // pole-sets is dance-only — yoga must 301 it back.
        expect(isValidSubcategory("yoga", "pole-sets")).toBe(false);
        // tools only lives in yogatools.
        expect(isValidSubcategory("sport", "tools")).toBe(false);
    });

    it("rejects unknown shops", () => {
        expect(isValidSubcategory("bogus", "longsleeve")).toBe(false);
    });

    it("rejects unknown subs", () => {
        expect(isValidSubcategory("yoga", "made-up-slug")).toBe(false);
    });
});

describe("buildSubcategoryUrl", () => {
    it("produces /shop/<shop>/<sub> with no query", () => {
        expect(buildSubcategoryUrl("sport", "longsleeve")).toBe("/shop/sport/longsleeve");
        expect(buildSubcategoryUrl("dance", "pole-sets")).toBe("/shop/dance/pole-sets");
    });
});
