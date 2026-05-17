import { describe, it, expect } from "vitest";

// Smoke test — proves Vitest is wired up correctly. If this fails, the
// problem is in vitest.config.ts or the package.json scripts, not the code.
describe("smoke", () => {
    it("runs", () => {
        expect(1 + 1).toBe(2);
    });

    it("imports a TypeScript module via the ~/ alias", async () => {
        const { DEFAULT_FILTER_CONFIG } = await import("../app/utils/filters");
        expect(DEFAULT_FILTER_CONFIG.sizes).toContain("M");
        expect(DEFAULT_FILTER_CONFIG.priceRanges.length).toBeGreaterThan(0);
    });
});
