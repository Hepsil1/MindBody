import { Link, useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../components/Toast";
import { prisma } from "../db.server";
import { StorageUtils } from "../utils/storage";
import { buildWebpSrcset } from "../utils/responsive-image";
import { shopPageTitle, isRealShopSlug } from "../utils/shop-pages";
import { formatPrice } from "../utils/format";
import type {
    InventoryVariant,
    ReviewData,
    RelatedProductCard,
    FilterConfigData,
} from "../types/product";
import "../styles/product-page.css";

// NOTE: this route file exports a client component, so we can't import
// `.server` modules here (Vite will fail with "Server-only module
// referenced by client"). Use process.env directly in the loader; Phase 4
// will extract loader logic into a `.server.ts` companion so we can adopt
// the pino logger and Zod-validated env across all routes.

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const product = data?.product;
    if (!product) {
        return [{ title: "Товар не знайдено | MIND BODY" }];
    }
    const siteUrl = data?.siteUrl || "https://saleid.icu";

    const desc = (product.description || `${product.name} — купити в MIND BODY`).substring(0, 160);
    const image = product.images?.[0] || "/brand-sun.png";
    const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;
    const price = Number(product.price) || 0;
    // Reflect real stock in the rich-result offer (the UI already shows
    // "Немає в наявності" for all-zero-stock products); a hardcoded InStock
    // here is a Merchant mismatch that can suppress the result.
    const inStock = !product.inventory?.length || product.inventory.some((v) => (v.stock ?? 0) > 0);
    const canonicalUrl = product.slug
        ? `${siteUrl}/p/${product.slug}`
        : `${siteUrl}/product/${product.id}`;
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
                },
            },
        },
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Головна", item: siteUrl },
                    ...(product.shopPageSlug
                        ? [
                              {
                                  "@type": "ListItem",
                                  position: 2,
                                  name: shopPageTitle(product.shopPageSlug),
                                  item: `${siteUrl}/shop/${product.shopPageSlug}`,
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
        // hydrates. Cuts LCP by 200-400ms on slow networks. imagesrcset hints
        // the browser to pick a variant matching the viewport.
        {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: product.images?.[0] || "/brand-sun.png",
            imagesrcset: product.images?.[0] ? buildWebpSrcset(product.images[0]) : undefined,
            imagesizes: "(max-width: 768px) 100vw, 50vw",
            fetchpriority: "high",
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
    sizes: string[];
    inventory: InventoryVariant[];
    status: string;
    is_new: boolean;
    is_sale: boolean;
    discount_percent: number;
}

export async function loader({ params }: LoaderFunctionArgs) {
    const slug = params.slug;
    if (!slug) throw new Response("Not Found", { status: 404 });

    let product: ProductDetailData | null = null;
    let filterConfig: FilterConfigData | null = null;
    let relatedProducts: RelatedProductCard[] = [];

    try {
        // Run product + filterConfig queries in parallel
        const [p, globalConfig] = await Promise.all([
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
        ]);

        // Status gate: only "active" products are publicly viewable. A draft or
        // archived product (or a missing one) falls through to the 404 below —
        // matching /p/:slug, the catalog, search and the order API. The check is
        // here (not a `throw` inside the try) because the catch re-throws as 500.
        if (p && p.status === "active") {
            const images = parseJson<string[]>(p.images, []);
            if (images.length === 0) images.push("/brand-sun.png");

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

    return {
        product,
        filterConfig,
        relatedProducts,
        siteUrl: process.env.SITE_URL ?? "https://saleid.icu",
    };
}

// ===== REVIEWS SECTION COMPONENT =====
function ReviewsSection({ productId }: { productId: string }) {
    const { showToast } = useToast();
    const [reviews, setReviews] = useState<ReviewData[]>([]);
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState("");
    const [formText, setFormText] = useState("");
    const [formRating, setFormRating] = useState(5);
    const [submitting, setSubmitting] = useState(false);
    // Track first load so we don't flash "be the first to review" before the
    // fetch resolves (which misrepresents products that DO have reviews).
    const [loaded, setLoaded] = useState(false);

    const fetchReviews = useCallback(async () => {
        try {
            const res = await fetch(`/api/reviews?productId=${productId}`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data.reviews || []);
                setAvg(data.avg || 0);
                setCount(data.count || 0);
            }
        } catch {
            /* silent */
        } finally {
            setLoaded(true);
        }
    }, [productId]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim() || !formText.trim()) {
            showToast("Будь ласка, заповніть всі поля", "error");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    authorName: formName.trim(),
                    rating: formRating,
                    text: formText.trim(),
                }),
            });
            if (res.ok) {
                const data = await res.json();
                showToast(data.message || "Дякуємо за ваш відгук! ✨");
                setFormName("");
                setFormText("");
                setFormRating(5);
                setShowForm(false);
                // Don't refetch — review is pending moderation and won't appear yet
            } else {
                const data = await res.json().catch(() => null);
                showToast(data?.error || "Помилка при збереженні", "error");
            }
        } catch {
            showToast("Помилка з'єднання", "error");
        }
        setSubmitting(false);
    };

    const renderStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);
    const getInitials = (name: string) =>
        (name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .substring(0, 2) || "?";
    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString("uk-UA", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="reviews-section">
            <div className="reviews-header">
                <h3>Відгуки {count > 0 && `(${count})`}</h3>
                {count > 0 && (
                    <div className="avg-rating">
                        <span className="stars">{renderStars(Math.round(avg))}</span>
                        <span>{avg} з 5</span>
                    </div>
                )}
            </div>

            {!loaded ? (
                <p className="reviews-empty" aria-busy="true">
                    Завантаження відгуків…
                </p>
            ) : reviews.length > 0 ? (
                <div className="reviews-list">
                    {reviews.map((r) => (
                        <div key={r.id} className="review-card">
                            <div className="review-card__header">
                                <div className="review-card__author">
                                    <div className="review-card__avatar">
                                        {getInitials(r.authorName)}
                                    </div>
                                    <div>
                                        <div className="review-card__name">{r.authorName}</div>
                                        <div className="review-card__date">
                                            {formatDate(r.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="review-card__stars">{renderStars(r.rating)}</div>
                            </div>
                            <p className="review-card__text">{r.text}</p>
                            {r.isVerified && (
                                <span className="review-card__verified">
                                    ✓ Підтверджена покупка
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="reviews-empty">Поки що немає відгуків. Будьте першими! ✨</p>
            )}

            {!showForm ? (
                <button onClick={() => setShowForm(true)} className="review-write-btn">
                    Написати відгук
                </button>
            ) : (
                <form className="review-form" onSubmit={handleSubmit}>
                    <h4>Залишити відгук</h4>

                    <div className="review-form__field">
                        <label>Оцінка</label>
                        <div
                            className="review-form__stars-input"
                            role="radiogroup"
                            aria-label="Оцінка товару"
                        >
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    role="radio"
                                    aria-checked={n <= formRating}
                                    aria-label={`Оцінка ${n} з 5`}
                                    className={n <= formRating ? "active" : ""}
                                    onClick={() => setFormRating(n)}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="review-form__field">
                        <label>Ваше ім'я</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Ольга"
                            maxLength={50}
                        />
                    </div>

                    <div className="review-form__field">
                        <label htmlFor="review-text">Ваш відгук</label>
                        <textarea
                            id="review-text"
                            value={formText}
                            onChange={(e) => setFormText(e.target.value)}
                            placeholder="Розкажіть про свій досвід із цим товаром..."
                            maxLength={1000}
                        />
                    </div>

                    <div className="review-form__actions">
                        <button type="submit" className="review-form__submit" disabled={submitting}>
                            {submitting ? "Відправка..." : "Надіслати відгук"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#999",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                            }}
                        >
                            Скасувати
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default function ProductDetail() {
    const { product, filterConfig, relatedProducts } = useLoaderData<typeof loader>();

    // State
    const { showToast } = useToast();
    const [selectedSize, setSelectedSize] = useState<string>("");
    const [selectedColor, setSelectedColor] = useState<string>(product.colors[0] || "");
    const [openAccordion, setOpenAccordion] = useState<string | null>("desc");
    const [activeImage, setActiveImage] = useState(0);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [quickBuyOpen, setQuickBuyOpen] = useState(false);
    const [quickBuyPhone, setQuickBuyPhone] = useState("");
    const [quickBuyName, setQuickBuyName] = useState("");
    const [quickBuySending, setQuickBuySending] = useState(false);
    /* Sprint 1 D2.2 — #3 CRO-002 sticky CTA visible-confirm state.
       Cart is localStorage (sync) so no fetcher.state to bind to; we
       fake a brief "✓ Додано" lock instead. Double-purpose: visual
       feedback + 1.2s guard against accidental double-add. */
    const [justAdded, setJustAdded] = useState(false);

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
            showToast("Будь ласка, оберіть розмір", "warning");
            return;
        }

        // Check stock availability
        if (product.inventory?.length > 0 && !isInStock) {
            showToast("Вибачте, цієї комбінації немає в наявності", "error");
            return;
        }

        StorageUtils.addToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0],
            size: selectedSize,
            color: selectedColor,
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
                <span style={{ fontWeight: 600 }}>Додано у кошик! ✨</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                    {product.name} {selectedSize ? `(${selectedSize})` : ""}
                </span>
            </div>,
            "success",
            product.images[0],
        );
    };

    const addToWishlist = () => {
        const added = StorageUtils.addToWishlist({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0],
            category: product.category ?? "",
        });
        if (added) showToast("Додано до улюбленого ❤️");
        else showToast("Вже у списку", "info");
    };

    const getColorLabel = (code: string) => filterConfig?.colors?.[code] || code;
    const getColorHex = (code: string) =>
        (code && typeof code === "string" ? COLOR_MAP[code.toLowerCase()] : code) || code;

    return (
        <main className="product-page-mindbody">
            {/* --- COMPACT LUXE HERO (Atmospheric) --- */}
            <div className="shop-hero-luxe compact">
                <div className="luxe-grain" />
                <div className="shop-hero-luxe__drift" />
                <div className="container hero-container">
                    <nav className="luxe-breadcrumb">
                        <Link to="/">Головна</Link>
                        <span className="sep">/</span>
                        <Link
                            to={`/shop/${isRealShopSlug(product.shopPageSlug) ? product.shopPageSlug : "yoga"}`}
                        >
                            {isRealShopSlug(product.shopPageSlug)
                                ? shopPageTitle(product.shopPageSlug)
                                : "Магазин"}
                        </Link>
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
                    {product.images.length > 0 && (
                        <div className="pdp-mobile-gallery-wrap">
                            <div
                                className="pdp-mobile-gallery"
                                onScroll={(e) => {
                                    const el = e.currentTarget;
                                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                                    if (idx !== activeImage) setActiveImage(idx);
                                }}
                            >
                                {product.images.map((img: string, idx: number) => (
                                    <div key={idx} className="pdp-mobile-gallery__slide">
                                        <picture>
                                            <source
                                                srcSet={buildWebpSrcset(img)}
                                                sizes="100vw"
                                                type="image/webp"
                                            />
                                            <img
                                                src={img}
                                                alt={`${product.name} — фото ${idx + 1}`}
                                                loading={idx === 0 ? "eager" : "lazy"}
                                                decoding="async"
                                                fetchPriority={idx === 0 ? "high" : "auto"}
                                                onClick={() => setZoomOpen(true)}
                                            />
                                        </picture>
                                    </div>
                                ))}
                            </div>
                            {product.images.length > 1 && (
                                <div className="pdp-mobile-gallery__counter" aria-live="polite">
                                    {activeImage + 1} / {product.images.length}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visuals: Puma Style (Vertical Thumbs Left + Main Right) */}
                    <div className="visuals-gallery-puma">
                        {/* Left Column: Vertical Thumbnails */}
                        {product.images.length > 1 && (
                            <div className="thumbs-col-vertical">
                                {product.images.map((img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        className={`thumb-vertical ${activeImage === idx ? "active" : ""}`}
                                        onClick={() => setActiveImage(idx)}
                                        aria-label={`View image ${idx + 1}`}
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
                                    src={product.images[activeImage] || product.images[0]}
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
                                    aria-label="Close zoom"
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
                                    src={product.images[activeImage] || product.images[0]}
                                    alt={product.name}
                                    className="zoom-overlay__img"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {product.images.length > 1 && (
                                    <div className="zoom-overlay__nav">
                                        <button
                                            aria-label="Попереднє фото"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveImage(
                                                    (i) =>
                                                        (i - 1 + product.images.length) %
                                                        product.images.length,
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
                                            {activeImage + 1} / {product.images.length}
                                        </span>
                                        <button
                                            aria-label="Наступне фото"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveImage(
                                                    (i) => (i + 1) % product.images.length,
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
                                        style={product.is_sale ? { color: "#b91c1c" } : undefined}
                                    >
                                        {formatPrice(product.price)} ₴
                                    </span>
                                    {product.is_sale && product.comparePrice > 0 && (
                                        <span className="old-price">
                                            {formatPrice(product.comparePrice)} ₴
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
                                                Колір:{" "}
                                                <span className="val" aria-live="polite">
                                                    {getColorLabel(selectedColor)}
                                                </span>
                                            </span>
                                        </div>
                                        <div
                                            className="color-options"
                                            role="radiogroup"
                                            aria-label="Колір"
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
                                                        aria-label={`${getColorLabel(color)}${!available ? " — немає в наявності" : ""}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {product.sizes.length > 0 && (
                                    <div className="selector-group">
                                        <div className="group-head">
                                            <span className="selector-label">Розмір</span>
                                            <Link to="/size-guide" className="size-guide">
                                                Таблиця розмірів
                                            </Link>
                                        </div>
                                        {/* Sprint 1 D2.3 — #19/#14 PDP a11y: aria-label spells out
                                            sold-out so SR users hear "Розмір M, немає в наявності"
                                            instead of just the dimmed pill being skipped. */}
                                        <div
                                            className="size-options"
                                            role="radiogroup"
                                            aria-label="Розмір"
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
                                                                ? `Розмір ${size}`
                                                                : `Розмір ${size}, немає в наявності`
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
                                                                        getVariantStock(size, c) >
                                                                        0,
                                                                );
                                                            if (
                                                                selectedColor &&
                                                                inStockColors.length > 0 &&
                                                                !inStockColors.includes(
                                                                    selectedColor,
                                                                )
                                                            ) {
                                                                setSelectedColor(inStockColors[0]);
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
                                                    ? "🔥 Останній — поспішіть!"
                                                    : currentStock <= 2
                                                      ? `🔥 Залишилось лише ${currentStock} шт — поспішіть!`
                                                      : `Залишилось ${currentStock} шт`}
                                            </>
                                        ) : (
                                            `✓ В наявності: ${currentStock} шт`
                                        )
                                    ) : (
                                        "✕ Немає в наявності"
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
                                    Швидка доставка по Україні
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
                                    14 днів на повернення
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
                                    Українське виробництво
                                </span>
                            </div>

                            <div className="actions-row">
                                <button
                                    className="btn-primary-add"
                                    onClick={addToCart}
                                    disabled={
                                        justAdded ||
                                        (product.sizes.length > 0 && !selectedSize) ||
                                        (!isInStock && product.inventory?.length > 0)
                                    }
                                    aria-live="polite"
                                    style={{
                                        opacity:
                                            (product.sizes.length > 0 && !selectedSize) ||
                                            (!isInStock && product.inventory?.length > 0)
                                                ? 0.5
                                                : 1,
                                    }}
                                >
                                    <span>
                                        {justAdded
                                            ? "✓ Додано"
                                            : !isInStock && product.inventory?.length > 0
                                              ? "Немає в наявності"
                                              : product.sizes.length > 0 && !selectedSize
                                                ? "Оберіть розмір"
                                                : "Додати в кошик"}
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
                                    Купити в 1 клік
                                </button>
                                <button
                                    className="btn-wishlist hover-scale"
                                    onClick={addToWishlist}
                                    aria-label="Додати в обране"
                                    title="Додати в обране"
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
                                        <h3 id="quick-buy-title" className="quick-buy-modal__title">
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
                                            Швидке замовлення
                                        </h3>
                                        <p className="quick-buy-modal__product">
                                            {product.name} &mdash; {formatPrice(product.price)} ₴
                                            {selectedSize ? ` · ${selectedSize}` : ""}
                                            {selectedColor ? ` · ${selectedColor}` : ""}
                                        </p>
                                        <input
                                            type="text"
                                            aria-label="Ваше ім'я"
                                            placeholder="Ваше ім'я"
                                            value={quickBuyName}
                                            onChange={(e) => setQuickBuyName(e.target.value)}
                                            className="quick-buy-modal__input"
                                            autoFocus
                                        />
                                        <input
                                            type="tel"
                                            aria-label="Ваш телефон"
                                            placeholder="+380 __ ___ __ __"
                                            value={quickBuyPhone}
                                            onChange={(e) => setQuickBuyPhone(e.target.value)}
                                            className="quick-buy-modal__input"
                                        />
                                        <p className="quick-buy-modal__hint">
                                            Ми зателефонуємо протягом 15 хвилин
                                        </p>
                                        <button
                                            disabled={quickBuySending || quickBuyPhone.length < 10}
                                            onClick={async () => {
                                                setQuickBuySending(true);
                                                try {
                                                    const res = await fetch("/api/telegram/send", {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                        },
                                                        body: JSON.stringify({
                                                            message: `🔥 ШВИДКЕ ЗАМОВЛЕННЯ\n\n📦 ${product.name}\n💰 ${product.price} ₴${selectedSize ? `\n📏 Розмір: ${selectedSize}` : ""}${selectedColor ? `\n🎨 Колір: ${selectedColor}` : ""}\n👤 Ім'я: ${quickBuyName || "Не вказано"}\n📞 Телефон: ${quickBuyPhone}`,
                                                        }),
                                                    });
                                                    // Don't tell the customer the order was accepted
                                                    // if the send actually failed (a dropped order).
                                                    if (!res.ok) throw new Error("send failed");
                                                    setQuickBuyOpen(false);
                                                    setQuickBuyPhone("");
                                                    setQuickBuyName("");
                                                    showToast(
                                                        "Замовлення прийнято! Ми зателефонуємо протягом 15 хвилин",
                                                    );
                                                } catch {
                                                    showToast(
                                                        "Помилка. Спробуйте ще раз.",
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
                                            {quickBuySending ? "Відправка..." : "Замовити"}
                                        </button>
                                        <button
                                            onClick={() => setQuickBuyOpen(false)}
                                            className="quick-buy-modal__cancel"
                                        >
                                            Скасувати
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
                                        <span>Опис</span>
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
                                        <span>Доставка</span>
                                        <span
                                            aria-hidden="true"
                                            className={`acc-icon ${openAccordion === "delivery" ? "minus" : "plus"}`}
                                        />
                                    </button>
                                    <div id="acc-body-delivery" className="acc-body" role="region">
                                        <div className="acc-inner">
                                            <p>• Доставка Новою Поштою 1-3 дні</p>
                                            <p>• Оплата карткою або при отриманні</p>
                                            <p>• 14 днів на повернення</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {relatedProducts.length > 0 && (
                    <div className="related-section">
                        <h3 className="related-title">Вам також може сподобатись</h3>
                        <div className="related-grid">
                            {relatedProducts.map((rp) => (
                                <Link
                                    to={rp.slug ? `/p/${rp.slug}` : `/product/${rp.id}`}
                                    key={rp.id}
                                    className="related-card"
                                >
                                    <div className="related-img-box">
                                        {/* 3:4 portrait matches our actual product photos
                                            (2625x3500). Below the fold => lazy. */}
                                        <img
                                            src={rp.image}
                                            alt={rp.name}
                                            width="300"
                                            height="400"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    <div className="related-info">
                                        <h4>{rp.name}</h4>
                                        <span>{formatPrice(rp.price)} ₴</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== REVIEWS SECTION ===== */}
                <ReviewsSection productId={product.id} />
            </div>

            {/* CSS moved to app/styles/product-page.css */}

            {/* Mobile Sticky CTA */}
            <div className="mobile-sticky-cta">
                <div className="mobile-sticky-cta__price">{formatPrice(product.price)} ₴</div>
                <button
                    type="button"
                    className="mobile-sticky-cta__btn"
                    onClick={addToCart}
                    disabled={
                        justAdded ||
                        (product.sizes.length > 0 && !selectedSize) ||
                        (!isInStock && product.inventory?.length > 0)
                    }
                    aria-live="polite"
                >
                    {justAdded
                        ? "✓ Додано"
                        : !isInStock && product.inventory?.length > 0
                          ? "Немає в наявності"
                          : product.sizes.length > 0 && !selectedSize
                            ? "Оберіть розмір"
                            : "Додати в кошик"}
                </button>
            </div>
        </main>
    );
}
