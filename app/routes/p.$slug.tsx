import {
    useLoaderData,
    useSearchParams,
    type LoaderFunctionArgs,
    type MetaFunction,
} from "react-router";
import { useState, useEffect, useRef } from "react";
import { useToast } from "../components/Toast";
import ReviewsSection from "../components/ReviewsSection";
import { trackViewItem, trackAddToCart } from "../utils/analytics.client";
import { prisma } from "../db.server";
import { StorageUtils } from "../utils/storage";
import { AuthUtils } from "../utils/auth";
import { WishlistAuthModal } from "../components/WishlistAuthModal";
import { buildWebpSrcset, buildAvifSrcset } from "../utils/responsive-image";
import { shopPageTitle, isRealShopSlug } from "../utils/shop-pages";
import { DEFAULT_SITE_URL, resolveSiteUrl } from "../utils/site-url";
import { useI18n, useMoney, LLink, getT } from "../i18n";
import { localeFromParam, localeFromParamSafe, localizePath, OG_LOCALE } from "../i18n/config";
import { localizeEntities } from "../utils/translations.server";
import type { InventoryVariant, RelatedProductCard, FilterConfigData } from "../types/product";
import "../styles/product-page.css";

// NOTE: this route file exports a client component, so we can't import
// `.server` modules here (Vite will fail with "Server-only module
// referenced by client"). Use process.env directly in the loader; Phase 4
// will extract loader logic into a `.server.ts` companion so we can adopt
// the pino logger and Zod-validated env across all routes.

/** JSON-LD inLanguage values per locale. */
const JSONLD_LANG = { uk: "uk-UA", en: "en-US", ru: "ru-RU" } as const;

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
    const locale = localeFromParamSafe(params.lang);
    const t = getT(locale);
    const product = data?.product;
    if (!product) {
        return [{ title: `${t("Товар не знайдено")} | MIND BODY` }];
    }
    const siteUrl = data?.siteUrl || DEFAULT_SITE_URL;
    const reviewStats = data?.reviewStats;

    const desc = (
        product.description || t("{name} — купити в MIND BODY", { name: product.name })
    ).substring(0, 160);
    const image = product.images?.[0] || "/brand-sun.png";
    const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;
    const price = Number(product.price) || 0;
    // Reflect real stock in the rich-result offer (the UI already shows
    // "Немає в наявності" for all-zero-stock products); a hardcoded InStock
    // here is a Merchant mismatch that can suppress the result.
    const inStock = !product.inventory?.length || product.inventory.some((v) => (v.stock ?? 0) > 0);
    const canonicalPath = product.slug ? `/p/${product.slug}` : `/product/${product.id}`;
    const canonicalUrl = `${siteUrl}${localizePath(canonicalPath, locale)}`;
    return [
        { title: `${product.name} | MIND BODY` },
        { name: "description", content: desc },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        // Open Graph
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: product.name },
        { property: "og:description", content: desc },
        { property: "og:image", content: fullImage },
        // Declared dimensions of our product photos (3:4 portrait, 2625x3500
        // master) so social previews don't have to fetch+measure first.
        // Twitter "summary_large_image" cards will crop to 1.91:1 — content
        // still reads well because models are centered.
        { property: "og:image:width", content: "2625" },
        { property: "og:image:height", content: "3500" },
        { property: "og:type", content: "product" },
        { property: "og:locale", content: OG_LOCALE[locale] },
        { property: "product:price:amount", content: String(price) },
        { property: "product:price:currency", content: "UAH" },
        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: product.name },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: fullImage },
        // JSON-LD Product
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "Product",
                inLanguage: JSONLD_LANG[locale],
                name: product.name,
                description: desc,
                image: fullImage,
                brand: { "@type": "Brand", name: "MIND BODY" },
                offers: {
                    "@type": "Offer",
                    url: canonicalUrl,
                    priceCurrency: "UAH",
                    price: price,
                    availability: inStock
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                    seller: { "@type": "Organization", name: "MIND BODY" },
                    // Merchant listing fields (Search Console "Merchant listings"):
                    // delivery is always paid at the carrier's tariff (no free-shipping
                    // offer), so no OfferShippingDetails is declared — the on-page copy
                    // states the carrier-tariff wording. 14-day returns below.
                    // Mirrors /delivery + /return-policy + checkout + utils/shipping.ts.
                    hasMerchantReturnPolicy: {
                        "@type": "MerchantReturnPolicy",
                        applicableCountry: "UA",
                        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                        merchantReturnDays: 14,
                        returnMethod: "https://schema.org/ReturnByMail",
                        returnFees: "https://schema.org/ReturnShippingFees",
                    },
                },
                ...(reviewStats && reviewStats.count > 0
                    ? {
                          aggregateRating: {
                              "@type": "AggregateRating",
                              ratingValue: reviewStats.avg,
                              reviewCount: reviewStats.count,
                              bestRating: 5,
                              worstRating: 1,
                          },
                      }
                    : {}),
            },
        },
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                inLanguage: JSONLD_LANG[locale],
                itemListElement: [
                    {
                        "@type": "ListItem",
                        position: 1,
                        name: t("Головна"),
                        item: locale === "uk" ? siteUrl : `${siteUrl}/${locale}`,
                    },
                    ...(product.shopPageSlug
                        ? [
                              {
                                  "@type": "ListItem",
                                  position: 2,
                                  name: t(shopPageTitle(product.shopPageSlug)),
                                  item: `${siteUrl}${localizePath(`/shop/${product.shopPageSlug}`, locale)}`,
                              },
                          ]
                        : []),
                    {
                        "@type": "ListItem",
                        position: product.shopPageSlug ? 3 : 2,
                        name: product.name,
                        item: canonicalUrl,
                    },
                ],
            },
        },
        // Preload the first product image so it starts fetching before React
        // hydrates. AVIF, not WebP: the gallery's <picture> lists AVIF first,
        // so a WebP preload was a guaranteed cache miss (double download of
        // the LCP image — caught by the perf trace). `type` lets non-AVIF
        // browsers skip the hint and fetch via <picture> fallback as before.
        {
            tagName: "link",
            rel: "preload",
            as: "image",
            type: "image/avif",
            href: (product.images?.[0] || "/brand-sun.png").replace(
                /\.(jpe?g|png|webp)$/i,
                ".avif",
            ),
            imageSrcSet: product.images?.[0] ? buildAvifSrcset(product.images[0]) : undefined,
            imageSizes: "(max-width: 768px) 100vw, 50vw",
            fetchPriority: "high",
        },
    ];
};

