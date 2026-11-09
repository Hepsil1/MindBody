/**
 * Colourway families — "each colour is its own product" (Zara / Alo model).
 *
 * Products of one model are linked by SKU convention, no schema change:
 *   K-JUMP-MINI-01  (pink)    ┐
 *   K-JUMP-MINI-02  (marsala) ┴─ family base "K-JUMP-MINI"
 *
 * A family base = SKU minus a trailing 2–3 digit colourway counter, and the
 * base must itself contain a hyphen. That deliberately rejects legacy
 * supplier codes (`TG-2660`, `TG-3297`): their 4-digit tail isn't a counter
 * and `TG` has no hyphen, so unrelated products never get linked by accident.
 */

const FAMILY_SKU = /^(.+-[^-]+)-(\d{2,3})$/;

/** `K-JUMP-MINI-01` → `K-JUMP-MINI`; `TG-2660` / null / free text → null. */
export function familyBaseFromSku(sku: string | null | undefined): string | null {
    if (!sku) return null;
    const m = FAMILY_SKU.exec(sku.trim());
    return m ? m[1] : null;
}

/** True when `sku` is a colourway of `base` (exact base — `K-JUMP-MINI-PRO-01` is NOT). */
export function isSkuInFamily(sku: string | null | undefined, base: string): boolean {
    return familyBaseFromSku(sku) === base;
}

/** One sibling colourway as the PDP needs it. */
export interface ColorSibling {
    slug: string;
    sku: string;
    /** The colour this sibling product sells (first in-stock colour). */
    color: string;
    inStock: boolean;
}
