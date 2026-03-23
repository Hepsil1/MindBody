
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../components/Toast";
import { prisma } from "../db.server";
import { StorageUtils } from "../utils/storage";
import productStyles from "../styles/product-page.css?url";

export function links() {
    return [{ rel: "stylesheet", href: productStyles }];
}

export function meta({ data }: { data: any }) {
    const product = data?.product;
    if (!product) {
        return [{ title: "Товар не знайдено | MIND BODY" }];
    }
    const desc = (product.description || `${product.name} — купити в MIND BODY`).substring(0, 160);
    const image = product.images?.[0] || '/brand-sun.png';
    const price = Number(product.price) || 0;
    return [
        { title: `${product.name} | MIND BODY` },
        { name: "description", content: desc },
        // Open Graph
        { property: "og:title", content: product.name },
        { property: "og:description", content: desc },
        { property: "og:image", content: image },
        { property: "og:type", content: "product" },
        { property: "product:price:amount", content: String(price) },
        { property: "product:price:currency", content: "UAH" },
        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: product.name },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
    ];
}

// --- Types ---
interface FilterConfigData {
    colors: Record<string, string>;
}

const COLOR_MAP: Record<string, string> = {
    'black': '#1a1a1a',
    'white': '#ffffff',
    'blue': '#3b82f6',
    'pink': '#ec4899',
    'green': '#22c55e',
    'gray': '#6b7280',
    'red': '#ef4444',
    'purple': '#a855f7',
    'yellow': '#eab308',
    'orange': '#f97316',
    'teal': '#14b8a6',
    'brown': '#78350f',
    'navy': '#1e3a8a',
    'beige': '#f5f5dc',
    'marsala': '#722F37'
};

export async function loader({ params }: LoaderFunctionArgs) {
    const id = params.id;
    let product: any = null;
    let filterConfig: FilterConfigData | null = null;
    let relatedProducts: any[] = [];

    try {
        // Run product + filterConfig queries in parallel
        const [productResult, configResult] = await Promise.all([
            prisma.$queryRawUnsafe(
                `SELECT id, name, description, price, "comparePrice", category, images, colors, sizes, inventory, status, "shopPageSlug", "createdAt"
                 FROM "Product" WHERE id = $1`, id
            ) as Promise<any[]>,
            prisma.$queryRawUnsafe(
                `SELECT id, config FROM "FilterConfig" WHERE id = 'global'`
            ) as Promise<any[]>
        ]);

        if (productResult[0]) {
            const p = productResult[0];
            const parseJson = (str: string, fallback: any) => {
                try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
            };

            const images = parseJson(p.images, []);
            if (images.length === 0) images.push('/brand-sun.png');

            // Parse inventory to extract available variants
            const inventory = parseJson(p.inventory, []);

            // Extract available colors and sizes from inventory (only in-stock items)
            const availableColors = new Set<string>();
            const availableSizes = new Set<string>();
            for (const item of inventory) {
                if (item.stock > 0) {
                    if (item.color) availableColors.add(item.color);
                    if (item.size) availableSizes.add(item.size);
                }
            }

            const price = Number(p.price);
            const comparePrice = Number(p.comparePrice) || 0;
            const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
            const isNew = (Date.now() - createdAt) < 14 * 24 * 60 * 60 * 1000;

            product = {
                id: p.id,
                name: p.name,
                description: p.description,
                price: price,
                comparePrice: comparePrice,
                images: images,
                category: p.category,
                shopPageSlug: p.shopPageSlug,
                colors: availableColors.size > 0 ? Array.from(availableColors) : parseJson(p.colors, []),
                sizes: availableSizes.size > 0 ? Array.from(availableSizes) : parseJson(p.sizes, []),
                inventory: inventory,
                status: p.status,
                is_new: isNew,
                is_sale: comparePrice > price && price > 0,
                discount_percent: comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0
            };

            const relatedResult: any[] = await prisma.$queryRawUnsafe(
                `SELECT id, name, price, images FROM "Product" WHERE category = $1 AND id != $2 LIMIT 4`,
                p.category, p.id
            );

            relatedProducts = relatedResult.map(rp => ({
                id: rp.id,
                name: rp.name,
                price: Number(rp.price),
                image: parseJson(rp.images, ['/brand-sun.png'])[0]
            }));
        }

        // configResult already fetched in parallel above
        const globalConfig = configResult.find((c: any) => c.id === 'global');
        if (globalConfig?.config) {
            try { filterConfig = JSON.parse(globalConfig.config); } catch {}
        }

    } catch (e) {
        console.error("Product Loader Error:", e);
        throw new Response("Server Error", { status: 500 });
    }

    if (!product) {
        throw new Response("Not Found", { status: 404 });
    }

    return { product, filterConfig, relatedProducts };
}