export function headers() {
    return {
        // No long HTML cache — a stale document survives a deploy that deleted
        // its JS chunks and then can't hydrate. Always revalidate.
        "Cache-Control": "no-cache",
    };
}

const COLOR_MAP: Record<string, string> = {
    black: "#1a1a1a",
    white: "#ffffff",
    blue: "#3b82f6",
    pink: "#ec4899",
    green: "#22c55e",
    gray: "#6b7280",
    red: "#ef4444",
    purple: "#a855f7",
    yellow: "#eab308",
    orange: "#f97316",
    teal: "#14b8a6",
    brown: "#78350f",
    navy: "#1e3a8a",
    beige: "#f5f5dc",
    marsala: "#722F37",
};

// Narrow JSON parser that preserves the fallback's type.
function parseJson<T>(str: string | null | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

interface ProductDetailData {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    price: number;
    comparePrice: number;
    images: string[];
    category: string | null;
    shopPageSlug: string | null;
    colors: string[];
    /** Per-colour gallery override; colours absent here fall back to `images`. */
    colorImages: Record<string, string[]>;
    sizes: string[];
    inventory: InventoryVariant[];
    status: string;
    is_new: boolean;
    is_sale: boolean;
    discount_percent: number;
}

export async function loader({ params }: LoaderFunctionArgs) {
    const locale = localeFromParam(params.lang);
    const slug = params.slug;
    if (!slug) throw new Response("Not Found", { status: 404 });

    let product: ProductDetailData | null = null;
    let filterConfig: FilterConfigData | null = null;
    let relatedProducts: RelatedProductCard[] = [];

    try {
        // Run product + filterConfig + colorImages queries in parallel. The
        // colorImages read is raw SQL with graceful fallback (the moodType/
        // fabric pattern): the column ships in migration 20260612130000; a
        // pre-migration DB throws and `.catch` degrades to "no per-colour
        // galleries" (the PDP behaves exactly as before). Running it inside
        // Promise.all keeps it OFF the critical path of the hottest page —
        // it used to be a sequential third round-trip.
        const [p, globalConfig, colorImagesRows] = await Promise.all([
            prisma.product.findUnique({
                where: { slug },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    description: true,
                    price: true,
                    comparePrice: true,
                    category: true,
                    images: true,
                    colors: true,
                    sizes: true,
                    inventory: true,
                    status: true,
                    shopPageSlug: true,
                    createdAt: true,
                },
            }),
            prisma.filterConfig.findUnique({ where: { id: "global" } }),
            prisma.$queryRaw<Array<{ colorImages: string | null }>>`
                    SELECT "colorImages" FROM "Product" WHERE "slug" = ${slug} LIMIT 1
                `.catch(() => [] as Array<{ colorImages: string | null }>),
        ]);

        // Status gate: only "active" products are publicly viewable. A draft or
        // archived product (or a missing one) falls through to the 404 below —
        // matching /p/:slug, the catalog, search and the order API. The check is
        // here (not a `throw` inside the try) because the catch re-throws as 500.
        if (p && p.status === "active") {
            const images = parseJson<string[]>(p.images, []);
            if (images.length === 0) images.push("/brand-sun.png");

            // Keep only well-formed per-colour entries (string[] of non-empty URLs).
            const colorImages: Record<string, string[]> = {};
            const parsedColorImages = parseJson<Record<string, unknown>>(
                colorImagesRows[0]?.colorImages,
                {},
            );
            for (const [color, list] of Object.entries(parsedColorImages)) {
                if (
                    Array.isArray(list) &&
                    list.length > 0 &&
                    list.every((u) => typeof u === "string" && u.length > 0)
                ) {
                    colorImages[color] = list as string[];
                }
            }

            // Parse inventory to extract available variants
            const inventory = parseJson<InventoryVariant[]>(p.inventory, []);

            // Extract available colors and sizes from inventory (only in-stock items)
            const availableColors = new Set<string>();
            const availableSizes = new Set<string>();
            for (const item of inventory) {
                if ((item.stock ?? 0) > 0) {
                    if (item.color) availableColors.add(item.color);
                    if (item.size) availableSizes.add(item.size);
                }
            }

            const price = Number(p.price);
            const comparePrice = Number(p.comparePrice) || 0;
            const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
            const isNew = Date.now() - createdAt < 14 * 24 * 60 * 60 * 1000;

            product = {
                id: p.id,
                slug: p.slug,
                name: p.name,
                description: p.description,
                price,
                comparePrice,
                images,
                category: p.category,
                shopPageSlug: p.shopPageSlug,
                colors:
                    availableColors.size > 0
                        ? Array.from(availableColors)
                        : parseJson<string[]>(p.colors, []),
                colorImages,
                sizes:
                    availableSizes.size > 0
                        ? Array.from(availableSizes)
                        : parseJson<string[]>(p.sizes, []),
                inventory,
                status: p.status,
                is_new: isNew,
                is_sale: comparePrice > price && price > 0,
                discount_percent:
                    comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0,
            };

            if (p.category) {
                const relatedResult = await prisma.product.findMany({
                    where: { category: p.category, id: { not: p.id }, status: "active" },
                    select: { id: true, slug: true, name: true, price: true, images: true },
                    take: 4,
                });

                relatedProducts = relatedResult.map((rp) => ({
                    id: rp.id,
                    slug: rp.slug,
                    name: rp.name,
                    price: Number(rp.price),
                    image: parseJson<string[]>(rp.images, ["/brand-sun.png"])[0],
                }));
            }
        }

        if (globalConfig?.config) {
            try {
                filterConfig = JSON.parse(globalConfig.config) as FilterConfigData;
            } catch {
                // Malformed FilterConfig — render PDP without color overrides.
            }
        }
    } catch (e) {
        console.error("[product] loader failed:", { slug, error: e });
        throw new Response("Server Error", { status: 500 });
    }

    if (!product) {
        throw new Response("Not Found", { status: 404 });
    }

    // Aggregate of APPROVED reviews → drives the JSON-LD AggregateRating (review
    // stars in Google). Only the moderated reviews shown on the page are counted,
    // so the rich result reflects what the visitor actually sees (Google policy).
    const reviewAgg = await prisma.review.aggregate({
        where: { productId: product.id, isApproved: true },
        _avg: { rating: true },
        _count: { _all: true },
    });
    const reviewStats = {
        count: reviewAgg._count._all,
        avg: reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0,
    };

    // en/ru: swap name/description for their translations (uk = no-op).
    const [localizedProduct] = await localizeEntities("Product", [product], locale, [
        "name",
        "description",
    ]);
    const localizedRelated = await localizeEntities("Product", relatedProducts, locale, ["name"]);

    return {
        product: localizedProduct,
        filterConfig,
        relatedProducts: localizedRelated,
        reviewStats,
        siteUrl: resolveSiteUrl(),
    };
}

