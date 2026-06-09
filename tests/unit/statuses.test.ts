import { describe, it, expect } from "vitest";
import {
    canTransition,
    allowedNext,
    isOrderStatus,
    isPaymentStatus,
    ORDER_TRANSITIONS,
    ORDER_STATUSES,
} from "../../app/utils/statuses";

describe("order state-machine", () => {
    it("allows the forward lifecycle", () => {
        expect(canTransition("pending", "confirmed")).toBe(true);
        expect(canTransition("confirmed", "processing")).toBe(true);
        expect(canTransition("processing", "shipped")).toBe(true);
        expect(canTransition("shipped", "delivered")).toBe(true);
        expect(canTransition("delivered", "returned")).toBe(true);
    });

    it("allows cancel from any open state", () => {
        expect(canTransition("pending", "cancelled")).toBe(true);
        expect(canTransition("confirmed", "cancelled")).toBe(true);
        expect(canTransition("processing", "cancelled")).toBe(true);
        expect(canTransition("shipped", "cancelled")).toBe(true);
    });

    it("rejects illegal jumps", () => {
        expect(canTransition("delivered", "pending")).toBe(false); // backwards
        expect(canTransition("pending", "delivered")).toBe(false); // skip the flow
        expect(canTransition("delivered", "cancelled")).toBe(false); // too late to cancel
        expect(canTransition("cancelled", "shipped")).toBe(false); // terminal
        expect(canTransition("returned", "delivered")).toBe(false); // terminal
    });

    it("treats same → same as an allowed no-op", () => {
        expect(canTransition("pending", "pending")).toBe(true);
        expect(canTransition("cancelled", "cancelled")).toBe(true);
    });

    it("rejects unknown statuses on either side", () => {
        expect(canTransition("pending", "bogus")).toBe(false);
        expect(canTransition("bogus", "pending")).toBe(false);
    });

    it("allowedNext returns the current status plus its legal next states", () => {
        expect(allowedNext("pending")).toEqual(["pending", "confirmed", "processing", "cancelled"]);
        expect(allowedNext("delivered")).toEqual(["delivered", "returned"]);
        expect(allowedNext("cancelled")).toEqual(["cancelled"]); // terminal → just itself
    });

    it("guards order/payment status membership", () => {
        expect(isOrderStatus("delivered")).toBe(true);
        expect(isOrderStatus("bogus")).toBe(false);
        expect(isPaymentStatus("paid")).toBe(true);
        expect(isPaymentStatus("bogus")).toBe(false);
    });

    it("every order status has a transitions entry", () => {
        for (const s of ORDER_STATUSES) expect(ORDER_TRANSITIONS[s]).toBeDefined();
    });
});