// ===== REVIEWS SECTION COMPONENT =====
function ReviewsSection({ productId }: { productId: string }) {
    const { showToast } = useToast();
    const [reviews, setReviews] = useState<any[]>([]);
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formText, setFormText] = useState('');
    const [formRating, setFormRating] = useState(5);
    const [submitting, setSubmitting] = useState(false);

    const fetchReviews = useCallback(async () => {
        try {
            const res = await fetch(`/api/reviews?productId=${productId}`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data.reviews || []);
                setAvg(data.avg || 0);
                setCount(data.count || 0);
            }
        } catch { /* silent */ }
    }, [productId]);

    useEffect(() => { fetchReviews(); }, [fetchReviews]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim() || !formText.trim()) {
            showToast('Будь ласка, заповніть всі поля', 'error');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId,
                    authorName: formName.trim(),
                    rating: formRating,
                    text: formText.trim()
                })
            });
            if (res.ok) {
                const data = await res.json();
                showToast(data.message || 'Дякуємо за ваш відгук! ✨');
                setFormName('');
                setFormText('');
                setFormRating(5);
                setShowForm(false);
                // Don't refetch — review is pending moderation and won't appear yet
            } else {
                const data = await res.json().catch(() => null);
                showToast(data?.error || 'Помилка при збереженні', 'error');
            }
        } catch {
            showToast('Помилка з\'єднання', 'error');
        }
        setSubmitting(false);
    };

    const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return dateStr; }
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

            {reviews.length > 0 ? (
                <div className="reviews-list">
                    {reviews.map((r: any) => (
                        <div key={r.id} className="review-card">
                            <div className="review-card__header">
                                <div className="review-card__author">
                                    <div className="review-card__avatar">{getInitials(r.authorName)}</div>
                                    <div>
                                        <div className="review-card__name">{r.authorName}</div>
                                        <div className="review-card__date">{formatDate(r.createdAt)}</div>
                                    </div>
                                </div>
                                <div className="review-card__stars">{renderStars(r.rating)}</div>
                            </div>
                            <p className="review-card__text">{r.text}</p>
                            {r.isVerified && (
                                <span className="review-card__verified">✓ Підтверджена покупка</span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="reviews-empty">
                    Поки що немає відгуків. Будьте першими! ✨
                </p>
            )}

            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    className="review-write-btn"
                >
                    Написати відгук
                </button>
            ) : (
                <form className="review-form" onSubmit={handleSubmit}>
                    <h4>Залишити відгук</h4>

                    <div className="review-form__field">
                        <label>Оцінка</label>
                        <div className="review-form__stars-input">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    className={n <= formRating ? 'active' : ''}
                                    onClick={() => setFormRating(n)}
                                >★</button>
                            ))}
                        </div>
                    </div>

                    <div className="review-form__field">
                        <label>Ваше ім'я</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            placeholder="Ольга"
                            maxLength={50}
                        />
                    </div>

                    <div className="review-form__field">
                        <label>Ваш відгук</label>
                        <textarea
                            value={formText}
                            onChange={e => setFormText(e.target.value)}
                            placeholder="Розкажіть про свій досвід із цим товаром..."
                            maxLength={1000}
                        />
                    </div>

                    <div className="review-form__actions">
                        <button type="submit" className="review-form__submit" disabled={submitting}>
                            {submitting ? 'Відправка...' : 'Надіслати відгук'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.85rem' }}
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
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [selectedColor, setSelectedColor] = useState<string>(product.colors[0] || '');
    const [openAccordion, setOpenAccordion] = useState<string | null>('desc');
    const [activeImage, setActiveImage] = useState(0);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [quickBuyOpen, setQuickBuyOpen] = useState(false);
    const [quickBuyPhone, setQuickBuyPhone] = useState('');
    const [quickBuyName, setQuickBuyName] = useState('');
    const [quickBuySending, setQuickBuySending] = useState(false);

    // Helper: Get stock for a specific size/color combination
    const getVariantStock = (size: string, color: string): number => {
        if (!product.inventory || !Array.isArray(product.inventory)) return 0;
        const variant = product.inventory.find(
            (v: any) => v.size === size && v.color === color
        );
        return variant?.stock || 0;
    };

    // Helper: Check if a color is available for the selected size
    const isColorAvailable = (color: string): boolean => {
        if (!selectedSize) return product.inventory?.some((v: any) => v.color === color && v.stock > 0) ?? true;
        return getVariantStock(selectedSize, color) > 0;
    };

    // Helper: Check if a size is available for the selected color
    const isSizeAvailable = (size: string): boolean => {
        if (!selectedColor) return product.inventory?.some((v: any) => v.size === size && v.stock > 0) ?? true;
        return getVariantStock(size, selectedColor) > 0;
    };

    // Current selection stock
    const currentStock = getVariantStock(selectedSize, selectedColor);
    const hasAnyStock = !product.inventory?.length || product.inventory.some((v: any) => v.stock > 0);
    const hasColorStock = !selectedColor || !product.inventory?.length || product.inventory.some((v: any) => v.color === selectedColor && v.stock > 0);
    const isInStock = selectedSize
        ? (currentStock > 0 || product.inventory?.length === 0)
        : (hasColorStock && hasAnyStock);

    const toggleAccordion = (id: string) => {
        setOpenAccordion(openAccordion === id ? null : id);
    };

    const addToCart = () => {
        if (product.sizes.length > 0 && !selectedSize) {
            showToast('Будь ласка, оберіть розмір', 'warning');
            return;
        }

        // Check stock availability
        if (product.inventory?.length > 0 && !isInStock) {
            showToast('Вибачте, цієї комбінації немає в наявності', 'error');
            return;
        }

        StorageUtils.addToCart({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0],
            size: selectedSize,
            color: selectedColor,
            quantity: 1
        });

        showToast('Додано у кошик ✨');
    };

    const addToWishlist = () => {
        const added = StorageUtils.addToWishlist({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0],
            category: product.category
        });
        if (added) showToast('Додано до улюбленого ❤️');
        else showToast('Вже у списку', 'info');
    };

    const getColorLabel = (code: string) => filterConfig?.colors?.[code] || code;
    const getColorHex = (code: string) => (code && typeof code === 'string' ? COLOR_MAP[code.toLowerCase()] : code) || code;

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
                        <Link to={`/shop/${product.shopPageSlug || 'women'}`}>
                            {product.shopPageSlug === 'kids' ? 'Дітям' : 'Жінкам'}
                        </Link>
                        <span className="sep">/</span>
                        <span className="current">{product.name}</span>
                    </nav>
                </div>
            </div>

            <div className="container main-content-container">
                <div className="product-layout">

                    {/* Visuals: Puma Style (Vertical Thumbs Left + Main Right) */}
                    <div className="visuals-gallery-puma">

                        {/* Left Column: Vertical Thumbnails */}
                        {product.images.length > 1 && (
                            <div className="thumbs-col-vertical">
                                {product.images.map((img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        className={`thumb-vertical ${activeImage === idx ? 'active' : ''}`}
                                        onClick={() => setActiveImage(idx)}
                                        aria-label={`View image ${idx + 1}`}
                                    >
                                        <div className="thumb-inner">
                                            <img src={img} alt="" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Right Area: Main Visual */}
                        <div className="main-visual-puma">
                            <div className="main-img-wrap" onClick={() => setZoomOpen(true)} style={{ cursor: 'zoom-in' }}>
                                <img
                                    src={product.images[activeImage] || product.images[0]}
                                    alt={product.name}
                                    className="main-img"
                                />
                            </div>
                            {/* Badge integrated into image */}
                            {product.is_sale && product.discount_percent ? (
                                <span className="visual-badge" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff' }}>
                                    -{product.discount_percent}%
                                </span>
                            ) : product.is_new ? (
                                <span className="visual-badge">New</span>
                            ) : null}
                        </div>

                        {/* Zoom Lightbox */}
                        {zoomOpen && (
                            <div className="zoom-overlay" onClick={() => setZoomOpen(false)}>
                                <button className="zoom-overlay__close" onClick={() => setZoomOpen(false)} aria-label="Close zoom">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                                <img
                                    src={product.images[activeImage] || product.images[0]}
                                    alt={product.name}
                                    className="zoom-overlay__img"
                                    onClick={e => e.stopPropagation()}
                                />
                                {product.images.length > 1 && (
                                    <div className="zoom-overlay__nav">
                                        <button onClick={e => { e.stopPropagation(); setActiveImage(i => (i - 1 + product.images.length) % product.images.length); }}>‹</button>
                                        <span>{activeImage + 1} / {product.images.length}</span>
                                        <button onClick={e => { e.stopPropagation(); setActiveImage(i => (i + 1) % product.images.length); }}>›</button>
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
                                    <span className="current-price" style={product.is_sale ? { color: '#dc2626' } : undefined}>
                                        {Number(product.price).toLocaleString()} ₴
                                    </span>
                                    {product.is_sale && product.comparePrice > 0 && (
                                        <span className="old-price">{Number(product.comparePrice).toLocaleString()} ₴</span>
                                    )}
                                </div>
                            </div>

                            <div className="div-line" />

                            <div className="selectors-form">
                                {product.colors.length > 0 && (
                                    <div className="selector-group">
                                        <div className="group-head">
                                            <span className="selector-label">Колір: <span className="val">{getColorLabel(selectedColor)}</span></span>
                                        </div>
                                        <div className="color-options">
                                            {product.colors.map((color: string) => {
                                                const available = isColorAvailable(color);
                                                return (
                                                    <button
                                                        key={color}
                                                        className={`color-swatch ${selectedColor === color ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
                                                        onClick={() => setSelectedColor(color)}
                                                        style={{ backgroundColor: getColorHex(color), opacity: available ? 1 : 0.4 }}
                                                        title={available ? '' : 'Немає в наявності'}
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
                                            <Link to="/size-guide" className="size-guide">Таблиця розмірів</Link>
                                        </div>
                                        <div className="size-options">
                                            {product.sizes.map((size: string) => {
                                                const available = isSizeAvailable(size);
                                                return (
                                                    <button
                                                        key={size}
                                                        className={`size-chip ${selectedSize === size ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
                                                        onClick={() => setSelectedSize(size)}
                                                        disabled={!available}
                                                        style={{ opacity: available ? 1 : 0.4, textDecoration: available ? 'none' : 'line-through' }}
                                                    >
                                                        {size}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Stock indicator — enhanced urgency */}
                            {selectedSize && selectedColor && product.inventory?.length > 0 && (
                                <div className={`stock-indicator ${isInStock ? (currentStock <= 3 ? 'stock-indicator--low' : 'stock-indicator--ok') : 'stock-indicator--out'}`}>
                                    {isInStock
                                        ? (currentStock <= 3
                                            ? `🔥 Залишилось лише ${currentStock} шт — поспішіть!`
                                            : `✓ В наявності: ${currentStock} шт`)
                                        : '✕ Немає в наявності'}
                                </div>
                            )}

                            {/* Trust badges — shipping & returns */}
                            <div className="trust-badges-inline">
                                <span>🚚 Швидка доставка по Україні</span>
                                <span>🔄 14 днів на повернення</span>
                                <span>🇺🇦 Українське виробництво</span>
                            </div>

                            <div className="actions-row">
                                <button
                                    className="btn-primary-add"
                                    onClick={addToCart}
                                    disabled={(product.sizes.length > 0 && !selectedSize) || (!isInStock && product.inventory?.length > 0)}
                                    style={{ opacity: ((product.sizes.length > 0 && !selectedSize) || (!isInStock && product.inventory?.length > 0)) ? 0.5 : 1 }}
                                >
                                    <span>{!isInStock && product.inventory?.length > 0 ? 'Немає в наявності' : (product.sizes.length > 0 && !selectedSize) ? 'Оберіть розмір' : 'Додати в кошик'}</span>
                                </button>
                                <button
                                    className="btn-quick-buy"
                                    onClick={() => setQuickBuyOpen(true)}
                                >
                                    ⚡ Купити в 1 клік
                                </button>
                                <button className="btn-wishlist hover-scale" onClick={addToWishlist}>
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                </button>
                            </div>

                            {/* Quick Buy Modal */}
                            {quickBuyOpen && (
                                <div className="quick-buy-overlay" onClick={() => setQuickBuyOpen(false)}>
                                    <div className="quick-buy-modal" onClick={e => e.stopPropagation()}>
                                        <h3 className="quick-buy-modal__title">⚡ Швидке замовлення</h3>
                                        <p className="quick-buy-modal__product">
                                            {product.name} &mdash; {product.comparePrice > product.price ? product.price : product.price} ₴
                                            {selectedSize ? ` · ${selectedSize}` : ''}
                                            {selectedColor ? ` · ${selectedColor}` : ''}
                                        </p>
                                        <input
                                            type="text"
                                            placeholder="Ваше ім'я"
                                            value={quickBuyName}
                                            onChange={e => setQuickBuyName(e.target.value)}
                                            className="quick-buy-modal__input"
                                            autoFocus
                                        />
                                        <input
                                            type="tel"
                                            placeholder="+380 __ ___ __ __"
                                            value={quickBuyPhone}
                                            onChange={e => setQuickBuyPhone(e.target.value)}
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
                                                    await fetch('/api/telegram/send', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            message: `🔥 ШВИДКЕ ЗАМОВЛЕННЯ\n\n📦 ${product.name}\n💰 ${product.price} ₴${selectedSize ? `\n📏 Розмір: ${selectedSize}` : ''}${selectedColor ? `\n🎨 Колір: ${selectedColor}` : ''}\n👤 Ім'я: ${quickBuyName || 'Не вказано'}\n📞 Телефон: ${quickBuyPhone}`
                                                        })
                                                    });
                                                    setQuickBuyOpen(false);
                                                    setQuickBuyPhone('');
                                                    setQuickBuyName('');
                                                    showToast('Замовлення прийнято! Ми зателефонуємо протягом 15 хвилин');
                                                } catch {
                                                    showToast('Помилка. Спробуйте ще раз.', 'error');
                                                } finally {
                                                    setQuickBuySending(false);
                                                }
                                            }}
                                            className="quick-buy-modal__submit"
                                            style={{ opacity: quickBuySending || quickBuyPhone.length < 10 ? 0.5 : 1 }}
                                        >
                                            {quickBuySending ? 'Відправка...' : 'Замовити'}
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
                                <div className={`acc-item ${openAccordion === 'desc' ? 'active' : ''}`}>
                                    <button className="acc-head" onClick={() => toggleAccordion('desc')}>
                                        <span>Опис</span>
                                        <span className={`acc-icon ${openAccordion === 'desc' ? 'minus' : 'plus'}`} />
                                    </button>
                                    <div className="acc-body"><div className="acc-inner">{product.description || "No description."}</div></div>
                                </div>
                                <div className={`acc-item ${openAccordion === 'delivery' ? 'active' : ''}`}>
                                    <button className="acc-head" onClick={() => toggleAccordion('delivery')}>
                                        <span>Доставка</span>
                                        <span className={`acc-icon ${openAccordion === 'delivery' ? 'minus' : 'plus'}`} />
                                    </button>
                                    <div className="acc-body">
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
                            {relatedProducts.map(rp => (
                                <Link to={`/product/${rp.id}`} key={rp.id} className="related-card">
                                    <div className="related-img-box">
                                        <img src={rp.image} alt={rp.name} />
                                    </div>
                                    <div className="related-info">
                                        <h4>{rp.name}</h4>
                                        <span>{rp.price.toLocaleString()} ₴</span>
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
                <div className="mobile-sticky-cta__price">
                    {Number(product.price).toLocaleString()} ₴
                </div>
                <button
                    className="mobile-sticky-cta__btn"
                    onClick={addToCart}
                    disabled={(product.sizes.length > 0 && !selectedSize) || (!isInStock && product.inventory?.length > 0)}
                >
                    {!isInStock && product.inventory?.length > 0 ? 'Немає в наявності' : (product.sizes.length > 0 && !selectedSize) ? 'Оберіть розмір' : 'Додати в кошик'}
                </button>
            </div>
        </main>
    );
}
