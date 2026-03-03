import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
// import { ApiService } from "../utils/api";
import ProductCard from "../components/ProductCard";
import { useState, useMemo } from "react";
import { prisma } from "../db.server";

export function meta({ data }: { data: any }) {
    const shopPage = data?.shopPage;
    const slug = data?.categorySlug || 'women';
    const titles: Record<string, string> = {
        women: 'Жіноча колекція',
        kids: 'Дитяча колекція',
    };
    const title = shopPage?.title || titles[slug] || 'Каталог';
    return [
        { title: `${title} | MIND BODY` },
        { name: "description", content: `${title} спортивного одягу MIND BODY. Йога, гімнастика, акробатика. Українське виробництво.` },
        { property: "og:title", content: `${title} | MIND BODY` },
        { property: "og:type", content: "website" },
    ];
}

export async function loader({ params }: LoaderFunctionArgs) {
    const categorySlug = params.category || "women";

    // 1. Fetch FilterConfig (Safe Raw SQL)
    let filterConfig = null;
    try {
        const configResult: any[] = await prisma.$queryRawUnsafe(`SELECT config FROM FilterConfig WHERE id = 'global' LIMIT 1`);
        if (configResult[0]?.config) {
            filterConfig = JSON.parse(configResult[0].config);
        }
    } catch (e) {
        console.error("FilterConfig fetch failed", e);
    }

    // 2. Fetch ShopPage
    let shopPage = null;
    try {
        shopPage = await prisma.shopPage.findUnique({ where: { slug: categorySlug } });
    } catch (e) { console.error("ShopPage fetch failed", e); }

    // 3. Fetch Products (Raw SQL with Fallback)
    let products: any[] = [];
    try {
        // Try selecting with shopPageSlug
        const rawProducts: any[] = await prisma.$queryRawUnsafe(
            `SELECT * FROM Product WHERE shopPageSlug = ? ORDER BY createdAt DESC`,
            categorySlug
        );
        products = rawProducts;
    } catch (e: any) {
        console.warn("Product fetch with shopPageSlug failed, trying fallback:", e.message);
        try {
            // Fallback: Fetch all and filter (or show all if we can't filter)
            // Ideally we just want to show something rather than crashing
            const rawProducts: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM Product ORDER BY createdAt DESC`);
            products = rawProducts;
        } catch (e2) {
            console.error("Critical: Product fetch failed completely", e2);
            products = [];
        }
    }

    // Map Raw DB Objects to Frontend Props
    const mappedProducts = products.map((p: any) => {
        const parseJson = (str: string, fallback: any) => {
            if (!str) return fallback;
            try { return JSON.parse(str); } catch { return fallback; }
        };

        const images = parseJson(p.images, []);
        return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: Number(p.price),
            comparePrice: Number(p.comparePrice),
            image: images[0] || '/brand-sun.png', // Fallback to brand icon
            images: images,
            category: p.category,
            colors: parseJson(p.colors, []),
            sizes: parseJson(p.sizes, []),
            is_new: p.status === 'active',
            is_sale: Number(p.comparePrice) > Number(p.price),
            status: p.status
        };
    });

    return { products: mappedProducts, category: categorySlug, shopPage, filterConfig };
}

export default function ShopCategory() {
    const { products, category, shopPage, filterConfig } = useLoaderData<typeof loader>();

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState("default");
    const [displayCount, setDisplayCount] = useState(12);
    const [openSections, setOpenSections] = useState({
        category: true,
        size: true,
        color: true,
        price: true
    });
    const LOAD_MORE_COUNT = 12;

    const toggleSection = (section: 'category' | 'size' | 'color' | 'price') => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Use DB data or basic defaults
    const prefixLabel = shopPage?.prefixLabel || (category === "kids" ? "For little stars" : "For active life");
    const mainLabel = shopPage?.title || (category === "kids" ? "Діти" : "Жіноча");
    const layerLabel = "MIND BODY";

    // Parse Image Position
    const imagePosStyle = useMemo(() => {
        if (!shopPage?.heroImagePos) return {};
        const parts = shopPage.heroImagePos.split(' ');
        const x = parts[0] || "50%";
        const y = parts[1] || "50%";
        const scale = parseFloat(parts[2]) || 1;
        return {
            objectPosition: `${x} ${y}`,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: `${x} ${y}`
        };
    }, [shopPage]);

    // Check if we are inside an iframe (visual editor mode)
    const isIframe = typeof window !== 'undefined' && window.parent !== window;

    const dynamicFilters = useMemo(() => {
        if (!filterConfig?.config) return null;
        try {
            return JSON.parse(filterConfig.config);
        } catch (e) {
            return null;
        }
    }, [filterConfig]);

    const categories = useMemo(() => {
        // Use keys from dynamic configuration if available
        if (dynamicFilters?.categories) {
            return Object.keys(dynamicFilters.categories);
        }
        // Fallback to product-based categories
        const cats = new Set<string>();
        products.forEach((p: any) => { if (p.category) cats.add(p.category); });
        return Array.from(cats);
    }, [products, dynamicFilters]);

    const sizes = useMemo(() => {
        // Use sizes from dynamic configuration if available
        if (dynamicFilters?.sizes && dynamicFilters.sizes.length > 0) {
            return [...dynamicFilters.sizes].sort((a, b) => {
                const aNum = parseInt(a);
                const bNum = parseInt(b);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return a.localeCompare(b);
            });
        }
        // Fallback to product-based sizes
        const s = new Set<string>();
        products.forEach((p: any) => { if (p.sizes) p.sizes.forEach((size: string) => s.add(size)); });
        return Array.from(s).sort((a, b) => {
            const aNum = parseInt(a);
            const bNum = parseInt(b);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b);
        });
    }, [products, dynamicFilters]);

    const colors = useMemo(() => {
        // Use keys from dynamic configuration if available
        if (dynamicFilters?.colors) {
            return Object.keys(dynamicFilters.colors);
        }
        // Fallback to product-based colors
        const c = new Set<string>();
        products.forEach((p: any) => { if (p.colors) p.colors.forEach((color: string) => c.add(color)); });
        return Array.from(c);
    }, [products, dynamicFilters]);

    const priceRanges = dynamicFilters?.priceRanges || [
        { id: 'low', label: 'До 1000 ₴', min: 0, max: 1000 },
        { id: 'mid', label: '1000 - 3000 ₴', min: 1000, max: 3000 },
        { id: 'high', label: '3000 - 5000 ₴', min: 3000, max: 5000 },
        { id: 'premium', label: 'Від 5000 ₴', min: 5000, max: Infinity }
    ];

    const categoryLabels: Record<string, string> = dynamicFilters?.categories || {
        "jumpsuit": "Комбінезони",
        "leggings": "Легінси",
        "tops": "Топи",
        "shorts": "Шорти",
        "jackets": "Куртки",
        "sets": "Комплекти"
    };

    const colorLabels: Record<string, string> = dynamicFilters?.colors || {
        'black': 'Чорний',
        'white': 'Білий',
        'blue': 'Синій',
        'pink': 'Рожевий',
        'green': 'Зелений',
        'gray': 'Сірий',
        'red': 'Червоний',
        'other': 'Інші'
    };

    const filteredProducts = useMemo(() => {
        let result = [...products];
        if (selectedCategories.length > 0) {
            result = result.filter((p: any) => selectedCategories.includes(p.category));
        }
        if (selectedSizes.length > 0) {
            result = result.filter((p: any) => p.sizes?.some((s: string) => selectedSizes.includes(s)));
        }
        if (selectedColors.length > 0) {
            result = result.filter((p: any) => p.colors?.some((c: string) => selectedColors.includes(c)));
        }
        if (selectedPriceRange) {
            const range = priceRanges.find((r: any) => r.id === selectedPriceRange);
            if (range) {
                result = result.filter((p: any) => p.price >= range.min && p.price <= range.max);
            }
        }
        switch (sortBy) {
            case "price-asc": result.sort((a, b) => a.price - b.price); break;
            case "price-desc": result.sort((a, b) => b.price - a.price); break;
            case "newest": break;
        }
        return result;
    }, [products, selectedCategories, selectedSizes, selectedColors, selectedPriceRange, sortBy, priceRanges]);

    const visibleProducts = filteredProducts.slice(0, displayCount);
    const hasMore = displayCount < filteredProducts.length;

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
        setDisplayCount(12);
    };

    const toggleSize = (size: string) => {
        setSelectedSizes(prev =>
            prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
        );
        setDisplayCount(12);
    };

    const toggleColor = (color: string) => {
        setSelectedColors(prev =>
            prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
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
            <section className="shop-hero-luxe" style={{ background: shopPage?.heroImage ? 'none' : undefined }}>
                {/* Dynamic Background Image */}
                {shopPage?.heroImage && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                        <img
                            src={shopPage.heroImage}
                            alt="Background"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                ...imagePosStyle
                            }}
                        />
                        {/* Overlay to ensure text readability */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}></div>
                    </div>
                )}

                {/* Admin Edit Button - Centered */}
                {isIframe && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 100,
                        border: '2px dashed rgba(255,255,255,0.3)',
                        padding: '20px',
                        borderRadius: '12px',
                        textAlign: 'center'
                    }}>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                window.parent.postMessage({
                                    type: 'OPEN_SHOP_BG_EDITOR',
                                    category: category // 'women', 'kids', etc.
                                }, '*');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'white',
                                color: 'black',
                                padding: '12px 24px',
                                borderRadius: '30px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: '13px',
                                letterSpacing: '1px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                transition: 'transform 0.2s',
                                cursor: 'pointer',
                                border: 'none'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Змінити фон
                        </button>
                    </div>
                )}

                <div className="shop-hero-luxe__drift"></div>
                <div className="shop-hero-luxe__background" style={{ opacity: shopPage?.heroImage ? 0.3 : 1 }}>
                    <span className="stroke-text">{layerLabel}</span>
                </div>
                <div className="container" style={{ position: 'relative', zIndex: 1 }}>
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

            <div className="shop-main-layout">
                <div className="container">
                    <div className="luxe-grid">
                        {/* MIND BODY x Puma Hybrid Sidebar */}
                        <aside className="mb-shop-sidebar">
                            <div className="sidebar-header">
                                <h3>ФІЛЬТРИ</h3>
                            </div>

                            {/* Category Accordion */}
                            <div className={`filter-accordion ${openSections.category ? 'active' : ''}`}>
                                <div className="accordion-trigger" onClick={() => toggleSection('category')}>
                                    <span>КАТЕГОРІЯ</span>
                                    <span className="icon">{openSections.category ? '−' : '+'}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="filter-checkbox-list">
                                        {categories.map(cat => {
                                            const count = products.filter((p: any) => p.category === cat).length;
                                            return (
                                                <label key={cat} className="mb-checkbox-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCategories.includes(cat)}
                                                        onChange={() => toggleCategory(cat)}
                                                    />
                                                    <span className="checkbox-visual"></span>
                                                    <span className="label-text">
                                                        {categoryLabels[cat] || cat}
                                                        <span style={{ marginLeft: '6px', opacity: 0.4, fontSize: '11px' }}>({count})</span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Size Accordion */}
                            <div className={`filter-accordion ${openSections.size ? 'active' : ''}`}>
                                <div className="accordion-trigger" onClick={() => toggleSection('size')}>
                                    <span>РОЗМІР</span>
                                    <span className="icon">{openSections.size ? '−' : '+'}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="mb-size-grid">
                                        {sizes.map(size => (
                                            <button
                                                key={size}
                                                className={`mb-size-chip ${selectedSizes.includes(size) ? 'active' : ''}`}
                                                onClick={() => toggleSize(size)}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Color Accordion */}
                            <div className={`filter-accordion ${openSections.color ? 'active' : ''}`}>
                                <div className="accordion-trigger" onClick={() => toggleSection('color')}>
                                    <span>КОЛІР</span>
                                    <span className="icon">{openSections.color ? '−' : '+'}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="mb-color-grid">
                                        {colors.map(color => (
                                            <button
                                                key={color}
                                                className={`mb-color-swatch ${color} ${selectedColors.includes(color) ? 'active' : ''}`}
                                                onClick={() => toggleColor(color)}
                                                title={colorLabels[color]}
                                            >
                                                <span className="swatch-check">✓</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Price Accordion */}
                            <div className={`filter-accordion ${openSections.price ? 'active' : ''}`}>
                                <div className="accordion-trigger" onClick={() => toggleSection('price')}>
                                    <span>ЦІНА</span>
                                    <span className="icon">{openSections.price ? '−' : '+'}</span>
                                </div>
                                <div className="accordion-content">
                                    <div className="filter-checkbox-list">
                                        {priceRanges.map((range: any) => (
                                            <label key={range.id} className="mb-checkbox-item">
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

                            {(selectedCategories.length > 0 || selectedSizes.length > 0 || selectedColors.length > 0 || selectedPriceRange) && (
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
                                            { id: 'default', label: 'За релевантністю' },
                                            { id: 'price-asc', label: 'Ціна: за зростанням' },
                                            { id: 'price-desc', label: 'Ціна: за зменшенням' },
                                            { id: 'newest', label: 'Новинки' }
                                        ].map(option => (
                                            <button
                                                key={option.id}
                                                className={`sort-chip ${sortBy === option.id ? 'active' : ''}`}
                                                onClick={() => setSortBy(option.id)}
                                            >
                                                {option.label}
                                                {sortBy === option.id && <span className="close-x">✕</span>}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="product-count">
                                        {visibleProducts.length < filteredProducts.length
                                            ? `${visibleProducts.length} з ${filteredProducts.length} ТОВАРІВ`
                                            : `${filteredProducts.length} ТОВАРІВ`
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* Luxe Grid */}
                            {visibleProducts.length > 0 ? (
                                <>
                                    <div className="luxe-product-grid">
                                        {visibleProducts.map((product) => (
                                            <div key={product.id} className="luxe-card-wrapper">
                                                <ProductCard product={product} />
                                            </div>
                                        ))}
                                    </div>

                                    {hasMore && (
                                        <div className="load-more-wrap">
                                            <button
                                                className="load-more-btn"
                                                onClick={() => setDisplayCount(prev => prev + LOAD_MORE_COUNT)}
                                            >
                                                Показати ще ({Math.min(LOAD_MORE_COUNT, filteredProducts.length - displayCount)})
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
                                        <p>Спробуйте змінити технічні параметри або скинути всі фільтри.</p>
                                        <button onClick={clearFilters} className="luxe-btn-primary">Скинути всі налаштування</button>
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
