import { describe, it, expect } from "vitest";
import {
    computeDiscount,
    validateAndApplyPromo,
    PromoError,
} from "../../app/services/promo.server";
import { planOrderDecrement, InsufficientStockError } from "../../app/services/inventory.server";

// Pure service logic — no DB. The DB-coupled behaviours (atomic create,
// idempotency, oversell under concurrency, stock restore) are covered by the
// Playwright E2E suite against the test database.

describe("computeDiscount", () => {
    it("percent rounds to whole UAH", () => {
        expect(computeDiscount("percent", 10, 1000)).toBe(100);
        expect(computeDiscount("percent", 15, 1499)).toBe(225); // round(224.85)
    });
    it("fixed uses the value as-is", () => {
        expect(computeDiscount("fixed", 100, 1000)).toBe(100);
    });
    it("clamps to subtotal so the total can never go negative", () => {
        expect(computeDiscount("fixed", 5000, 1000)).toBe(1000);
        expect(computeDiscount("percent", 150, 1000)).toBe(1000);
    });
    it("never returns a negative discount", () => {
        expect(computeDiscount("fixed", -50, 1000)).toBe(0);
    });
});

const basePromo = {
    code: "X",
    discountType: "percent",
    discountValue: 10,
    minOrder: 0,
    maxUses: null as number | null,
    usedCount: 0,
    isActive: true,
    expiresAt: null as Date | null,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeDb = (promo: unknown) => ({ promoCode: { findUnique: async () => promo } }) as any;

describe("validateAndApplyPromo", () => {
    it("applies a valid percent code and returns the snapshot", async () => {
        const r = await validateAndApplyPromo(fakeDb(basePromo), "x", 1000);
        expect(r).toEqual({ code: "X", discount: 100, finalTotal: 900 });
    });
    it("rejects an unknown code", async () => {
        await expect(validateAndApplyPromo(fakeDb(null), "x", 1000)).rejects.toBeInstanceOf(
            PromoError,
        );
    });
    it("rejects an inactive code", async () => {
        await expect(
            validateAndApplyPromo(fakeDb({ ...basePromo, isActive: false }), "x", 1000),
        ).rejects.toBeInstanceOf(PromoError);
    });
    it("rejects an expired code", async () => {
        await expect(
            validateAndApplyPromo(
                fakeDb({ ...basePromo, expiresAt: new Date(Date.now() - 1000) }),
                "x",
                1000,
            ),
        ).rejects.toBeInstanceOf(PromoError);
    });
    it("rejects an exhausted code (usedCount >= maxUses)", async () => {
        await expect(
            validateAndApplyPromo(fakeDb({ ...basePromo, maxUses: 5, usedCount: 5 }), "x", 1000),
        ).rejects.toBeInstanceOf(PromoError);
    });
    it("rejects below the minimum order", async () => {
        await expect(
            validateAndApplyPromo(fakeDb({ ...basePromo, minOrder: 1500 }), "x", 1000),
        ).rejects.toBeInstanceOf(PromoError);
    });
});

describe("planOrderDecrement", () => {
    it("decrements the matched variant and recomputes the aggregate", () => {
        const inv = [
            { size: "S", color: "black", stock: 4 },
            { size: "M", color: "black", stock: 5 },
        ];
        const plan = planOrderDecrement("Test", 9, inv, { size: "M", color: "black", quantity: 2 });
        expect(plan.before).toBe(5);
        expect(plan.after).toBe(3);
        expect(plan.newStock).toBe(7); // 4 + 3
        expect(plan.variantKey).toBe("M/black");
        expect(JSON.parse(plan.newInventoryJson!)).toEqual([
            { size: "S", color: "black", stock: 4 },
            { size: "M", color: "black", stock: 3 },
        ]);
    });
    it("throws when the variant has insufficient stock (oversell guard)", () => {
        const inv = [{ size: "M", color: "black", stock: 1 }];
        expect(() =>
            planOrderDecrement("T", 1, inv, { size: "M", color: "black", quantity: 2 }),
        ).toThrow(InsufficientStockError);
    });
    it("throws when the requested variant does not exist", () => {
        const inv = [{ size: "M", color: "black", stock: 5 }];
        expect(() =>
            planOrderDecrement("T", 5, inv, { size: "L", color: "black", quantity: 1 }),
        ).toThrow(InsufficientStockError);
    });
    it("decrements the aggregate when there are no variants", () => {
        const plan = planOrderDecrement("T", 10, [], { size: null, color: null, quantity: 3 });
        expect(plan.newInventoryJson).toBeNull();
        expect(plan.newStock).toBe(7);
        expect(plan.variantKey).toBeNull();
    });
    it("throws on aggregate oversell", () => {
        expect(() =>
            planOrderDecrement("T", 2, [], { size: null, color: null, quantity: 3 }),
        ).toThrow(InsufficientStockError);
    });
});
