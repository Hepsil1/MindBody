import { type LoaderFunctionArgs, type MetaFunction, redirect } from "react-router";
import { useLoaderData } from "react-router";
import { localeFromParam, localeFromParamSafe, localizePath, OG_LOCALE } from "../i18n/config";
import { useI18n, useMoney, LLink, plural, getT } from "../i18n";
import ProductCard from "../components/ProductCard";
import { useState, useMemo, useEffect, useCallback } from "react";
import { type MergedFilterConfig, type PriceRange } from "../utils/filters";
import {
    labelToSlug,
    slugToLabel,
    ALLOWED_CATEGORY_SLUGS,
    isValidSubcategory,
} from "../utils/categoryMap";
import { fabricsForShop, sleevesForShop, fabricLabel, sleeveLabel } from "../utils/taxonomy";
import { DEFAULT_SITE_URL } from "../utils/site-url";
import { shopPageLabel } from "../utils/shop-pages";
import {
    loadShopData,
    type ShopProductCard as SharedShopProductCard,
} from "../utils/shopProducts.server";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { useEditorMode, postToEditor } from "../utils/editor-bridge";

// Product card shape used by the render side (filtering, sorting). The
// loader returns this through the shared loadShopData() helper — re-export
// the shared type so existing code-paths that referenced ShopProductCard
// keep compiling without changes.
type ShopProductCard = SharedShopProductCard;

