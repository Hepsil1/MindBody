import { type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import ProductCard from "../components/ProductCard";
import { useState, useMemo, useEffect, useCallback } from "react";
import { prisma } from "../db.server";
import {
    parseAndMergeFilterConfig,
    type MergedFilterConfig,
    type PriceRange,
} from "../utils/filters";
import { labelToSlug, slugToLabel } from "../utils/categoryMap";

// Product card shape after the loader's DB → frontend mapping. Used both by
// the render side (filtering, sorting) and as the loader contract.
interface ShopProductCard {
    id: string;
    name: string;
    description: string | null;
    price: number;
    comparePrice: number;
    sale_price: number | undefined;
    image: string;
    image2: string | undefined;
    images: string[];
    // Matches ProductCard's `string | undefined` API; loader maps null → undefined.
    category: string | undefined;
    colors: string[];
    sizes: string[];
    is_new: boolean;
    is_sale: boolean;
    discount_percent: number;
    status: string;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const shopPage = data?.shopPage;
    const slug = data?.category || "women";
    const titles: Record<string, string> = {
        women: "Жіноча колекція",
        kids: "Дитяча колекція",
    };
    const title = shopPage?.title || titles[slug] || "Каталог";
    const heroImage = shopPage?.heroImage || "/brand-sun.png";
    const siteUrl = data?.siteUrl || "https://saleid.icu";

    const canonicalUrl = `${siteUrl}/shop/${slug}`;
    return [
        { title: `${title} | MIND BODY` },
        {
            name: "description",
            content: `${title} спортивного одягу MIND BODY. Йога, гімнастика, акробатика. Українське виробництво.`,
        },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: `${title} | MIND BODY` },
        {
            property: "og:description",
            content: `${title} спортивного одягу MIND BODY. Йога, гімнастика, акробатика.`,
        },
        { property: "og:type", content: "website" },
        {
            property: "og:image",
            content: heroImage.startsWith("http") ? heroImage : `${siteUrl}${heroImage}`,
        },
        { property: "og:locale", content: "uk_UA" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${title} | MIND BODY` },
        {
            name: "twitter:image",
            content: heroImage.startsWith("http") ? heroImage : `${siteUrl}${heroImage}`,
        },
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Головна", item: siteUrl },
                    { "@type": "ListItem", position: 2, name: title, item: canonicalUrl },
                ],
            },
        },
    ];
};

export function headers() {
    return {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    };
}

// Defensive JSON parser that preserves the fallback's type.
function parseJson<T>(str: string | null | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

export async function loader({ params }: LoaderFunctionArgs) {
    const categorySlug = params.category || "women";

    // Run all 3 queries in parallel for max speed
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
                where: { shopPageSlug: categorySlug, status: "active" },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    comparePrice: true,
                    category: true,
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
                return [] as never[];
            }),
    ]);

    const specificConfig = configs.find((c) => c.id === categorySlug);
    const globalConfig = configs.find((c) => c.id === "global");

    // Prioritize specific config, fallback to global
    const configToParse = specificConfig?.config || globalConfig?.config;
    const filterConfig: MergedFilterConfig = parseAndMergeFilterConfig(configToParse);
    const shopPage = shopPageResult;

    // Map Raw DB Objects to Frontend Props
    const NOW = Date.now();
    const NEW_THRESHOLD_DAYS = 14; // Products created within 14 days = NEW

    const mappedProducts: ShopProductCard[] = rawProducts.map((p) => {
        const images = parseJson<string[]>(p.images, []);
        const price = Number(p.price);
        const comparePrice = Number(p.comparePrice) || 0;
        const isSale = comparePrice > price && price > 0;
        const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        const isNew = NOW - createdAt < NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

        return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: isSale ? comparePrice : price, // ProductCard shows this as "original" (crossed out when sale)
            comparePrice,
            sale_price: isSale ? price : undefined, // ProductCard shows this as current (red) price
            image: images[0] || "/brand-sun.png",
            image2: images[1] || undefined, // Hover image for card
            images,
            category: p.category ?? undefined,
            colors: parseJson<string[]>(p.colors, []),
            sizes: parseJson<string[]>(p.sizes, []),
            is_new: isNew,
            is_sale: isSale,
            discount_percent: isSale ? Math.round((1 - price / comparePrice) * 100) : 0,
            status: p.status,
        };
    });

    return {
        products: mappedProducts,
        category: categorySlug,
        shopPage,
        filterConfig,
        siteUrl: process.env.SITE_URL || "https://saleid.icu",
    };
}
import { useSearchParams } from "react-router";
import "../styles/shop.css";

export default function ShopCategory() {
    const { products, category, shopPage, filterConfig } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Helper to read initial arrays from URL
    const getListParam = (key: string) => {
        const val = searchParams.get(key);
        return val ? val.split(",") : [];
    };

    // Legacy ?cat= may be a Ukrainian label — convert to slug on mount
    const initialCat = searchParams.get("cat");
    const initialCatSlug = initialCat ? (labelToSlug(initialCat) ?? initialCat) : null;
    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        initialCatSlug ? [initialCatSlug] : getListParam("categories"),
    );
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedSizes, setSelectedSizes] = useState<string[]>(getListParam("sizes"));
    const [selectedColors, setSelectedColors] = useState<string[]>(getListParam("colors"));
    const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(
        searchParams.get("priceRange"),
    );
    const [sortBy, setSortBy] = useState(searchParams.get("sort") || "default");
    const [displayCount, setDisplayCount] = useState(12);
    const [openSections, setOpenSections] = useState({
        category: true,
        size: true,
        color: true,
        price: true,
    });
    const LOAD_MORE_COUNT = 12;

    // Legacy ?cat= redirect: convert Cyrillic label to slug
    useEffect(() => {
        const cat = searchParams.get("cat");
        if (cat) {
            const slug = labelToSlug(cat) ?? cat;
            if (!selectedCategories.includes(slug)) {
                setSelectedCategories([slug]);
            }
        }
    }, [searchParams.get("cat")]);

    // Sync state changes to URL Params
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);

        // Remove old generic cat
        if (newParams.has("cat")) newParams.delete("cat");

        if (selectedCategories.length > 0)
            newParams.set("categories", selectedCategories.join(","));
        else newParams.delete("categories");

        if (selectedSizes.length > 0) newParams.set("sizes", selectedSizes.join(","));
        else newParams.delete("sizes");

        if (selectedColors.length > 0) newParams.set("colors", selectedColors.join(","));
        else newParams.delete("colors");

        if (selectedPriceRange) newParams.set("priceRange", selectedPriceRange);
        else newParams.delete("priceRange");

        if (sortBy !== "default") newParams.set("sort", sortBy);
        else newParams.delete("sort");

        // Apply only if something actually changed to avoid loop
        if (newParams.toString() !== searchParams.toString()) {
            setSearchParams(newParams, { replace: true, preventScrollReset: true });
        }
    }, [
        selectedCategories,
        selectedSizes,
        selectedColors,
        selectedPriceRange,
        sortBy,
        searchParams,
        setSearchParams,
    ]);

    const toggleSection = (section: "category" | "size" | "color" | "price") => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Use DB data or basic defaults
    const prefixLabel =
        shopPage?.prefixLabel || (category === "kids" ? "For little stars" : "For active life");
    const mainLabel = shopPage?.title || (category === "kids" ? "Діти" : "Жіноча");
    const layerLabel = "MIND BODY";

    // Parse Image Position
    const imagePosStyle = useMemo(() => {
        if (!shopPage?.heroImagePos) return {};
        const parts = shopPage.heroImagePos.split(" ");
        const x = parts[0] || "50%";
        const y = parts[1] || "50%";
        const scale = parseFloat(parts[2]) || 1;
        return {
            objectPosition: `${x} ${y}`,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: `${x} ${y}`,
        };
    }, [shopPage]);

    // Check if we are inside an iframe (visual editor mode)
    const isIframe = typeof window !== "undefined" && window.parent !== window;

    const dynamicFilters = filterConfig;

    const categories = useMemo(() => {
        return dynamicFilters?.categories ? Object.keys(dynamicFilters.categories) : [];
    }, [dynamicFilters]);

    const sizes = useMemo(() => {
        return dynamicFilters?.sizes || [];
    }, [dynamicFilters]);

    const colors = useMemo(() => {
        return dynamicFilters?.colors ? Object.keys(dynamicFilters.colors) : [];
    }, [dynamicFilters]);

    const priceRanges = dynamicFilters?.priceRanges || [];
    const categoryLabels: Record<string, string> = dynamicFilters?.categories || {};
    const colorLabels: Record<string, string> = dynamicFilters?.colors || {};

    const filteredProducts = useMemo(() => {
        let result = [...products];
        if (selectedCategories.length > 0) {
            result = result.filter((p) => {
                if (p.category && selectedCategories.includes(p.category)) return true;
                // Graceful fallback for legacy products storing the label instead of slug
                return selectedCategories.some((cat) => categoryLabels[cat] === p.category);
            });
        }
        if (selectedSizes.length > 0) {
            result = result.filter((p) => p.sizes?.some((s: string) => selectedSizes.includes(s)));
        }
        if (selectedColors.length > 0) {
            result = result.filter((p) =>
                p.colors?.some((c: string) => {
                    if (selectedColors.includes(c)) return true;
                    // Graceful fallback for legacy products storing the color label
                    return selectedColors.some((sc) => colorLabels[sc] === c);
                }),
            );
        }
        if (selectedPriceRange) {
            const range = priceRanges.find((r) => r.id === selectedPriceRange);
            if (range) {
                result = result.filter((p) => p.price >= range.min && p.price <= range.max);
            }
        }
        switch (sortBy) {
            case "price-asc":
                result.sort((a, b) => a.price - b.price);
                break;
            case "price-desc":
                result.sort((a, b) => b.price - a.price);
                break;
            case "newest":
                break;
        }
        return result;
    }, [
        products,
        selectedCategories,
        selectedSizes,
        selectedColors,
        selectedPriceRange,
        sortBy,
        priceRanges,
    ]);

    const visibleProducts = filteredProducts.slice(0, displayCount);
    const hasMore = displayCount < filteredProducts.length;

    const toggleCategory = (cat: string) => {
        setSelectedCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
        );
        setDisplayCount(12);
    };

    const toggleSize = (size: string) => {
        setSelectedSizes((prev) =>
            prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
        );
        setDisplayCount(12);
    };

    const toggleColor = (color: string) => {
        setSelectedColors((prev) =>
            prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color],
        );
        setDisplayCount(12);
    };

    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedSizes([]);
        setSelectedColors([]);
        setSelectedPriceRange(null);
        setDisplayCount(12);
    };

    return (
        <div className="shop-luxe">
            {/* Luxe Grainy Hero */}
            <section
                className="shop-hero-luxe"
                style={{ background: shopPage?.heroImage ? "none" : undefined }}
            >
                {/* Dynamic Background Image */}
                {shopPage?.heroImage && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                        <img
                            src={shopPage.heroImage}
                            alt="Background"
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                ...imagePosStyle,
                            }}
                        />
                        {/* Overlay to ensure text readability */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0,0,0,0.3)",
                            }}
                        ></div>
                    </div>
                )}

                {/* Admin Edit Button - Centered */}
                {isIframe && (
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            zIndex: 100,
                            border: "2px dashed rgba(255,255,255,0.3)",
                            padding: "20px",
                            borderRadius: "12px",
                            textAlign: "center",
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                window.parent.postMessage(
                                    {
                                        type: "OPEN_SHOP_BG_EDITOR",
                                        category: category, // 'women', 'kids', etc.
                                    },
                                    "*",
                                );
                            }}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "10px",
                                background: "white",
                                color: "black",
                                padding: "12px 24px",
                                borderRadius: "30px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                fontSize: "13px",
                                letterSpacing: "1px",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                                transition: "transform 0.2s",
                                cursor: "pointer",
                                border: "none",
                            }}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Змінити фон
                        </button>
                    </div>
                )}

                <div className="shop-hero-luxe__drift"></div>
                <div
                    className="shop-hero-luxe__background"
                    style={{ opacity: shopPage?.heroImage ? 0.3 : 1 }}
                >
                    <span className="stroke-text">{layerLabel}</span>
                </div>
                <div className="container" style={{ position: "relative", zIndex: 1 }}>
                    <div className="shop-hero-luxe__content">
                        <nav className="luxe-breadcrumb">
                            <Link to="/">Головна</Link>
                            <span>/</span>
                            <span>Магазин</span>
                        </nav>

                        <div className="hero-composition">
                            {/* Left side: Main title block */}
                            <div className="hero-title-block">
                                <h1 className="luxe-title">
                                    <span className="luxe-title__main">{mainLabel}</span>
                                    <span className="luxe-title__sub">колекція</span>
                                </h1>
                                <div className="luxe-signature">
                                    <span className="line"></span>
                                    <span className="text">mind body</span>
                                </div>
                            </div>

                            {/* Right side: Special tagline */}
                            <div className="hero-tagline-block">
                                <div className="tagline-accent">
                                    <span className="tagline-line"></span>
                                    <span className="tagline-text">{prefixLabel}</span>
                                    <span className="tagline-line"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mobile Filter Button */}
            <div className="mobile-filter-bar">
                <button
                    className="mobile-filter-btn"
                    onClick={() => setIsFilterOpen(true)}
                    aria-label="Відкрити фільтри"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                        <line x1="10" y1="18" x2="14" y2="18" />
                    </svg>
                    ФІЛЬТРИ
                    {selectedCategories.length +
                        selectedSizes.length +
                        selectedColors.length +
                        (selectedPriceRange ? 1 : 0) >
                        0 && (
                        <span className="mobile-filter-badge">
                            {selectedCategories.length +
                                selectedSizes.length +
                                selectedColors.length +
                                (selectedPriceRange ? 1 : 0)}
                        </span>
                    )}
                </button>
                <div className="mobile-product-count">{filteredProducts.length} товарів</div>
            </div>

            {/* Mobile Filter Drawer Overlay */}
            {isFilterOpen && (
                <div className="filter-drawer-overlay" onClick={() => setIsFilterOpen(false)}>
                    <div className="filter-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="filter-drawer__header">
                            <span>ФІЛЬТРИ</span>
                            <button
                                className="filter-drawer__close"
                                onClick={() => setIsFilterOpen(false)}
                                aria-label="Закрити"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="filter-drawer__body">
                            {/* Same filter content rendered inside drawer */}
                            <div className="filter-accordion active">
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("category")}
                                >
                                    <span>КАТЕГОРІЯ</span>
                                    <span className="icon">
                                        {openSections.category ? "−" : "+"}
                                    </span>
                                </div>
                                <div className="accordion-content">
                                    <div className="filter-checkbox-list">
                                        {categories.map((cat, idx) => {
                                            const count = products.filter(
                                                (p) =>
                                                    p.category === cat ||
                                                    p.category === categoryLabels[cat],
                                            ).length;
                                            if (count === 0) return null;
                                            return (
                                                <label
                                                    key={`dcatfil-${cat}-${idx}`}
                                                    className="mb-checkbox-item"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCategories.includes(cat)}
                                                        onChange={() => toggleCategory(cat)}
                                                    />
                                                    <span className="checkbox-visual"></span>
                                                    <span className="label-text">
                                                        {categoryLabels[cat] || cat}{" "}
                                                        <span
                                                            style={{
                                                                marginLeft: "6px",
                                                                opacity: 0.4,
                                                                fontSize: "11px",
                                                            }}
                                                        >
                                                            ({count})
                                                        </span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="filter-accordion active">
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("size")}
                                >
                                    <span>РОЗМІР</span>
                                    <span className="icon">{openSections.size ? "−" : "+"}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="mb-size-grid">
                                        {sizes.map((size: string, idx: number) => {
                                            const count = products.filter((p) =>
                                                p.sizes?.includes(size),
                                            ).length;
                                            if (count === 0) return null;
                                            return (
                                                <button
                                                    key={`dsz-${size}-${idx}`}
                                                    className={`mb-size-chip ${selectedSizes.includes(size) ? "active" : ""}`}
                                                    onClick={() => toggleSize(size)}
                                                >
                                                    {size}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="filter-accordion active">
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("color")}
                                >
                                    <span>КОЛІР</span>
                                    <span className="icon">{openSections.color ? "−" : "+"}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="mb-color-grid">
                                        {colors.map((color: string, idx: number) => {
                                            const count = products.filter(
                                                (p) =>
                                                    p.colors?.includes(color) ||
                                                    (colorLabels[color] &&
                                                        p.colors?.includes(colorLabels[color])),
                                            ).length;
                                            if (count === 0) return null;
                                            return (
                                                <button
                                                    key={`dcol-${color}-${idx}`}
                                                    className={`mb-color-swatch ${color} ${selectedColors.includes(color) ? "active" : ""}`}
                                                    onClick={() => toggleColor(color)}
                                                    title={colorLabels[color] || color}
                                                >
                                                    <span className="swatch-check">✓</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="filter-accordion active">
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("price")}
                                >
                                    <span>ЦІНА</span>
                                    <span className="icon">{openSections.price ? "−" : "+"}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="filter-checkbox-list">
                                        {priceRanges.map((range: PriceRange, idx: number) => (
                                            <label
                                                key={range.id || `dr-${idx}`}
                                                className="mb-checkbox-item"
                                            >
                                                <input
                                                    type="radio"
                                                    name="price-range-drawer"
                                                    checked={selectedPriceRange === range.id}
                                                    onChange={() => {
                                                        setSelectedPriceRange(range.id);
                                                        setDisplayCount(12);
                                                    }}
                                                />
                                                <span className="checkbox-visual radio"></span>
                                                <span className="label-text">{range.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="filter-drawer__footer">
                            {(selectedCategories.length > 0 ||
                                selectedSizes.length > 0 ||
                                selectedColors.length > 0 ||
                                selectedPriceRange) && (
                                <button
                                    onClick={() => {
                                        clearFilters();
                                    }}
                                    className="filter-drawer__reset"
                                >
                                    Скинути фільтри
                                </button>
                            )}
                            <button
                                onClick={() => setIsFilterOpen(false)}
                                className="filter-drawer__apply"
                            >
                                Показати {filteredProducts.length} товарів
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="shop-main-layout">
                <div className="container">
                    <div className="luxe-grid">
                        {/* MIND BODY x Puma Hybrid Sidebar */}
                        <aside className="mb-shop-sidebar">
                            <div className="sidebar-header">
                                <h3>ФІЛЬТРИ</h3>
                            </div>

                            {/* Category Accordion */}
                            <div
                                className={`filter-accordion ${openSections.category ? "active" : ""}`}
                            >
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("category")}
                                >
                                    <span>КАТЕГОРІЯ</span>
                                    <span className="icon">
                                        {openSections.category ? "−" : "+"}
                                    </span>
                                </div>
                                <div className="accordion-content">
                                    <div className="filter-checkbox-list">
                                        {categories.map((cat, idx) => {
                                            const count = products.filter(
                                                (p) =>
                                                    p.category === cat ||
                                                    p.category === categoryLabels[cat],
                                            ).length;
                                            if (count === 0) return null;
                                            return (
                                                <label
                                                    key={`cat-${cat}-${idx}`}
                                                    className="mb-checkbox-item"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCategories.includes(cat)}
                                                        onChange={() => toggleCategory(cat)}
                                                    />
                                                    <span className="checkbox-visual"></span>
                                                    <span className="label-text">
                                                        {categoryLabels[cat] || cat}
                                                        <span
                                                            style={{
                                                                marginLeft: "6px",
                                                                opacity: 0.4,
                                                                fontSize: "11px",
                                                            }}
                                                        >
                                                            ({count})
                                                        </span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Size Accordion */}
                            <div
                                className={`filter-accordion ${openSections.size ? "active" : ""}`}
                            >
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("size")}
                                >
                                    <span>РОЗМІР</span>
                                    <span className="icon">{openSections.size ? "−" : "+"}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="mb-size-grid">
                                        {sizes.map((size: string, idx: number) => {
                                            const count = products.filter((p) =>
                                                p.sizes?.includes(size),
                                            ).length;
                                            if (count === 0) return null;
                                            return (
                                                <button
                                                    key={`size-${size}-${idx}`}
                                                    className={`mb-size-chip ${selectedSizes.includes(size) ? "active" : ""}`}
                                                    onClick={() => toggleSize(size)}
                                                >
                                                    {size}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Color Accordion */}
                            <div
                                className={`filter-accordion ${openSections.color ? "active" : ""}`}
                            >
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("color")}
                                >
                                    <span>КОЛІР</span>
                                    <span className="icon">{openSections.color ? "−" : "+"}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="mb-color-grid">
                                        {colors.map((color: string, idx: number) => {
                                            const count = products.filter(
                                                (p) =>
                                                    p.colors?.includes(color) ||
                                                    (colorLabels[color] &&
                                                        p.colors?.includes(colorLabels[color])),
                                            ).length;
                                            if (count === 0) return null;
                                            return (
                                                <button
                                                    key={`color-${color}-${idx}`}
                                                    className={`mb-color-swatch ${color} ${selectedColors.includes(color) ? "active" : ""}`}
                                                    onClick={() => toggleColor(color)}
                                                    title={colorLabels[color] || color}
                                                >
                                                    <span className="swatch-check">✓</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Price Accordion */}
                            <div
                                className={`filter-accordion ${openSections.price ? "active" : ""}`}
                            >
                                <div
                                    className="accordion-trigger"
                                    onClick={() => toggleSection("price")}
                                >
                                    <span>ЦІНА</span>
                                    <span className="icon">{openSections.price ? "−" : "+"}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="filter-checkbox-list">
                                        {priceRanges.map((range: PriceRange, idx: number) => (
                                            <label
                                                key={range.id || `range-${idx}`}
                                                className="mb-checkbox-item"
                                            >
                                                <input
                                                    type="radio"
                                                    name="price-range"
                                                    checked={selectedPriceRange === range.id}
                                                    onChange={() => {
                                                        setSelectedPriceRange(range.id);
                                                        setDisplayCount(12);
                                                    }}
                                                />
                                                <span className="checkbox-visual radio"></span>
                                                <span className="label-text">{range.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {(selectedCategories.length > 0 ||
                                selectedSizes.length > 0 ||
                                selectedColors.length > 0 ||
                                selectedPriceRange) && (
                                <button onClick={clearFilters} className="mb-reset-filters">
                                    Скинути всі фільтри
                                </button>
                            )}
                        </aside>

                        {/* Shop Content Area */}
                        <main className="mb-shop-content">
                            {/* MB sorting Toolbar */}
                            <div className="mb-toolbar">
                                <div className="toolbar-top-row">
                                    <div className="sort-label">СОРТУВАТИ ЗА:</div>
                                    <div className="sort-chips">
                                        {[
                                            { id: "default", label: "За релевантністю" },
                                            { id: "price-asc", label: "Ціна: за зростанням" },
                                            { id: "price-desc", label: "Ціна: за зменшенням" },
                                            { id: "newest", label: "Новинки" },
                                        ].map((option) => (
                                            <button
                                                key={option.id}
                                                className={`sort-chip ${sortBy === option.id ? "active" : ""}`}
                                                onClick={() => setSortBy(option.id)}
                                            >
                                                {option.label}
                                                {sortBy === option.id && (
                                                    <span className="close-x">✕</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="product-count">
                                        {visibleProducts.length < filteredProducts.length
                                            ? `${visibleProducts.length} з ${filteredProducts.length} ТОВАРІВ`
                                            : `${filteredProducts.length} ТОВАРІВ`}
                                    </div>
                                </div>
                            </div>

                            {/* Luxe Grid */}
                            {visibleProducts.length > 0 ? (
                                <>
                                    <div className="luxe-product-grid">
                                        {visibleProducts.map((product, idx) => (
                                            <div
                                                key={product.id || `product-${idx}`}
                                                className="luxe-card-wrapper"
                                            >
                                                <ProductCard product={product} />
                                            </div>
                                        ))}
                                    </div>

                                    {hasMore && (
                                        <div className="load-more-wrap">
                                            <button
                                                className="load-more-btn"
                                                onClick={() =>
                                                    setDisplayCount(
                                                        (prev) => prev + LOAD_MORE_COUNT,
                                                    )
                                                }
                                            >
                                                Показати ще (
                                                {Math.min(
                                                    LOAD_MORE_COUNT,
                                                    filteredProducts.length - displayCount,
                                                )}
                                                )
                                            </button>
                                            <span className="load-more-progress">
                                                {visibleProducts.length} / {filteredProducts.length}
                                            </span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="luxe-empty">
                                    <div className="luxe-empty__content">
                                        <span className="empty-num">00</span>
                                        <h2>Ми не знайшли збігів за вашим запитом</h2>
                                        <p>
                                            Спробуйте змінити технічні параметри або скинути всі
                                            фільтри.
                                        </p>
                                        <button onClick={clearFilters} className="luxe-btn-primary">
                                            Скинути всі налаштування
                                        </button>
                                    </div>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}
