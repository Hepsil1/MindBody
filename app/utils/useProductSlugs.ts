import { useEffect, useState } from "react";

// Resolve productId → slug for localStorage-backed surfaces (wishlist, cart) so
// their links point at the canonical /p/<slug> URL while still STORING only the
// id. Results are cached at module level, so navigating between pages (or having
// the same id in both the wishlist and the cart) doesn't refetch. An id with no
// active slug is cached as "" so we don't retry it forever — the caller falls
// back to /product/<id> (which 301s).
const cache = new Map<string, string>();

export function useProductSlugs(ids: string[]): Record<string, string> {
    const [, force] = useState(0);
    const key = Array.from(new Set(ids)).sort().join(",");

    useEffect(() => {
        const missing = ids.map(String).filter((id) => id && !cache.has(id));
        if (missing.length === 0) return;
        let cancelled = false;
        fetch(`/api/products/slugs?ids=${encodeURIComponent(missing.join(","))}`)
            .then((r) => (r.ok ? r.json() : {}))
            .then((map: Record<string, string>) => {
                if (cancelled) return;
                for (const [id, slug] of Object.entries(map)) if (slug) cache.set(id, slug);
                for (const id of missing) if (!cache.has(id)) cache.set(id, ""); // resolved-empty
                force((n) => n + 1);
            })
            .catch(() => {
                /* network error — links keep their /product/<id> fallback */
            });
        return () => {
            cancelled = true;
        };
    }, [key]);

    const out: Record<string, string> = {};
    for (const id of ids) {
        const s = cache.get(String(id));
        if (s) out[String(id)] = s;
    }
    return out;
}

/** Build the canonical product URL: /p/<slug> when known, else /product/<id>. */
export function productHref(id: string | number, slug?: string): string {
    return slug ? `/p/${slug}` : `/product/${id}`;
}
