/**
 * Delivery is always paid at the carrier's tariff; no free-shipping offer.
 *
 * Shipping is charged at Nova Poshta's / Ukrposhta's rate, paid on receipt —
 * there is no order-value threshold that ships free. The exports below are
 * kept inert so any lingering importer compiles, but the site shows no
 * free-shipping UI: the cart, checkout summary, prose pages (delivery, FAQ,
 * terms) and the product JSON-LD all state the carrier-tariff wording instead.
 */
export const FREE_SHIPPING_THRESHOLD = Infinity;

/** No free-shipping offer exists — always false. */
export function qualifiesForFreeShipping(_subtotalUah: number): boolean {
    return false;
}
