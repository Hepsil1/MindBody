/**
 * Format a number as a uk-UA price string (space thousands separator, e.g.
 * "2 490").
 *
 * The locale is PINNED to "uk-UA" on purpose: a bare `n.toLocaleString()` uses
 * the runtime's default locale, so the server (OS default, often en-US → "2,490")
 * and a Ukrainian browser (uk-UA → "2 490" with a U+00A0 separator) produce
 * DIFFERENT text. For SSR'd prices (product cards, PDP) that mismatch triggers a
 * React #418 hydration error on every 4-digit price. Always format through this.
 */
export function formatPrice(n: number | string): string {
    return Number(n).toLocaleString("uk-UA");
}

/** Brand placeholder shown when a product image is missing/broken. */
export const IMAGE_FALLBACK = "/brand-sun.png";

/**
 * Resolve a stored product image path to a usable <img src>. Persisted cart /
 * wishlist / order items can hold a bare filename ("abc.webp") which would 404
 * as a relative path on /checkout etc.; prefix those with /uploads/ (matching
 * CartDrawer). Already-absolute (http or /) paths pass through.
 */
export function productImageSrc(image: string | null | undefined): string {
    if (!image) return IMAGE_FALLBACK;
    if (image.startsWith("http") || image.startsWith("/")) return image;
    return `/uploads/${image}`;
}
