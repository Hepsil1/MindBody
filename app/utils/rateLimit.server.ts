/**
 * Simple in-memory rate limiter for API routes.
 * Limits requests per IP address within a sliding window.
 * Resets on cold start (acceptable for Vercel serverless).
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Check if a request is rate-limited.
 * @param request - The incoming request
 * @param key - A unique key for this rate limit (e.g., route name)
 * @param maxRequests - Max requests allowed within the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @returns null if allowed, or a Response (429) if rate-limited
 */
export function checkRateLimit(
    request: Request,
    key: string,
    maxRequests: number = 10,
    windowMs: number = 60_000
): Response | null {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown";

    const compositeKey = `${key}:${ip}`;
    const now = Date.now();
    const entry = store.get(compositeKey);

    if (!entry || now > entry.resetAt) {
        // New window
        store.set(compositeKey, { count: 1, resetAt: now + windowMs });
        return null;
    }

    entry.count++;

    if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new Response(
            JSON.stringify({ error: `Забагато запитів. Спробуйте через ${retryAfter} секунд.` }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    "Retry-After": String(retryAfter),
                },
            }
        );
    }

    return null;
}
