import { prisma } from "../db.server";
import { cachedFetch } from "./cache.server";

const CACHE_KEY = "mega:counts";
const CACHE_TTL = 5 * 60_000;

/**
 * Mega-menu coverage map — answers "does the deep link `/shop/{shop}/
 * {sub}?fabric={f}&sleeve={s}` actually land on at least one product?"
 * for every leaf the menu can render.
 *
 * Why this exists: the menu is taxonomy-driven (utils/taxonomy.ts). With
 * 47 products and ~25 leaves per category, plenty of fabric×sleeve
 * combinations have zero matches — the audit caught users clicking from
 * the main nav straight onto an empty "0 ТОВАРІВ" screen, which reads
 * exactly like "the catalogue is empty" to a first-time buyer.
 *
 * Keys are encoded so the same map serves four lookup levels without
 * splitting into four maps:
 *   "yoga"                                  → all products in YOGA
 *   "yoga/jumpsuit"                         → all jumpsuits in YOGA
 *   "yoga/jumpsuit/cotton"                  → cotton jumpsuits in YOGA
 *   "yoga/jumpsuit/cotton/long"             → cotton long-sleeve jumpsuits
 *
 * Built with one groupBy and roll-ups in memory — single round-trip,
 * Cached for 5 minutes (CACHE_KEY "mega:counts"). The root loader runs on
 * EVERY navigation, so the groupBy must not — without this cache it was an
 * extra aggregate query on every page load site-wide. The product editor
 * already calls invalidateAll() after saving, which clears this key, so a
 * newly-tagged product shows in the menu within one save (or 5 min).
 */

export type MegaCounts = Record<string, number>;

export async function getMegaCounts(): Promise<MegaCounts> {
    return cachedFetch(CACHE_KEY, CACHE_TTL, computeMegaCounts);
}

async function computeMegaCounts(): Promise<MegaCounts> {
    try {
        const groups = await prisma.product.groupBy({
            by: ["shopPageSlug", "category", "fabric", "sleeve"],
            where: { status: "active" },
            _count: { _all: true },
        });

        const counts: MegaCounts = {};
        const bump = (key: string, n: number) => {
            counts[key] = (counts[key] || 0) + n;
        };

        for (const g of groups) {
            const shop = g.shopPageSlug ?? null;
            const sub = g.category ?? null;
            const fabric = g.fabric ?? null;
            const sleeve = g.sleeve ?? null;
            const n = g._count._all;
            if (!shop) continue;
            // Roll up to every level the menu can address — a leaf row
            // with cotton/long also counts toward yoga/jumpsuit/cotton,
            // yoga/jumpsuit and yoga.
            bump(shop, n);
            if (sub) {
                bump(`${shop}/${sub}`, n);
                if (fabric) {
                    bump(`${shop}/${sub}/${fabric}`, n);
                    if (sleeve) {
                        bump(`${shop}/${sub}/${fabric}/${sleeve}`, n);
                    }
                }
                // For categories without a fabric axis (e.g. dance/jumpsuit
                // uses sleeve only), index sleeve directly under the sub.
                if (!fabric && sleeve) {
                    bump(`${shop}/${sub}/_/${sleeve}`, n);
                }
            }
        }
        return counts;
    } catch (e) {
        console.error("[mega-counts] groupBy failed; menu will fall open", e);
        // Fail open — empty map means MegaMenu falls back to its old
        // "show everything" behaviour. Better a slightly noisy menu
        // than a silently broken navigation.
        return {};
    }
}
