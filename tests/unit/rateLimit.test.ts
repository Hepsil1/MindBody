import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit } from "../../app/utils/rateLimit.server";

// Helper: build a Request with a synthetic IP header. Each test uses a
// unique IP so the in-memory store doesn't leak between cases.
let ipCounter = 0;
const makeRequest = (overrideIp?: string): Request => {
    const ip = overrideIp ?? `10.0.0.${++ipCounter}`;
    return new Request("http://localhost/test", {
        headers: { "x-forwarded-for": ip },
    });
};

describe("checkRateLimit", () => {
    // Use fake timers so we can advance through the rate-limit window precisely.
    beforeEach(() => {
        vi.useFakeTimers();
        // Pin to a known epoch so resetAt math is predictable.
        vi.setSystemTime(new Date("2026-05-17T12:00:00Z"));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("allows the first request and returns null", () => {
        const res = checkRateLimit(makeRequest(), "test-allow", 3, 60_000);
        expect(res).toBeNull();
    });

    it("allows up to maxRequests in the window", () => {
        const req = makeRequest("10.1.0.1");
        expect(checkRateLimit(req, "test-burst", 3, 60_000)).toBeNull();
        expect(checkRateLimit(req, "test-burst", 3, 60_000)).toBeNull();
        expect(checkRateLimit(req, "test-burst", 3, 60_000)).toBeNull();
    });

    it("returns a 429 Response on the maxRequests+1 request", () => {
        const req = makeRequest("10.1.0.2");
        for (let i = 0; i < 3; i++) {
            expect(checkRateLimit(req, "test-block", 3, 60_000)).toBeNull();
        }
        const res = checkRateLimit(req, "test-block", 3, 60_000);
        expect(res).toBeInstanceOf(Response);
        expect(res?.status).toBe(429);
    });

    it("429 response includes Retry-After header", async () => {
        const req = makeRequest("10.1.0.3");
        for (let i = 0; i < 2; i++) checkRateLimit(req, "test-retry", 1, 60_000);
        const blocked = checkRateLimit(req, "test-retry", 1, 60_000)!;
        const retryAfter = blocked.headers.get("Retry-After");
        expect(retryAfter).not.toBeNull();
        expect(Number(retryAfter)).toBeGreaterThan(0);
        expect(Number(retryAfter)).toBeLessThanOrEqual(60);
    });

    it("429 response body has a Ukrainian error message", async () => {
        const req = makeRequest("10.1.0.4");
        for (let i = 0; i < 2; i++) checkRateLimit(req, "test-msg", 1, 60_000);
        const blocked = checkRateLimit(req, "test-msg", 1, 60_000)!;
        const body = (await blocked.json()) as { error: string };
        expect(body.error).toMatch(/Забагато запитів/);
    });

    it("starts a new window after the previous one expires", () => {
        const req = makeRequest("10.1.0.5");
        // Burn through the limit
        for (let i = 0; i < 2; i++) checkRateLimit(req, "test-window", 1, 60_000);
        // Confirm we're blocked
        expect(checkRateLimit(req, "test-window", 1, 60_000)?.status).toBe(429);

        // Advance past the window
        vi.advanceTimersByTime(61_000);

        // First request in the new window should pass
        expect(checkRateLimit(req, "test-window", 1, 60_000)).toBeNull();
    });

    it("tracks limits per (key, IP) independently", () => {
        // Same key, different IPs — both get their own bucket.
        checkRateLimit(makeRequest("10.2.0.1"), "shared-key", 1, 60_000);
        checkRateLimit(makeRequest("10.2.0.1"), "shared-key", 1, 60_000);
        expect(checkRateLimit(makeRequest("10.2.0.1"), "shared-key", 1, 60_000)?.status).toBe(429);
        // Different IP, same key — still has fresh budget.
        expect(checkRateLimit(makeRequest("10.2.0.2"), "shared-key", 1, 60_000)).toBeNull();
    });

    it("tracks limits per key independently (same IP, different routes)", () => {
        const reqA = makeRequest("10.3.0.1");
        // Burn route A's budget
        for (let i = 0; i < 2; i++) checkRateLimit(reqA, "route-a", 1, 60_000);
        expect(checkRateLimit(reqA, "route-a", 1, 60_000)?.status).toBe(429);

        // Same IP, different route — fresh budget
        expect(checkRateLimit(reqA, "route-b", 1, 60_000)).toBeNull();
    });

    it("falls back to x-real-ip when x-forwarded-for is absent", () => {
        const req = new Request("http://localhost/test", {
            headers: { "x-real-ip": "10.4.0.1" },
        });
        // maxRequests=2 → first two requests allowed, third blocked.
        expect(checkRateLimit(req, "real-ip-test", 2, 60_000)).toBeNull();
        expect(checkRateLimit(req, "real-ip-test", 2, 60_000)).toBeNull();
        expect(checkRateLimit(req, "real-ip-test", 2, 60_000)?.status).toBe(429);
    });

    it("uses 'unknown' as IP when no headers are present", () => {
        const req = new Request("http://localhost/test");
        // 'unknown' is a fine sentinel — all requests without headers share a bucket
        const first = checkRateLimit(req, "no-headers-test", 1, 60_000);
        expect(first).toBeNull();
    });

    it("takes the first IP from a comma-separated x-forwarded-for", () => {
        // Standard proxy chain: client, proxy1, proxy2.
        // Only the first (client) IP should count for rate-limiting.
        const req = new Request("http://localhost/test", {
            headers: { "x-forwarded-for": "10.5.0.1, 192.168.1.1, 10.0.0.1" },
        });
        const req2 = new Request("http://localhost/test", {
            headers: { "x-forwarded-for": "10.5.0.1, different-proxy" },
        });

        checkRateLimit(req, "chain-test", 1, 60_000);
        checkRateLimit(req2, "chain-test", 1, 60_000);
        // Both should hit the SAME bucket because client IP (10.5.0.1) matches.
        expect(checkRateLimit(req, "chain-test", 1, 60_000)?.status).toBe(429);
    });
});
