import { prisma } from "../db.server";
import { parseAndMergeFilterConfig, type MergedFilterConfig } from "./filters";
import { cachedFetch } from "./cache.server";
import { resolveSiteUrl } from "./site-url";
import type { Locale } from "../i18n/config";
import { localizeEntities } from "./translations.server";

/** Shop listings only change via admin saves, and every such action calls
    invalidateAll() — so this TTL is just a backstop against unbounded staleness. */
const SHOP_CACHE_TTL = 60_000;

/**
 * Shape returned by loadShopData — used by both /shop/:category and
 * /shop/:category/:subcategory loaders. ShopProductCard mirrors what
 * shop.$category.tsx and ProductCard expect.
 */
export interface ShopProductCard {
    id: string;
    slug?: string | null;
    name: string;
    description: string | null;
    price: number;
    comparePrice: number;
    sale_price: number | undefined;
    image: string;
    image2: string | undefined;
    images: string[];
    category: string | undefined;
    fabric: string | undefined;
    sleeve: string | undefined;
    colors: string[];
    sizes: string[];
    is_new: boolean;
    is_sale: boolean;
    discount_percent: number;
    status: string;
}

export interface ShopData {
    products: ShopProductCard[];
    category: string;
    shopPage: Awaited<ReturnType<typeof prisma.shopPage.findUnique>>;
    filterConfig: MergedFilterConfig;
    siteUrl: string;
}

export interface LoadShopOptions {
    /**
     * Optional subcategory slug. When provided, the SQL `WHERE` clause
     * narrows to that subcategory directly — avoids the prior pattern
     * where the child route fetched the full category set and filtered
     * in JS (wasted DB IO once the catalogue grows).
     */
    subcategoryFilter?: string;
}

function parseJson<T>(str: string | null | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

/**
 * Single source of truth for the shop-listing data fetch. Both the parent
 * `/shop/:category` and the nested `/shop/:category/:subcategory` routes
 * call this so they share one query plan, one mapping, and one product
 * shape — no more dual SQL trips just to filter in memory afterwards.
 *
 * Returns null shopPage when the slug isn't a real ShopPage row; callers
 * decide whether to 404 or fall back.
 */
export async function loadShopData(
    categorySlug: string,
    opts: LoadShopOptions = {},
    locale: Locale = "uk",
): Promise<ShopData> {
    // Cache the 3-query fan-out per shop/subcategory. Every admin mutation
    // (product / shop-page / slide save) calls invalidateAll(), so edits
    // surface immediately; the 60s TTL is only a backstop. Serves both
    // /shop/:category and /shop/:category/:subcategory.
    const cacheKey = `shop:${categorySlug}:${opts.subcategoryFilter ?? "all"}`;
    const data = await cachedFetch(cacheKey, SHOP_CACHE_TTL, () =>
        loadShopDataUncached(categorySlug, opts),
    );
    if (locale === "uk") return data;
    // Localize OUTSIDE the cache (key is locale-agnostic; cached arrays are
    // never mutated — localizeEntities maps to fresh objects).
    const [products, shopPage] = await Promise.all([
        localizeEntities("Product", data.products, locale, ["name", "description"]),
        data.shopPage
            ? localizeEntities("ShopPage", [data.shopPage], locale, [
                  "title",
                  "subtitle",
                  "prefixLabel",
              ]).then((r) => r[0])
            : Promise.resolve(data.shopPage),
    ]);
    return { ...data, products, shopPage };
}

async function loadShopDataUncached(
    categorySlug: string,
    opts: LoadShopOptions = {},
): Promise<ShopData> {
    const [configs, shopPageResult, rawProducts] = await Promise.all([
        prisma.filterConfig
            .findMany({
                where: { OR: [{ id: categorySlug }, { id: "global" }] },
                select: { id: true, config: true },
            })
            .catch((e) => {
                console.error("FilterConfig fetch failed", e);
                return [] as Array<{ id: string; config: string }>;
            }),
        prisma.shopPage.findUnique({ where: { slug: categorySlug } }).catch((e) => {
            console.error("ShopPage fetch failed", e);
            return null;
        }),
        prisma.product
            .findMany({
                where: {
                    shopPageSlug: categorySlug,
                    status: "active",
                    ...(opts.subcategoryFilter ? { category: opts.subcategoryFilter } : {}),
                },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    description: true,
                    price: true,
                    comparePrice: true,
                    category: true,
                    fabric: true,
                    sleeve: true,
                    images: true,
                    colors: true,
                    sizes: true,
                    shopPageSlug: true,
                    status: true,
                    createdAt: true,
                },
            })
            .catch((e: unknown) => {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn("Product fetch failed:", msg);
                return [];
            }),
    ]);

    const specificConfig = configs.find((c) => c.id === categorySlug);
    const globalConfig = configs.find((c) => c.id === "global");
    const configToParse = specificConfig?.config || globalConfig?.config;
    const filterConfig = parseAndMergeFilterConfig(configToParse);

    const NOW = Date.now();
    const NEW_THRESHOLD_DAYS = 14;

    const products: ShopProductCard[] = rawProducts.map((p) => {
        const images = parseJson<string[]>(p.images, []);
        const price = Number(p.price);
        const comparePrice = Number(p.comparePrice) || 0;
        const isSale = comparePrice > price && price > 0;
        const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        const isNew = NOW - createdAt < NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

        return {
            id: p.id,
            slug: p.slug ?? undefined,
            name: p.name,
            description: p.description,
            price: isSale ? comparePrice : price,
            comparePrice,
            sale_price: isSale ? price : undefined,
            image: images[0] || "/brand-sun.png",
            image2: images[1] || undefined,
            images,
            category: p.category ?? undefined,
            fabric: p.fabric ?? undefined,
            sleeve: p.sleeve ?? undefined,
            colors: parseJson<string[]>(p.colors, []),
            sizes: parseJson<string[]>(p.sizes, []),
            is_new: isNew,
            is_sale: isSale,
            discount_percent: isSale ? Math.round((1 - price / comparePrice) * 100) : 0,
            status: p.status,
        };
    });

    return {
        products,
        category: categorySlug,
        shopPage: shopPageResult,
        filterConfig,
        siteUrl: resolveSiteUrl(),
    };
}
