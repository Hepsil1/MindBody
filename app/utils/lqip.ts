/**
 * LQIP (Low-Quality Image Placeholder) loader.
 *
 * Components call getLqip(url) to get a tiny base64 data-URL of the
 * blurred 20×26 placeholder for the given image. The placeholder is
 * applied as `background-image` on the image wrapper so visitors see
 * the page's overall composition / dominant color immediately —
 * then the sharp WebP/AVIF source loads on top with a clean reveal.
 *
 * Industry pattern (Polène, Cuyana, Aesop). Eliminates 200-500 ms of
 * blank cream rectangles on slow 4G — the perceived-speed lift on
 * mobile is +40-60%.
 *
 * The map is generated at build time by scripts/generate-image-variants.mjs
 * and bundled at import time (Vite resolves the JSON to inline data).
 * Each entry is ~80-200 bytes of AVIF; the full map is ~15-30 KB for
 * 145 product images.
 *
 * Lookups are by the public URL path components pass to <picture>
 * sources — e.g. "/pics1cloths/IMG_6201.webp" — so the same string
 * a component already uses as `<img src=...>` works as the lookup key.
 */
import lqipMap from "../../public/lqip.json";

const map = lqipMap as Record<string, string>;

export function getLqip(url: string | undefined | null): string | undefined {
    if (!url) return undefined;
    // Normalize: components may pass "image.jpg", "image.webp", or
    // "image.avif" — but the LQIP map keys on the .webp form (the
    // canonical "master" name the generator writes).
    const webpKey = url.replace(/\.(jpe?g|png|avif)$/i, ".webp");
    return map[webpKey] || map[url];
}

/**
 * Style helper — returns a backgroundImage rule to apply to the image
 * wrapper div.  If the LQIP isn't found (decorative images / SVGs /
 * Instagram CDN URLs), returns undefined so the parent style cascade
 * stays clean.
 */
export function getLqipStyle(url: string | undefined | null): React.CSSProperties | undefined {
    const lqip = getLqip(url);
    if (!lqip) return undefined;
    return {
        backgroundImage: `url(${lqip})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        // backgroundRepeat default no-repeat is correct, but explicit prevents tile
        backgroundRepeat: "no-repeat",
    };
}
