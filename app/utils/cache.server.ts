/**
 * Simple in-memory cache for server-side data.
 * Avoids hitting the remote DB on every page load.
 * TTL-based expiration ensures fresh data after admin changes.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data or fetch it fresh.
 * @param key - Cache key
 * @param ttlMs - Time to live in milliseconds (default: 60s)
 * @param fetcher - Async function to fetch fresh data
 */
export async function cachedFetch<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
): Promise<T> {
    const existing = cache.get(key) as CacheEntry<T> | undefined;

    if (existing && Date.now() - existing.timestamp < ttlMs) {
        return existing.data;
    }

    const data = await fetcher();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
}

/**
 * Invalidate a specific cache key.
 * Call this from admin routes after saving changes.
 */
export function invalidateCache(key: string) {
    cache.delete(key);
}

/**
 * Invalidate a key AND all its sub-keys (`prefix` itself plus `prefix:*`).
 * Needed where two cache layers share a namespace: the shop page caches the
 * whole loader result under `shop:{slug}` while loadShopData() caches its own
 * slice under `shop:{slug}:{sub|all}` — deleting only the outer key let the
 * inner one serve stale data for up to its TTL after an admin save. The `:`
 * boundary keeps `shop:yoga` from also nuking `shop:yogatools`.
 */
export function invalidatePrefix(prefix: string) {
    for (const key of cache.keys()) {
        if (key === prefix || key.startsWith(`${prefix}:`)) cache.delete(key);
    }
}

/**
 * Invalidate all cache entries.
 */
export function invalidateAll() {
    cache.clear();
}