export const meta: MetaFunction<typeof loader> = ({ data, location, params }) => {
    const locale = localeFromParamSafe(params.lang);
    const t = getT(locale);
    const shopPage = data?.shopPage;
    const slug = data?.category || "yoga";
    // Title: admin-set DB title wins; else the taxonomy label (all 6 real
    // slugs), not the legacy women/kids-only map.
    const title = shopPage?.title || t(shopPageLabel(slug).title) || t("Каталог");
    const heroImage = shopPage?.heroImage || "/brand-sun.png";
    const siteUrl = data?.siteUrl || DEFAULT_SITE_URL;
    const products = data?.products ?? [];

    const canonicalUrl = `${siteUrl}${localizePath(`/shop/${slug}`, locale)}`;
    // Faceted/sorted/paginated variants (any ?query) are non-canonical
    // duplicates of the clean /shop/:slug page — keep them out of the index
    // while still following links so products keep getting crawled.
    const isFiltered = Boolean(location?.search && location.search.length > 1);

    // First 10 products as an ItemList — Google recommends keeping the
    // exposed list short. The full set still lives in the dynamic
    // sitemap.xml, so search engines find everything either way.
    const listItems = products.slice(0, 10).map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${siteUrl}/product/${p.id}`,
        name: p.name,
    }));

    return [
        { title: `${title} | MIND BODY` },
        {
            name: "description",
            content: t(
                "{title} спортивного одягу MIND BODY. Йога, гімнастика, акробатика. Українське виробництво.",
                { title },
            ),
        },
        ...(isFiltered ? [{ name: "robots", content: "noindex, follow" }] : []),
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: `${title} | MIND BODY` },
        {
            property: "og:description",
            content: t("{title} спортивного одягу MIND BODY. Йога, гімнастика, акробатика.", {
                title,
            }),
        },
        { property: "og:type", content: "website" },
        {
            property: "og:image",
            content: heroImage.startsWith("http") ? heroImage : `${siteUrl}${heroImage}`,
        },
        { property: "og:locale", content: OG_LOCALE[locale] },
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
                    { "@type": "ListItem", position: 1, name: t("Головна"), item: siteUrl },
                    { "@type": "ListItem", position: 2, name: title, item: canonicalUrl },
                ],
            },
        },
        // CollectionPage tells Google this URL is a category listing, not
        // a generic content page. The embedded ItemList exposes our top
        // products with their canonical URLs so they can surface in
        // "shopping" results / sitelinks. The full catalogue is still
        // crawled via sitemap.xml.
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: title,
                url: canonicalUrl,
                description: shopPage?.subtitle ?? `${title} MIND BODY`,
                isPartOf: { "@type": "WebSite", url: siteUrl, name: "MIND BODY" },
                inLanguage: locale === "uk" ? "uk-UA" : locale === "en" ? "en-US" : "ru-RU",
                mainEntity: {
                    "@type": "ItemList",
                    numberOfItems: products.length,
                    itemListElement: listItems,
                },
            },
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

// Defensive JSON parser that preserves the fallback's type.
function parseJson<T>(str: string | null | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const locale = localeFromParam(params.lang);
    const categorySlug = params.category || "yoga";

    // 301 redirect legacy query-string filters to the new nested path form.
    // We only redirect *single* selections — multi-filter (?categories=a,b)
    // stays as a query because it has no clean canonical equivalent.
    // Three legacy inputs all funnel through here:
    //   ?categories=longsleeve   (already a slug)
    //   ?categories=Лонгсліви    (Ukrainian label — percent-encoded or not)
    //   ?cat=Лонгсліви           (older parameter name)
    const url = new URL(request.url);
    const rawCategories = url.searchParams.get("categories");
    const rawCat = url.searchParams.get("cat");
    const raw = rawCategories ?? rawCat;
    if (raw && !raw.includes(",")) {
        const slug = ALLOWED_CATEGORY_SLUGS.has(raw) ? raw : labelToSlug(raw);
        if (slug && isValidSubcategory(categorySlug, slug)) {
            throw redirect(localizePath(`/shop/${categorySlug}/${slug}`, locale), 301);
        }
    }

    // Single source of truth for the data fetch — same helper that the
    // /shop/:category/:subcategory route calls (with subcategoryFilter).
    //
    // Batch 40 atom 2: wrap in cachedFetch (60 s TTL) mirroring the home
    // loader pattern.  Shop category pages were re-running 3+ Prisma
    // queries on every request — 50–200 ms TTFB that's invisible to the
    // first visitor in the window but greatly helps everyone else.  Cache
    // key includes the category slug so /shop/yoga and /shop/sport stay
    // independent.  Admin product writes should call invalidateCache.
    // (loadShopData caches internally with the same key family and applies
    // the locale OUTSIDE the cache, so en/ru can't poison the uk cache.)
    return loadShopData(categorySlug, {}, locale);
}
import { useSearchParams, useParams, useNavigate } from "react-router";
import "../styles/shop.css";

export default function ShopCategory() {
    const { products, category, shopPage, filterConfig } = useLoaderData<typeof loader>();
    const { t, lp, locale } = useI18n();
    const money = useMoney();
    const [searchParams, setSearchParams] = useSearchParams();
    // When mounted via the /shop/:category/:subcategory nested route, the
    // sidebar should reflect the path-selected subcategory as a pre-checked
    // filter. Read it once here so both initial state and the URL-sync
    // effect can stay aware of "path mode".
    const routeParams = useParams<{ subcategory?: string }>();
    const pathSubcategory = routeParams.subcategory ?? null;

    // Helper to read initial arrays from URL
    const getListParam = (key: string) => {
        const val = searchParams.get(key);
        return val ? val.split(",") : [];
    };

    // Legacy ?cat= may be a Ukrainian label — convert to slug on mount
    const initialCat = searchParams.get("cat");
    const initialCatSlug = initialCat ? (labelToSlug(initialCat) ?? initialCat) : null;
    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        pathSubcategory
            ? [pathSubcategory]
            : initialCatSlug
              ? [initialCatSlug]
              : getListParam("categories"),
    );
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedSizes, setSelectedSizes] = useState<string[]>(getListParam("sizes"));
    const [selectedColors, setSelectedColors] = useState<string[]>(getListParam("colors"));
    // Deeper taxonomy facets — single-select, sourced from the URL like the
    // others. Mega-menu deep links land here pre-filtered (?fabric=&sleeve=).
    const [selectedFabric, setSelectedFabric] = useState<string | null>(searchParams.get("fabric"));
    const [selectedSleeve, setSelectedSleeve] = useState<string | null>(searchParams.get("sleeve"));
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
        fabric: true,
        sleeve: true,
    });
    const LOAD_MORE_COUNT = 12;

    // Lock body scroll + listen for Escape while the mobile filter
    // drawer is open. Mirrors the CartDrawer pattern — without it the
    // page scrolls under the modal and there's no keyboard escape.
    useEffect(() => {
        if (!isFilterOpen) return;
        document.body.style.overflow = "hidden";
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsFilterOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handler);
        };
    }, [isFilterOpen]);

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

    // Keep selectedCategories aligned with the path when navigating between
    // sibling subcategories client-side (e.g. /shop/sport/longsleeve →
    // /shop/sport/shorts). The route component is reused, so without this
    // effect the sidebar would stay stuck on the previous subcategory.
    // We also reset size/color/price filters — they're scoped to the
    // previous subcategory's stock and would silently filter out everything
    // if they happen not to apply to the new sub.
    useEffect(() => {
        if (pathSubcategory && !selectedCategories.includes(pathSubcategory)) {
            setSelectedCategories([pathSubcategory]);
            setSelectedSizes([]);
            setSelectedColors([]);
            setSelectedPriceRange(null);
        }
    }, [pathSubcategory]);

    // Honour fabric/sleeve coming FROM the URL — e.g. a deep mega-menu link
    // (/shop/yoga/jumpsuit?fabric=sport) clicked while already on a shop page,
    // where the component is reused and mount-time init doesn't re-run.
    // One-way URL→state; the no-op-when-equal guard stops it looping with the
    // state→URL sync below (which only writes when the string actually changes).
    useEffect(() => {
        const f = searchParams.get("fabric");
        const s = searchParams.get("sleeve");
        setSelectedFabric((prev) => (prev === f ? prev : f));
        setSelectedSleeve((prev) => (prev === s ? prev : s));
    }, [searchParams]);

    const navigate = useNavigate();

    // Sync state changes to URL Params
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams);

        // Remove old generic cat
        if (newParams.has("cat")) newParams.delete("cat");

        // When on the nested /shop/cat/sub route and the user un-checks
        // the only selected filter, we're effectively saying "show me the
        // whole shop again" — navigate up to the parent so the loader can
        // fetch the unfiltered set instead of leaving us on a 0-product
        // subcategory page.
        if (pathSubcategory && selectedCategories.length === 0) {
            navigate(lp(`/shop/${category}`), { replace: true, preventScrollReset: true });
            return;
        }

        // When on the nested /shop/cat/sub route and the only selected
        // filter matches the path subcategory, don't echo it into a
        // ?categories= query — that would clutter what is otherwise a
        // clean canonical URL.
        const isPathOnlyFilter =
            pathSubcategory &&
            selectedCategories.length === 1 &&
            selectedCategories[0] === pathSubcategory;
        if (selectedCategories.length > 0 && !isPathOnlyFilter)
            newParams.set("categories", selectedCategories.join(","));
        else newParams.delete("categories");

        if (selectedSizes.length > 0) newParams.set("sizes", selectedSizes.join(","));
        else newParams.delete("sizes");

        if (selectedColors.length > 0) newParams.set("colors", selectedColors.join(","));
        else newParams.delete("colors");

        if (selectedFabric) newParams.set("fabric", selectedFabric);
        else newParams.delete("fabric");

        if (selectedSleeve) newParams.set("sleeve", selectedSleeve);
        else newParams.delete("sleeve");

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
        selectedFabric,
        selectedSleeve,
        selectedPriceRange,
        sortBy,
        searchParams,
        setSearchParams,
    ]);

    const toggleSection = (
        section: "category" | "size" | "color" | "price" | "fabric" | "sleeve",
    ) => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Use DB data, else fall back to the taxonomy labels (shop-pages.ts) so
    // every real slug (yoga/sport/dance/casual/kids/yogatools) shows a correct
    // hero title — not the legacy women/kids "Жіноча" default.
    const fallbackLabels = shopPageLabel(category);
    const prefixLabel = shopPage?.prefixLabel || t(fallbackLabels.tagline) || "For active life";
    const mainLabel = shopPage?.title || t(fallbackLabels.title);
    const layerLabel = "MIND BODY";

    // Parse Image Position. Default = "50% 30%" (face-safe crop for
    // figure-of-woman product photography).
    //
    // Admin UI defaults newly-created shop pages to "50% 50% 1" (centered),
    // which slices through the model's torso on portrait shots. Treat that
    // exact admin-default as "not customized" and substitute face-safe.
    // Only honour DB values where an admin actually adjusted the position.
    const imagePosStyle = useMemo(() => {
        const defaultX = "50%";
        // 22% = roughly upper-quarter, keeps face fully visible on
        // portrait product shots even when the hero band is short.
        const defaultY = "22%";
        const raw = shopPage?.heroImagePos?.trim() || "";
        const isAdminDefault = raw === "50% 50% 1" || raw === "50% 50%" || raw === "";

        if (isAdminDefault) {
            return {
                objectPosition: `${defaultX} ${defaultY}`,
                transformOrigin: `${defaultX} ${defaultY}`,
            };
        }
        const parts = raw.split(" ");
        const x = parts[0] || defaultX;
        const y = parts[1] || defaultY;
        const scale = parseFloat(parts[2]) || 1;
        return {
            objectPosition: `${x} ${y}`,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: `${x} ${y}`,
        };
    }, [shopPage]);

    // Are we inside the visual-editor iframe? Computed AFTER mount (not during
    // render) so SSR and the first client render agree (both false) — otherwise
    // the editor preview hydration-mismatches on the admin edit button below.
    // Real visitors are never in an iframe, so this stays false for them.
    // ?editor=1 + iframe check live in the shared bridge (editor-bridge.ts).
    const editorMode = useEditorMode();

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
        if (selectedFabric) {
            result = result.filter((p) => p.fabric === selectedFabric);
        }
        if (selectedSleeve) {
            result = result.filter((p) => p.sleeve === selectedSleeve);
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
        selectedFabric,
        selectedSleeve,
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
        setSelectedFabric(null);
        setSelectedSleeve(null);
        setSelectedPriceRange(null);
        setDisplayCount(12);
    };

    // Fabric/sleeve options available for THIS shop section (taxonomy union).
    // Empty for casual/dance/yogatools → those accordions never render.
    const fabricOptions = useMemo(() => fabricsForShop(category), [category]);
    const sleeveOptions = useMemo(() => sleevesForShop(category), [category]);

    // Price-range radio labels: the admin-set Ukrainian label is canonical
    // for uk; en/ru rebuild the bounds through money() so the displayed
    // currency matches the locale. Filter math stays in UAH (range.min/max).
    const priceRangeLabel = (range: PriceRange) => {
        if (locale === "uk") return range.label;
        if (range.min <= 0) return t("До {max}", { max: money(range.max) });
        if (range.max >= 999999) return t("Від {min}", { min: money(range.min) });
        return `${money(range.min)} - ${money(range.max)}`;
    };

    // Single-select accordion for a deeper facet (fabric | sleeve), shared by
    // the sidebar and the mobile drawer. Options with zero matching products
    // are hidden; the whole section disappears when nothing matches — mirrors
    // the size/color behaviour. `idPrefix` keeps radio groups unique per host.
    const renderFacetFilter = (
        title: string,
        sectionKey: "fabric" | "sleeve",
        options: string[],
        selected: string | null,
        setSelected: (v: string | null) => void,
        labelFn: (s: string) => string,
        idPrefix: string,
    ) => {
        const withCounts = options
            .map((o) => ({
                o,
                count: products.filter((p) => (sectionKey === "fabric" ? p.fabric : p.sleeve) === o)
                    .length,
            }))
            .filter((x) => x.count > 0);
        if (withCounts.length === 0) return null;
        const name = `${idPrefix}-${sectionKey}`;
        return (
            <div className={`filter-accordion ${openSections[sectionKey] ? "active" : ""}`}>
                <button
                    type="button"
                    className="accordion-trigger"
                    aria-expanded={openSections[sectionKey]}
                    onClick={() => toggleSection(sectionKey)}
                >
                    <span>{title}</span>
                    <span className="icon">{openSections[sectionKey] ? "−" : "+"}</span>
                </button>
                <div className="accordion-content">
                    <div className="filter-checkbox-list">
                        <label className="mb-checkbox-item">
                            <input
                                type="radio"
                                name={name}
                                checked={!selected}
                                onChange={() => {
                                    setSelected(null);
                                    setDisplayCount(12);
                                }}
                            />
                            <span className="checkbox-visual radio"></span>
                            <span className="label-text">{t("Усі")}</span>
                        </label>
                        {withCounts.map(({ o, count }) => (
                            <label key={`${name}-${o}`} className="mb-checkbox-item">
                                <input
                                    type="radio"
                                    name={name}
                                    checked={selected === o}
                                    onChange={() => {
                                        setSelected(o);
                                        setDisplayCount(12);
                                    }}
                                />
                                <span className="checkbox-visual radio"></span>
                                <span className="label-text">
                                    {t(labelFn(o))}
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
                        ))}
                    </div>
                </div>
            </div>
        );
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
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 0,
                            /* Batch 40 atom 8: LQIP blur-up on the shop
                               hero so the band never opens blank during
                               the hero image decode. */
                            ...getLqipStyle(shopPage.heroImage),
                        }}
                    >
                        <picture>
                            {/* Batch 40 atom 6: AVIF first for premium
                                quality + smaller wire bytes. */}
                            <source
                                srcSet={buildAvifSrcset(shopPage.heroImage)}
                                sizes="100vw"
                                type="image/avif"
                            />
                            <source
                                srcSet={buildWebpSrcset(shopPage.heroImage)}
                                sizes="100vw"
                                type="image/webp"
                            />
                            <img
                                src={shopPage.heroImage}
                                alt="Background"
                                fetchPriority="high"
                                decoding="async"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    ...imagePosStyle,
                                }}
                            />
                        </picture>
                        {/* Overlay to ensure text readability — WCAG AA contrast.
                            Gradient is darker at bottom where the YOGA title sits
                            but stays lighter at top to keep the product hero visible. */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                    "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 100%)",
                            }}
                        ></div>
                    </div>
                )}

                {/* Admin Edit Button - Centered */}
                {editorMode && (
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
                            data-editor-affordance
                            onClick={(e) => {
                                e.preventDefault();
                                postToEditor({
                                    type: "OPEN_SHOP_BG_EDITOR",
                                    category: category, // real shop slug (yoga/sport/…)
                                });
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
                            {t("Змінити фон")}
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
                            <LLink to="/">{t("Головна")}</LLink>
                            <span>/</span>
                            <span>{t("Магазин")}</span>
                        </nav>

                        <div className="hero-composition">
                            {/* Left side: Main title block */}
                            <div className="hero-title-block">
                                <h1 className="luxe-title">
                                    <span className="luxe-title__main">{mainLabel}</span>
                                    <span className="luxe-title__sub">{t("колекція")}</span>
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
                    aria-label={t("Відкрити фільтри")}
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
                    {t("ФІЛЬТРИ")}
                    {selectedCategories.length +
                        selectedSizes.length +
                        selectedColors.length +
                        (selectedFabric ? 1 : 0) +
                        (selectedSleeve ? 1 : 0) +
                        (selectedPriceRange ? 1 : 0) >
                        0 && (
                        <span className="mobile-filter-badge">
                            {selectedCategories.length +
                                selectedSizes.length +
                                selectedColors.length +
                                (selectedFabric ? 1 : 0) +
                                (selectedSleeve ? 1 : 0) +
                                (selectedPriceRange ? 1 : 0)}
                        </span>
                    )}
                </button>
                <div className="mobile-product-count">
                    {filteredProducts.length}{" "}
                    {plural(locale, filteredProducts.length, "товар", "товари", "товарів")}
                </div>
            </div>

            {/* Mobile Filter Drawer Overlay */}
            {isFilterOpen && (
                <div className="filter-drawer-overlay" onClick={() => setIsFilterOpen(false)}>
                    <div className="filter-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="filter-drawer__header">
                            <span>{t("ФІЛЬТРИ")}</span>
                            <button
                                className="filter-drawer__close"
                                onClick={() => setIsFilterOpen(false)}
                                aria-label={t("Закрити")}
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
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.category}
                                    onClick={() => toggleSection("category")}
                                >
                                    <span>{t("КАТЕГОРІЯ")}</span>
                                    <span className="icon">
                                        {openSections.category ? "−" : "+"}
                                    </span>
                                </button>
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
                                                        {t(categoryLabels[cat] || cat)}{" "}
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
                            {renderFacetFilter(
                                t("ТКАНИНА"),
                                "fabric",
                                fabricOptions,
                                selectedFabric,
                                setSelectedFabric,
                                fabricLabel,
                                "d",
                            )}
                            {renderFacetFilter(
                                t("РУКАВ"),
                                "sleeve",
                                sleeveOptions,
                                selectedSleeve,
                                setSelectedSleeve,
                                sleeveLabel,
                                "d",
                            )}
                            <div className="filter-accordion active">
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.size}
                                    onClick={() => toggleSection("size")}
                                >
                                    <span>{t("РОЗМІР")}</span>
                                    <span className="icon">{openSections.size ? "−" : "+"}</span>
                                </button>
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
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.color}
                                    onClick={() => toggleSection("color")}
                                >
                                    <span>{t("КОЛІР")}</span>
                                    <span className="icon">{openSections.color ? "−" : "+"}</span>
                                </button>
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
                                                    aria-label={t(colorLabels[color] || color)}
                                                    aria-pressed={selectedColors.includes(color)}
                                                    title={t(colorLabels[color] || color)}
                                                >
                                                    <span className="swatch-check">✓</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="filter-accordion active">
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.price}
                                    onClick={() => toggleSection("price")}
                                >
                                    <span>{t("ЦІНА")}</span>
                                    <span className="icon">{openSections.price ? "−" : "+"}</span>
                                </button>
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
                                                <span className="label-text">
                                                    {priceRangeLabel(range)}
                                                </span>
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
                                selectedFabric ||
                                selectedSleeve ||
                                selectedPriceRange) && (
                                <button
                                    onClick={() => {
                                        clearFilters();
                                    }}
                                    className="filter-drawer__reset"
                                >
                                    {t("Скинути фільтри")}
                                </button>
                            )}
                            <button
                                onClick={() => setIsFilterOpen(false)}
                                className="filter-drawer__apply"
                            >
                                {t("Показати")} {filteredProducts.length}{" "}
                                {plural(
                                    locale,
                                    filteredProducts.length,
                                    "товар",
                                    "товари",
                                    "товарів",
                                )}
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
                                <h3>{t("ФІЛЬТРИ")}</h3>
                            </div>

                            {/* Category Accordion */}
                            <div
                                className={`filter-accordion ${openSections.category ? "active" : ""}`}
                            >
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.category}
                                    onClick={() => toggleSection("category")}
                                >
                                    <span>{t("КАТЕГОРІЯ")}</span>
                                    <span className="icon">
                                        {openSections.category ? "−" : "+"}
                                    </span>
                                </button>
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
                                                        {t(categoryLabels[cat] || cat)}
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

                            {renderFacetFilter(
                                t("ТКАНИНА"),
                                "fabric",
                                fabricOptions,
                                selectedFabric,
                                setSelectedFabric,
                                fabricLabel,
                                "s",
                            )}
                            {renderFacetFilter(
                                t("РУКАВ"),
                                "sleeve",
                                sleeveOptions,
                                selectedSleeve,
                                setSelectedSleeve,
                                sleeveLabel,
                                "s",
                            )}

                            {/* Size Accordion */}
                            <div
                                className={`filter-accordion ${openSections.size ? "active" : ""}`}
                            >
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.size}
                                    onClick={() => toggleSection("size")}
                                >
                                    <span>{t("РОЗМІР")}</span>
                                    <span className="icon">{openSections.size ? "−" : "+"}</span>
                                </button>
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
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.color}
                                    onClick={() => toggleSection("color")}
                                >
                                    <span>{t("КОЛІР")}</span>
                                    <span className="icon">{openSections.color ? "−" : "+"}</span>
                                </button>
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
                                                    aria-label={t(colorLabels[color] || color)}
                                                    aria-pressed={selectedColors.includes(color)}
                                                    title={t(colorLabels[color] || color)}
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
                                <button
                                    type="button"
                                    className="accordion-trigger"
                                    aria-expanded={openSections.price}
                                    onClick={() => toggleSection("price")}
                                >
                                    <span>{t("ЦІНА")}</span>
                                    <span className="icon">{openSections.price ? "−" : "+"}</span>
                                </button>
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
                                                <span className="label-text">
                                                    {priceRangeLabel(range)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {(selectedCategories.length > 0 ||
                                selectedSizes.length > 0 ||
                                selectedColors.length > 0 ||
                                selectedFabric ||
                                selectedSleeve ||
                                selectedPriceRange) && (
                                <button onClick={clearFilters} className="mb-reset-filters">
                                    {t("Скинути всі фільтри")}
                                </button>
                            )}
                        </aside>

                        {/* Shop Content Area */}
                        <main className="mb-shop-content">
                            {/* MB sorting Toolbar */}
                            <div className="mb-toolbar">
                                <div className="toolbar-top-row">
                                    <div className="sort-label">{t("СОРТУВАТИ ЗА:")}</div>
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
                                                {t(option.label)}
                                                {sortBy === option.id && (
                                                    <span className="close-x">✕</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="product-count">
                                        {visibleProducts.length < filteredProducts.length
                                            ? t("{shown} з {total} ТОВАРІВ", {
                                                  shown: visibleProducts.length,
                                                  total: filteredProducts.length,
                                              })
                                            : t("{n} ТОВАРІВ", { n: filteredProducts.length })}
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
                                                <ProductCard product={product} priority={idx < 4} />
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
                                                {t("Показати ще ({n})", {
                                                    n: Math.min(
                                                        LOAD_MORE_COUNT,
                                                        filteredProducts.length - displayCount,
                                                    ),
                                                })}
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
                                        <h2>{t("Ми не знайшли збігів за вашим запитом")}</h2>
                                        <p>
                                            {t(
                                                "Спробуйте змінити технічні параметри або скинути всі фільтри.",
                                            )}
                                        </p>
                                        <button onClick={clearFilters} className="luxe-btn-primary">
                                            {t("Скинути всі налаштування")}
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