export default function ProductDetail() {
    const { product, filterConfig, relatedProducts } = useLoaderData<typeof loader>();
    const { t } = useI18n();
    const money = useMoney();

    // State
    const { showToast } = useToast();
    const [selectedSize, setSelectedSize] = useState<string>("");
    // Honour ?color= from a catalog swatch click so the PDP opens already
    // switched to that colour's gallery; fall back to the first colour.
    const [searchParams] = useSearchParams();
    const [selectedColor, setSelectedColor] = useState<string>(() => {
        const c = searchParams.get("color");
        return c && product.colors.includes(c) ? c : product.colors[0] || "";
    });
    const [openAccordion, setOpenAccordion] = useState<string | null>("desc");
    const [activeImage, setActiveImage] = useState(0);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [quickBuyOpen, setQuickBuyOpen] = useState(false);
    const [wishAuthOpen, setWishAuthOpen] = useState(false);
    const [quickBuyPhone, setQuickBuyPhone] = useState("");
    const [quickBuyName, setQuickBuyName] = useState("");
    const [quickBuySending, setQuickBuySending] = useState(false);
    /* Sprint 1 D2.2 — #3 CRO-002 sticky CTA visible-confirm state.
       Cart is localStorage (sync) so no fetcher.state to bind to; we
       fake a brief "✓ Додано" lock instead. Double-purpose: visual
       feedback + 1.2s guard against accidental double-add. */
    const [justAdded, setJustAdded] = useState(false);

    // Per-colour gallery: when the picked colour has its own photo set,
    // the whole gallery (mobile swiper, desktop thumbs+main, zoom) switches
    // to it — "each colour is its own product" as far as the buyer can see.
    // Colours without an entry use the shared images array, so partially
    // tagged products degrade to the old behaviour rather than going blank.
    const galleryImages =
        (selectedColor && product.colorImages?.[selectedColor]?.length
            ? product.colorImages[selectedColor]
            : product.images) || product.images;

    // Switching colour swaps the photo set — reset the cursor so the buyer
    // lands on the new colour's cover instead of an out-of-range index.
    useEffect(() => {
        setActiveImage(0);
    }, [selectedColor]);

    // F-029 — when the CTA is clicked without a size picked, we keep
    // the button active (so it's not visually dead), scroll the size
    // selector into view, and pulse it for ~900 ms so the eye lands
    // on the next required action instead of the buyer wondering why
    // "Додати в кошик" didn't do anything.
    const sizesGroupRef = useRef<HTMLDivElement | null>(null);
    const [sizeFlash, setSizeFlash] = useState(false);

    // F-002 — funnel-step #1. Fire view_item exactly once per product
    // visit; the [product.id] dep covers PDP→PDP client navigations
    // (different slug, same route file) without firing on size/colour
    // re-renders. Body checks consent inside ensureAnalyticsLoaded, so
    // no extra guard needed here.
    useEffect(() => {
        trackViewItem({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
        });
    }, [product.id, product.name, product.price, product.category]);

    // Scroll lock for modals
    useEffect(() => {
        if (quickBuyOpen || zoomOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [quickBuyOpen, zoomOpen]);

    // Helper: Get stock for a specific size/color combination
    const getVariantStock = (size: string, color: string): number => {
        if (!product.inventory || !Array.isArray(product.inventory)) return 0;
        const variant = product.inventory.find(
            (v: InventoryVariant) => v.size === size && v.color === color,
        );
        return variant?.stock || 0;
    };

    // Helper: Check if a color is available for the selected size
    const isColorAvailable = (color: string): boolean => {
        if (!selectedSize)
            return (
                product.inventory?.some(
                    (v: InventoryVariant) => v.color === color && (v.stock ?? 0) > 0,
                ) ?? true
            );
        return getVariantStock(selectedSize, color) > 0;
    };

    // Helper: Check if a size is available for the selected color
    const isSizeAvailable = (size: string): boolean => {
        if (!selectedColor)
            return (
                product.inventory?.some(
                    (v: InventoryVariant) => v.size === size && (v.stock ?? 0) > 0,
                ) ?? true
            );
        return getVariantStock(size, selectedColor) > 0;
    };

    // Current selection stock
    const currentStock = getVariantStock(selectedSize, selectedColor);
    const hasAnyStock =
        !product.inventory?.length ||
        product.inventory.some((v: InventoryVariant) => (v.stock ?? 0) > 0);
    const hasColorStock =
        !selectedColor ||
        !product.inventory?.length ||
        product.inventory.some(
            (v: InventoryVariant) => v.color === selectedColor && (v.stock ?? 0) > 0,
        );
    const isInStock = selectedSize
        ? currentStock > 0 || product.inventory?.length === 0
        : hasColorStock && hasAnyStock;

    const toggleAccordion = (id: string) => {
        setOpenAccordion(openAccordion === id ? null : id);
    };

    const addToCart = () => {
        if (product.sizes.length > 0 && !selectedSize) {
            // F-029 — instead of just toasting and leaving the buyer to
            // hunt for the size selector, take them there. Smooth-scroll
            // with extra room above (so the section header is in view,
            // not flush against the sticky header), flash for ~900 ms.
            const node = sizesGroupRef.current;
            if (node) {
                node.scrollIntoView({ behavior: "smooth", block: "center" });
                setSizeFlash(true);
                setTimeout(() => setSizeFlash(false), 900);
            }
            showToast(t("Спершу оберіть розмір"), "warning");
            return;
        }

        // Check stock availability
        if (product.inventory?.length > 0 && !isInStock) {
            showToast(t("Вибачте, цієї комбінації немає в наявності"), "error");
            return;
        }

        StorageUtils.addToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            // Cart shows the COLOUR the buyer picked — its gallery cover,
            // not the generic product cover (per-colour variants feature).
            image: galleryImages[0] || product.images[0],
            size: selectedSize,
            color: selectedColor,
            quantity: 1,
        });
        // F-002 — funnel-step #2. Per Meta/GA4 e-commerce schema:
        // category lives in `item_category`, variant carries the picked
        // size/colour combo so the report differentiates SKU variants.
        trackAddToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            variant: [selectedSize, selectedColor].filter(Boolean).join("/") || undefined,
            quantity: 1,
        });

        /* Sprint 1 D2.2 — #3 CRO-002 — flip CTA to "✓ Додано" for 1.2s.
           Guards against double-tap dupes (mobile users tap fast)
           and gives instant visual confirmation even if the toast is
           missed. */
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1200);

        showToast(
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600 }}>{t("Додано у кошик! ✨")}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                    {product.name} {selectedSize ? `(${selectedSize})` : ""}
                </span>
            </div>,
            "success",
            product.images[0],
        );
    };

    const addToWishlist = () => {
        if (!AuthUtils.getAuthState().isAuthenticated) {
            setWishAuthOpen(true);
            return;
        }
        const added = StorageUtils.addToWishlist({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0],
            category: product.category ?? "",
        });
        if (added) showToast(t("Додано до улюбленого ❤️"));
        else showToast(t("Вже у списку"), "info");
    };

    const getColorLabel = (code: string) => filterConfig?.colors?.[code] || code;
    const getColorHex = (code: string) =>
        (code && typeof code === "string" ? COLOR_MAP[code.toLowerCase()] : code) || code;

    return (
        <>
            {wishAuthOpen && <WishlistAuthModal onClose={() => setWishAuthOpen(false)} />}
            <main className="product-page-mindbody">
                {/* --- COMPACT LUXE HERO (Atmospheric) --- */}
                <div className="shop-hero-luxe compact">
                    <div className="luxe-grain" />
                    <div className="shop-hero-luxe__drift" />
                    <div className="container hero-container">
                        <nav className="luxe-breadcrumb">
                            <LLink to="/">{t("Головна")}</LLink>
                            <span className="sep">/</span>
                            <LLink
                                to={`/shop/${isRealShopSlug(product.shopPageSlug) ? product.shopPageSlug : "yoga"}`}
                            >
                                {isRealShopSlug(product.shopPageSlug)
                                    ? t(shopPageTitle(product.shopPageSlug))
                                    : t("Магазин")}
                            </LLink>
                            <span className="sep">/</span>
                            <span className="current">{product.name}</span>
                        </nav>
                    </div>
                </div>

                <div className="container main-content-container">
                    <div className="product-layout">
                        {/* Atom M (P0): mobile-only swipe carousel — desktop
                        thumbs+main below stays hidden on mobile via CSS.
                        Background audit found mobile users only ever saw
                        image 1 (no thumbs, no swipe on `.main-img-wrap`).
                        Premium activewear sells on multi-angle fabric +
                        fit — this fixes that. Dot indicator below tracks
                        active slide via scroll-snap + IntersectionObserver
                        is overkill; we'll just show "{i+1} / N" via state
                        on scroll. */}
                        {galleryImages.length > 0 && (
                            <div className="pdp-mobile-gallery-wrap">
                                <div
                                    className="pdp-mobile-gallery"
                                    onScroll={(e) => {
                                        const el = e.currentTarget;
                                        const idx = Math.round(el.scrollLeft / el.clientWidth);
                                        if (idx !== activeImage) setActiveImage(idx);
                                    }}
                                >
                                    {galleryImages.map((img: string, idx: number) => (
                                        <div key={idx} className="pdp-mobile-gallery__slide">
                                            <picture>
                                                <source
                                                    srcSet={buildWebpSrcset(img)}
                                                    sizes="100vw"
                                                    type="image/webp"
                                                />
                                                <img
                                                    src={img}
                                                    alt={t("{name} — фото {n}", {
                                                        name: product.name,
                                                        n: idx + 1,
                                                    })}
                                                    loading={idx === 0 ? "eager" : "lazy"}
                                                    decoding="async"
                                                    fetchPriority={idx === 0 ? "high" : "auto"}
                                                    onClick={() => setZoomOpen(true)}
                                                />
                                            </picture>
                                        </div>
                                    ))}
                                </div>
                                {galleryImages.length > 1 && (
                                    <div className="pdp-mobile-gallery__counter" aria-live="polite">
                                        {activeImage + 1} / {galleryImages.length}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Visuals: Puma Style (Vertical Thumbs Left + Main Right) */}
                        <div className="visuals-gallery-puma">
                            {/* Left Column: Vertical Thumbnails */}
                            {galleryImages.length > 1 && (
                                <div className="thumbs-col-vertical">
                                    {galleryImages.map((img: string, idx: number) => (
                                        <button
                                            key={idx}
                                            className={`thumb-vertical ${activeImage === idx ? "active" : ""}`}
                                            onClick={() => setActiveImage(idx)}
                                            aria-label={t("Фото {n}", { n: idx + 1 })}
                                        >
                                            <div className="thumb-inner">
                                                {/* Square thumb container with CSS object-fit cover;
                                                width/height attrs reserve space before image loads. */}
                                                <img
                                                    src={img}
                                                    alt=""
                                                    width="80"
                                                    height="80"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Right Area: Main Visual */}
                            <div className="main-visual-puma">
                                <div
                                    className="main-img-wrap"
                                    onClick={() => setZoomOpen(true)}
                                    style={{ cursor: "zoom-in" }}
                                >
                                    <img
                                        src={galleryImages[activeImage] || galleryImages[0]}
                                        alt={product.name}
                                        className="main-img"
                                    />
                                </div>
                                {/* Badge integrated into image */}
                                {product.is_sale && product.discount_percent ? (
                                    <span
                                        className="visual-badge"
                                        style={{
                                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                                            color: "#fff",
                                        }}
                                    >
                                        -{product.discount_percent}%
                                    </span>
                                ) : product.is_new ? (
                                    <span className="visual-badge">New</span>
                                ) : null}
                            </div>

                            {/* Zoom Lightbox */}
                            {zoomOpen && (
                                <div className="zoom-overlay" onClick={() => setZoomOpen(false)}>
                                    <button
                                        className="zoom-overlay__close"
                                        onClick={() => setZoomOpen(false)}
                                        aria-label={t("Закрити")}
                                    >
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                    <img
                                        src={galleryImages[activeImage] || galleryImages[0]}
                                        alt={product.name}
                                        className="zoom-overlay__img"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    {galleryImages.length > 1 && (
                                        <div className="zoom-overlay__nav">
                                            <button
                                                aria-label={t("Попереднє фото")}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveImage(
                                                        (i) =>
                                                            (i - 1 + galleryImages.length) %
                                                            galleryImages.length,
                                                    );
                                                }}
                                            >
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path d="M15 18l-6-6 6-6" />
                                                </svg>
                                            </button>
                                            <span>
                                                {activeImage + 1} / {galleryImages.length}
                                            </span>
                                            <button
                                                aria-label={t("Наступне фото")}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveImage(
                                                        (i) => (i + 1) % galleryImages.length,
                                                    );
                                                }}
                                            >
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path d="M9 18l6-6-6-6" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Info Panel: Sticky & Compact */}
                        <aside className="info-section">
                            <div className="info-sticky-wrapper">
                                <div className="product-header">
                                    <h1 className="product-title">{product.name}</h1>
                                    <div className="product-price-block">
                                        <span
                                            className="current-price"
                                            style={
                                                product.is_sale ? { color: "#b91c1c" } : undefined
                                            }
                                        >
                                            {money(product.price)}
                                        </span>
                                        {product.is_sale && product.comparePrice > 0 && (
                                            <span className="old-price">
                                                {money(product.comparePrice)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="div-line" />

                                <div className="selectors-form">
                                    {product.colors.length > 0 && (
                                        <div className="selector-group">
                                            <div className="group-head">
                                                <span className="selector-label">
                                                    {t("Колір")}:{" "}
                                                    <span className="val" aria-live="polite">
                                                        {t(getColorLabel(selectedColor))}
                                                    </span>
                                                </span>
                                            </div>
                                            <div
                                                className="color-options"
                                                role="radiogroup"
                                                aria-label={t("Колір")}
                                            >
                                                {product.colors.map((color: string) => {
                                                    const available = isColorAvailable(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={selectedColor === color}
                                                            className={`color-swatch ${selectedColor === color ? "selected" : ""} ${!available ? "unavailable" : ""}`}
                                                            onClick={() =>
                                                                available && setSelectedColor(color)
                                                            }
                                                            disabled={!available}
                                                            style={{
                                                                backgroundColor: getColorHex(color),
                                                            }}
                                                            aria-label={`${t(getColorLabel(color))}${!available ? ` — ${t("немає в наявності")}` : ""}`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {product.sizes.length > 0 && (
                                        <div
                                            className={`selector-group${sizeFlash ? " is-pulse" : ""}`}
                                            ref={sizesGroupRef}
                                            style={{
                                                transition:
                                                    "box-shadow 0.3s ease, background 0.3s ease",
                                                boxShadow: sizeFlash
                                                    ? "0 0 0 3px var(--color-primary)"
                                                    : undefined,
                                                borderRadius: sizeFlash ? "12px" : undefined,
                                            }}
                                        >
                                            <div className="group-head">
                                                <span className="selector-label">
                                                    {t("Розмір")}
                                                </span>
                                                <LLink to="/size-guide" className="size-guide">
                                                    {t("Таблиця розмірів")}
                                                </LLink>
                                            </div>
                                            {/* Sprint 1 D2.3 — #19/#14 PDP a11y: aria-label spells out
                                            sold-out so SR users hear "Розмір M, немає в наявності"
                                            instead of just the dimmed pill being skipped. */}
                                            <div
                                                className="size-options"
                                                role="radiogroup"
                                                aria-label={t("Розмір")}
                                            >
                                                {product.sizes.map((size: string) => {
                                                    const available = isSizeAvailable(size);
                                                    return (
                                                        <button
                                                            key={size}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={selectedSize === size}
                                                            aria-label={
                                                                available
                                                                    ? t("Розмір {size}", { size })
                                                                    : t(
                                                                          "Розмір {size}, немає в наявності",
                                                                          { size },
                                                                      )
                                                            }
                                                            className={`size-chip ${selectedSize === size ? "selected" : ""} ${!available ? "unavailable" : ""}`}
                                                            onClick={() => {
                                                                setSelectedSize(size);
                                                                // If the current colour isn't in stock
                                                                // for this size, switch to one that is —
                                                                // otherwise a buyable item wrongly reads
                                                                // "Немає в наявності".
                                                                const inStockColors =
                                                                    product.colors.filter(
                                                                        (c) =>
                                                                            getVariantStock(
                                                                                size,
                                                                                c,
                                                                            ) > 0,
                                                                    );
                                                                if (
                                                                    selectedColor &&
                                                                    inStockColors.length > 0 &&
                                                                    !inStockColors.includes(
                                                                        selectedColor,
                                                                    )
                                                                ) {
                                                                    setSelectedColor(
                                                                        inStockColors[0],
                                                                    );
                                                                }
                                                            }}
                                                            disabled={!available}
                                                        >
                                                            {size}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Stock indicator — enhanced urgency.
                                Sprint 1 D2.4 — #37 PDP-006 threshold raised
                                from ≤3 to ≤5 for earlier scarcity messaging.
                                Last-piece state distinguishes singular item
                                so the urgency tier reads correctly. */}
                                {selectedSize && selectedColor && product.inventory?.length > 0 && (
                                    <div
                                        className={`stock-indicator ${isInStock ? (currentStock <= 5 ? "stock-indicator--low" : "stock-indicator--ok") : "stock-indicator--out"}`}
                                        aria-live="polite"
                                    >
                                        {isInStock ? (
                                            currentStock <= 5 ? (
                                                <>
                                                    <svg
                                                        aria-hidden="true"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        style={{
                                                            marginRight: "4px",
                                                            color: "#ef4444",
                                                            verticalAlign: "-3px",
                                                        }}
                                                    >
                                                        <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"></path>
                                                    </svg>{" "}
                                                    {currentStock === 1
                                                        ? t("🔥 Останній — поспішіть!")
                                                        : currentStock <= 2
                                                          ? t(
                                                                "🔥 Залишилось лише {n} шт — поспішіть!",
                                                                { n: currentStock },
                                                            )
                                                          : t("Залишилось {n} шт", {
                                                                n: currentStock,
                                                            })}
                                                </>
                                            ) : (
                                                t("✓ В наявності: {n} шт", { n: currentStock })
                                            )
                                        ) : (
                                            t("✕ Немає в наявності")
                                        )}
                                    </div>
                                )}

                                {/* Trust badges — shipping & returns */}
                                <div className="trust-badges-inline">
                                    <span>
                                        <svg
                                            aria-hidden="true"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ marginRight: "6px", verticalAlign: "-3px" }}
                                        >
                                            <rect x="1" y="3" width="15" height="13"></rect>
                                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                            <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                            <circle cx="18.5" cy="18.5" r="2.5"></circle>
                                        </svg>{" "}
                                        {t("Швидка доставка по Україні")}
                                    </span>
                                    <span>
                                        <svg
                                            aria-hidden="true"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ marginRight: "6px", verticalAlign: "-3px" }}
                                        >
                                            <polyline points="17 1 21 5 17 9"></polyline>
                                            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                            <polyline points="7 23 3 19 7 15"></polyline>
                                            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                                        </svg>{" "}
                                        {t("14 днів на повернення")}
                                    </span>
                                    <span>
                                        <svg
                                            aria-hidden="true"
                                            width="16"
                                            height="12"
                                            viewBox="0 0 20 14"
                                            fill="none"
                                            style={{
                                                marginRight: "6px",
                                                display: "inline-block",
                                                verticalAlign: "-1px",
                                            }}
                                        >
                                            <rect width="20" height="7" fill="#0057B7" />
                                            <rect y="7" width="20" height="7" fill="#FFD700" />
                                        </svg>{" "}
                                        {t("Українське виробництво")}
                                    </span>
                                </div>

                                <div className="actions-row">
                                    {/* F-029 — keep the primary CTA visually
                                    alive even when a size hasn't been picked.
                                    The click handler intercepts that state and
                                    pulses the size selector instead of looking
                                    broken. Disabled only persists for out-of-
                                    stock + just-added (handler-driven). */}
                                    <button
                                        className="btn-primary-add"
                                        onClick={addToCart}
                                        disabled={
                                            justAdded ||
                                            (!isInStock && product.inventory?.length > 0)
                                        }
                                        aria-live="polite"
                                        style={{
                                            opacity:
                                                !isInStock && product.inventory?.length > 0
                                                    ? 0.5
                                                    : 1,
                                        }}
                                    >
                                        <span>
                                            {justAdded
                                                ? t("✓ Додано")
                                                : !isInStock && product.inventory?.length > 0
                                                  ? t("Немає в наявності")
                                                  : t("Додати в кошик")}
                                        </span>
                                    </button>
                                    <button
                                        className="btn-quick-buy"
                                        onClick={() => setQuickBuyOpen(true)}
                                    >
                                        <svg
                                            aria-hidden="true"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ marginRight: "6px", verticalAlign: "-3px" }}
                                        >
                                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                        </svg>{" "}
                                        {t("Купити в 1 клік")}
                                    </button>
                                    <button
                                        className="btn-wishlist hover-scale"
                                        onClick={addToWishlist}
                                        aria-label={t("Додати в обране")}
                                        title={t("Додати в обране")}
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Quick Buy Modal */}
                                {quickBuyOpen && (
                                    <div
                                        className="quick-buy-overlay"
                                        onClick={() => setQuickBuyOpen(false)}
                                    >
                                        <div
                                            className="quick-buy-modal"
                                            onClick={(e) => e.stopPropagation()}
                                            role="dialog"
                                            aria-modal="true"
                                            aria-labelledby="quick-buy-title"
                                        >
                                            <h3
                                                id="quick-buy-title"
                                                className="quick-buy-modal__title"
                                            >
                                                <svg
                                                    aria-hidden="true"
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{
                                                        marginRight: "6px",
                                                        verticalAlign: "-3px",
                                                    }}
                                                >
                                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                                </svg>{" "}
                                                {t("Швидке замовлення")}
                                            </h3>
                                            <p className="quick-buy-modal__product">
                                                {product.name} &mdash; {money(product.price)}
                                                {selectedSize ? ` · ${selectedSize}` : ""}
                                                {selectedColor ? ` · ${selectedColor}` : ""}
                                            </p>
                                            <input
                                                type="text"
                                                aria-label={t("Ваше ім'я")}
                                                placeholder={t("Ваше ім'я")}
                                                value={quickBuyName}
                                                onChange={(e) => setQuickBuyName(e.target.value)}
                                                className="quick-buy-modal__input"
                                                autoFocus
                                            />
                                            <input
                                                type="tel"
                                                aria-label={t("Ваш телефон")}
                                                placeholder="+380 __ ___ __ __"
                                                value={quickBuyPhone}
                                                onChange={(e) => setQuickBuyPhone(e.target.value)}
                                                className="quick-buy-modal__input"
                                            />
                                            <p className="quick-buy-modal__hint">
                                                {t("Ми зателефонуємо протягом 15 хвилин")}
                                            </p>
                                            <button
                                                disabled={
                                                    quickBuySending || quickBuyPhone.length < 10
                                                }
                                                onClick={async () => {
                                                    setQuickBuySending(true);
                                                    try {
                                                        const res = await fetch(
                                                            "/api/quick-order",
                                                            {
                                                                method: "POST",
                                                                headers: {
                                                                    "Content-Type":
                                                                        "application/json",
                                                                },
                                                                body: JSON.stringify({
                                                                    name: quickBuyName,
                                                                    phone: quickBuyPhone,
                                                                    productName: product.name,
                                                                    price: product.price,
                                                                    size: selectedSize,
                                                                    color: selectedColor,
                                                                }),
                                                            },
                                                        );
                                                        // The server persists the lead + sends Telegram;
                                                        // a non-OK response means it wasn't accepted.
                                                        if (!res.ok) throw new Error("send failed");
                                                        setQuickBuyOpen(false);
                                                        setQuickBuyPhone("");
                                                        setQuickBuyName("");
                                                        showToast(
                                                            t(
                                                                "Замовлення прийнято! Ми зателефонуємо протягом 15 хвилин",
                                                            ),
                                                        );
                                                    } catch {
                                                        showToast(
                                                            t("Помилка. Спробуйте ще раз."),
                                                            "error",
                                                        );
                                                    } finally {
                                                        setQuickBuySending(false);
                                                    }
                                                }}
                                                className="quick-buy-modal__submit"
                                                style={{
                                                    opacity:
                                                        quickBuySending || quickBuyPhone.length < 10
                                                            ? 0.5
                                                            : 1,
                                                }}
                                            >
                                                {quickBuySending
                                                    ? t("Відправка...")
                                                    : t("Замовити")}
                                            </button>
                                            <button
                                                onClick={() => setQuickBuyOpen(false)}
                                                className="quick-buy-modal__cancel"
                                            >
                                                {t("Скасувати")}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="details-accordion">
                                    {/* ... Accordions kept simple ... */}
                                    <div
                                        className={`acc-item ${openAccordion === "desc" ? "active" : ""}`}
                                    >
                                        <button
                                            type="button"
                                            className="acc-head"
                                            onClick={() => toggleAccordion("desc")}
                                            aria-expanded={openAccordion === "desc"}
                                            aria-controls="acc-body-desc"
                                        >
                                            <span>{t("Опис")}</span>
                                            <span
                                                aria-hidden="true"
                                                className={`acc-icon ${openAccordion === "desc" ? "minus" : "plus"}`}
                                            />
                                        </button>
                                        <div id="acc-body-desc" className="acc-body" role="region">
                                            <div className="acc-inner">
                                                {product.description || "No description."}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        className={`acc-item ${openAccordion === "delivery" ? "active" : ""}`}
                                    >
                                        <button
                                            type="button"
                                            className="acc-head"
                                            onClick={() => toggleAccordion("delivery")}
                                            aria-expanded={openAccordion === "delivery"}
                                            aria-controls="acc-body-delivery"
                                        >
                                            <span>{t("Доставка")}</span>
                                            <span
                                                aria-hidden="true"
                                                className={`acc-icon ${openAccordion === "delivery" ? "minus" : "plus"}`}
                                            />
                                        </button>
                                        <div
                                            id="acc-body-delivery"
                                            className="acc-body"
                                            role="region"
                                        >
                                            <div className="acc-inner">
                                                <p>• {t("Доставка Новою Поштою 1-3 дні")}</p>
                                                <p>
                                                    •{" "}
                                                    {t(
                                                        "Вартість доставки — за тарифами Нової Пошти",
                                                    )}
                                                </p>
                                                <p>
                                                    •{" "}
                                                    {t(
                                                        "Оплата при отриманні: готівка або карткою на терміналі Нової Пошти",
                                                    )}
                                                </p>
                                                <p>• {t("14 днів на повернення")}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>

                    {relatedProducts.length > 0 && (
                        <div className="related-section">
                            <h3 className="related-title">{t("Вам також може сподобатись")}</h3>
                            <div className="related-grid">
                                {relatedProducts.map((rp) => (
                                    <LLink
                                        to={rp.slug ? `/p/${rp.slug}` : `/product/${rp.id}`}
                                        key={rp.id}
                                        className="related-card"
                                    >
                                        <div className="related-img-box">
                                            {/* 3:4 portrait matches our actual product photos
                                            (2625x3500). Below the fold => lazy. Previously a
                                            raw <img src> with no srcset — related cards
                                            fetched the full master (sometimes a raw .JPG)
                                            for a 300px slot. Same <picture> pattern as
                                            ProductCard: AVIF → WebP → original fallback. */}
                                            <picture>
                                                <source
                                                    srcSet={buildAvifSrcset(rp.image)}
                                                    sizes="(max-width: 768px) 50vw, 300px"
                                                    type="image/avif"
                                                />
                                                <source
                                                    srcSet={buildWebpSrcset(rp.image)}
                                                    sizes="(max-width: 768px) 50vw, 300px"
                                                    type="image/webp"
                                                />
                                                <img
                                                    src={rp.image}
                                                    alt={rp.name}
                                                    width="300"
                                                    height="400"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            </picture>
                                        </div>
                                        <div className="related-info">
                                            <h4>{rp.name}</h4>
                                            <span>{money(rp.price)}</span>
                                        </div>
                                    </LLink>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ===== REVIEWS SECTION ===== */}
                    <ReviewsSection productId={product.id} />
                </div>

                {/* CSS moved to app/styles/product-page.css */}

                {/* Mobile Sticky CTA — F-029: matches the desktop button. The
                only disabled state is genuinely-blocked (OOS / just-added);
                an unset size routes through the handler so the size selector
                pulses + the toast nudges. */}
                <div className="mobile-sticky-cta">
                    <div className="mobile-sticky-cta__price">{money(product.price)}</div>
                    <button
                        type="button"
                        className="mobile-sticky-cta__btn"
                        onClick={addToCart}
                        disabled={justAdded || (!isInStock && product.inventory?.length > 0)}
                        aria-live="polite"
                    >
                        {justAdded
                            ? t("✓ Додано")
                            : !isInStock && product.inventory?.length > 0
                              ? t("Немає в наявності")
                              : t("Додати в кошик")}
                    </button>
                </div>
            </main>
        </>
    );
}
