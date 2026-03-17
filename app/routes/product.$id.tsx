
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../components/Toast";
import { prisma } from "../db.server";
import { StorageUtils } from "../utils/storage";

export function meta({ data }: { data: any }) {
    const product = data?.product;
    if (!product) {
        return [{ title: "Товар не знайдено | MIND BODY" }];
    }
    const desc = (product.description || `${product.name} — купити в MIND BODY`).substring(0, 160);
    const image = product.images?.[0] || '/brand-sun.png';
    return [
        { title: `${product.name} | MIND BODY` },
        { name: "description", content: desc },
        { property: "og:title", content: product.name },
        { property: "og:description", content: desc },
        { property: "og:image", content: image },
        { property: "og:type", content: "product" },
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
    let product = null;
    let filterConfig: FilterConfigData | null = null;
    let relatedProducts: any[] = [];

    try {
        const productResult: any[] = await prisma.$queryRawUnsafe(
            `SELECT id, name, description, price, "comparePrice", category, images, colors, sizes, inventory, status, "shopPageSlug", "createdAt"
             FROM "Product" WHERE id = $1`, id
        );

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

            product = {
                id: p.id,
                name: p.name,
                description: p.description,
                price: Number(p.price),
                comparePrice: Number(p.comparePrice),
                images: images,
                category: p.category,
                shopPageSlug: p.shopPageSlug,
                // Use inventory-derived colors/sizes if available, fallback to stored arrays
                colors: availableColors.size > 0 ? Array.from(availableColors) : parseJson(p.colors, []),
                sizes: availableSizes.size > 0 ? Array.from(availableSizes) : parseJson(p.sizes, []),
                inventory: inventory, // Full inventory array for checking combinations
                status: p.status,
                is_new: p.status === 'active'
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

        const configResult: any[] = await prisma.$queryRawUnsafe(`SELECT config FROM "FilterConfig" WHERE id = 'global' LIMIT 1`);
        if (configResult[0]?.config) {
            filterConfig = JSON.parse(configResult[0].config);
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
                showToast('Дякуємо за ваш відгук! ✨');
                setFormName('');
                setFormText('');
                setFormRating(5);
                setShowForm(false);
                fetchReviews();
            } else {
                showToast('Помилка при збереженні', 'error');
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
                <p style={{ color: '#999', fontSize: '0.9rem', textAlign: 'center', padding: '32px 0' }}>
                    Поки що немає відгуків. Будьте першими! ✨
                </p>
            )}

            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    style={{
                        marginTop: '24px',
                        padding: '12px 32px',
                        background: 'transparent',
                        border: '2px solid #2a5a5a',
                        borderRadius: '10px',
                        color: '#2a5a5a',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
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

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                            {product.is_new && <span className="visual-badge">New</span>}
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
                                    <span className="current-price">{Number(product.price).toLocaleString()} ₴</span>
                                    {product.comparePrice > 0 && (
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
                                <div className="stock-indicator" style={{
                                    fontSize: '13px',
                                    padding: '10px 16px',
                                    borderRadius: '10px',
                                    marginBottom: '14px',
                                    background: isInStock ? (currentStock <= 3 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.06)') : 'rgba(239, 68, 68, 0.06)',
                                    border: `1px solid ${isInStock ? (currentStock <= 3 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.15)') : 'rgba(239, 68, 68, 0.15)'}`,
                                    color: isInStock ? (currentStock <= 3 ? '#b45309' : '#16a34a') : '#dc2626',
                                    fontWeight: 500
                                }}>
                                    {isInStock
                                        ? (currentStock <= 3
                                            ? `🔥 Залишилось лише ${currentStock} шт — поспішіть!`
                                            : `✓ В наявності: ${currentStock} шт`)
                                        : '✕ Немає в наявності'}
                                </div>
                            )}

                            {/* Trust badges — shipping & returns */}
                            <div className="trust-badges-inline" style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                marginBottom: '16px',
                                fontSize: '12px',
                                color: '#6b7280'
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>🚚 Швидка доставка по Україні</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>🔄 14 днів на повернення</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>🇺🇦 Українське виробництво</span>
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

            <style>{`
                /* === BRAND VARIABLES === */
                :root {
                    --c-primary: #2a5a5a;
                    --c-marsala: #722F37;
                    --c-cream: #faf8f6;
                    --c-cream-dark: #f0ebe6;
                    --c-text: #1a1a1a;
                    --c-text-light: #555;
                    --f-serif: 'Cormorant Garamond', serif;
                    --f-sans: 'DM Sans', sans-serif;
                }

                .product-page-mindbody {
                    background-color: var(--c-cream);
                    color: var(--c-text);
                    font-family: var(--f-sans);
                    min-height: 100vh;
                    padding-bottom: 120px;
                }

                /* --- LUXE HERO COMPACT (Vibrant) --- */
                .shop-hero-luxe.compact {
                    position: relative;
                    /* Brighter, more vibrant Teal Gradient */
                    background: linear-gradient(135deg, #204545 0%, #2a5a5a 40%, #3e7575 100%); 
                    height: 160px; /* Slightly taller for more presence */
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    margin-bottom: 60px;
                    box-shadow: 0 10px 40px rgba(42, 90, 90, 0.2); /* Colored shadow for glow */
                }

                /* Branded Watermark - Adjusted for lighter BG */
                .shop-hero-luxe.compact::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    right: 0%;
                    transform: translateY(-50%) rotate(0deg); /* Cleaner rotation */
                    width: 500px;
                    height: 500px;
                    background-image: url('/logo-sun.png');
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                    opacity: 0.1; 
                    mix-blend-mode: screen; /* Lightens the background */
                    pointer-events: none;
                    filter: none; /* Removed invert */
                    z-index: 0;
                }

                /* Vibrant Light Leaks */
                .shop-hero-luxe__drift {
                    position: absolute; inset: 0; pointer-events: none;
                }
                .shop-hero-luxe__drift::before {
                    content: ''; position: absolute; width: 600px; height: 600px; top: -200px; left: -100px;
                    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%); /* White light leak */
                    filter: blur(100px);
                    mix-blend-mode: overlay;
                }
                .shop-hero-luxe__drift::after {
                    content: ''; position: absolute; width: 400px; height: 400px; bottom: -100px; right: 20%;
                    background: radial-gradient(circle, rgba(114, 47, 55, 0.2) 0%, transparent 70%); /* Subtle Marsala warm glow */
                    filter: blur(80px);
                    mix-blend-mode: color-dodge;
                }

                .luxe-grain {
                    position: absolute; inset: 0; pointer-events: none; opacity: 0.15;
                    background-image: url("https://grainy-gradients.vercel.app/noise.svg");
                    mix-blend-mode: overlay;
                }
                
                .hero-container {
                    width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 20px;
                    z-index: 10;
                }

                .luxe-breadcrumb {
                    display: flex; gap: 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;
                    align-items: center;
                    color: rgba(255, 255, 255, 0.8); /* Brighter text */
                }
                .luxe-breadcrumb a {
                    color: inherit; text-decoration: none; transition: color 0.3s ease;
                    font-family: var(--f-sans);
                    font-weight: 500;
                }
                .luxe-breadcrumb a:hover { color: #fff; }
                .luxe-breadcrumb .sep { opacity: 0.3; }
                
                .luxe-breadcrumb .current {
                    color: #fff;
                    font-family: var(--f-serif); /* Serif for Product Name */
                    font-style: italic;
                    font-size: 22px; /* Much larger */
                    text-transform: none; /* Keep natural case */
                    letter-spacing: 0.05em;
                    position: relative;
                    top: 2px;
                    padding-left: 12px;
                    border-left: 1px solid rgba(255,255,255,0.2);
                }
                    color: rgba(255,255,255,0.6);
                }
                .luxe-breadcrumb a { color: inherit; text-decoration: none; transition: color 0.2s; }
                .luxe-breadcrumb a:hover { color: #fff; }
                .luxe-breadcrumb .current { color: #fff; font-weight: 600; }
                .sep { opacity: 0.4; }


                /* --- MAIN LAYOUT (Reduced Scale) --- */
                .main-content-container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 0 30px;
                }

                .product-layout {
                    display: grid;
                    /* Layout: Left Gallery | Right Info */
                    grid-template-columns: 1.4fr 1fr; 
                    gap: 60px;
                    align-items: start;
                }

                /* --- PUMA STYLE GALLERY --- */
                .visuals-gallery-puma {
                    display: flex;
                    gap: 20px;
                    height: 600px; /* Fixed height container for stability */
                }

                /* Left Thumbs */
                .thumbs-col-vertical {
                    width: 80px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    overflow-y: auto;
                    padding-right: 4px; /* Space for scrollbar if needed */
                }
                /* Hide scrollbar for cleaner look */
                .thumbs-col-vertical::-webkit-scrollbar { width: 0; }
                
                .thumb-vertical {
                    width: 100%;
                    aspect-ratio: 3/4;
                    padding: 0;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    position: relative;
                }
                
                .thumb-inner {
                    width: 100%;
                    height: 100%;
                    background: #f0f0f0;
                    overflow: hidden;
                    /* Default state: slightly smaller or faded? */
                    opacity: 0.7;
                    transition: all 0.3s ease;
                }
                .thumb-vertical img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                /* ACTIVE STATE - Marsala Line */
                .thumb-vertical.active .thumb-inner {
                    opacity: 1;
                }
                .thumb-vertical.active::after {
                    content: '';
                    position: absolute;
                    bottom: -6px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background-color: var(--c-marsala);
                    animation: lineScale 0.3s ease forwards;
                }
                @keyframes lineScale { from { transform: scaleX(0); } to { transform: scaleX(1); } }

                /* Right Main Visual */
                .main-visual-puma {
                    flex: 1;
                    position: relative;
                    background: #f4f4f4;
                    cursor: zoom-in;
                    overflow: hidden;
                }
                .main-img-wrap {
                    width: 100%;
                    height: 100%;
                }
                .main-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    /* Fade in effect when src changes? React handles diffs. 
                       We can add a key to force re-animation if needed, or just smooth scale. */
                    animation: fadeInImg 0.5s ease;
                }
                @keyframes fadeInImg { from { opacity: 0.8; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                
                .visual-badge {
                    position: absolute;
                    top: 24px;
                    left: 24px;
                    background: #fff;
                    color: var(--c-text);
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    padding: 8px 16px;
                    z-index: 2;
                }


                /* --- INFO SECTION --- */
                .info-sticky-wrapper {
                    position: sticky;
                    top: 40px;
                }
                
                .product-title {
                    font-family: var(--f-serif);
                    font-size: 42px;
                    font-weight: 400;
                    margin: 0 0 12px 0;
                    line-height: 1.1;
                    color: var(--c-primary);
                }
                
                .product-price-block {
                    font-family: var(--f-serif);
                    font-size: 22px;
                    color: #444;
                }
                .old-price {
                    font-size: 18px;
                    color: #999;
                    text-decoration: line-through;
                    margin-left: 12px;
                }

                .div-line {
                    height: 1px;
                    background: #e5e5e5;
                    margin: 24px 0;
                }

                /* Groups */
                .selector-group { margin-bottom: 32px; }
                .group-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center; 
                    margin-bottom: 16px;
                }
                .selector-label {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    color: var(--c-text-light);
                }
                .current-val {
                    font-size: 13px;
                    color: var(--c-text);
                    font-weight: 400;
                }
                .size-guide {
                    font-size: 11px;
                    text-decoration: underline;
                    color: #888;
                    transition: color 0.2s;
                }
                .size-guide:hover { color: var(--c-text); }

                /* Colors */
                .color-options { display: flex; gap: 16px; }
                .color-swatch {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 1px solid #e0e0e0;
                    cursor: pointer;
                    transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
                    position: relative;
                }
                .color-swatch:after {
                    content: '';
                    position: absolute;
                    top: -4px; right: -4px; bottom: -4px; left: -4px;
                    border: 1px solid var(--c-text);
                    border-radius: 50%;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .color-swatch.selected:after { opacity: 1; }
                .color-swatch:hover { transform: scale(1.1); }

                /* Sizes */
                .size-options { display: flex; flex-wrap: wrap; gap: 10px; }
                .size-chip {
                    height: 44px;
                    min-width: 52px;
                    padding: 0 16px;
                    border: 1px solid #e0e0e0;
                    background: transparent;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--c-text);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .size-chip:hover { border-color: var(--c-primary); }
                .size-chip.selected {
                    background: var(--c-primary);
                    color: #fff;
                    border-color: var(--c-primary);
                }

                /* Actions */
                .actions-row { display: flex; gap: 20px; margin-bottom: 50px; }
                .btn-primary-add {
                    flex: 1;
                    height: 60px;
                    background-color: var(--c-marsala);
                    color: #fff;
                    font-family: var(--f-sans);
                    font-size: 14px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    border: none;
                    cursor: pointer;
                    transition: background 0.3s, transform 0.3s;
                }
                .btn-primary-add:hover {
                    background-color: #5a242b;
                    transform: translateY(-2px);
                }
                .btn-wishlist {
                    width: 60px;
                    height: 60px;
                    border: 1px solid #e0e0e0;
                    background: transparent;
                    color: var(--c-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .btn-wishlist:hover {
                    border-color: var(--c-primary);
                    background: rgba(42, 90, 90, 0.03);
                }

                /* Accordion - Subtle lines */
                .acc-item { border-bottom: 1px solid #eee; }
                .acc-item:first-child { border-top: 1px solid #eee; }
                .acc-head {
                    width: 100%;
                    padding: 24px 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: var(--f-sans);
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--c-text);
                }
                .acc-icon {
                    width: 12px;
                    height: 12px;
                    position: relative;
                }
                .acc-icon::before, .acc-icon::after {
                    content: '';
                    position: absolute;
                    top: 50%; left: 50%;
                    background: currentColor;
                    transform: translate(-50%, -50%);
                }
                .acc-icon::before { width: 12px; height: 1px; }
                .acc-icon::after { width: 1px; height: 12px; transition: transform 0.3s; }
                .acc-icon.minus::after { transform: translate(-50%, -50%) rotate(90deg); }

                .acc-body {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .acc-item.active .acc-body { max-height: 200px; }
                .acc-inner { padding-bottom: 32px; font-size: 14px; line-height: 1.7; color: #555; }

                /* Related */
                .related-section { margin-top: 100px; padding-top: 60px; border-top: 1px solid #eee; }
                .related-header {
                    display: flex;
                    align-items: baseline;
                    gap: 32px;
                    margin-bottom: 40px;
                }
                .related-title {
                    font-family: var(--f-serif);
                    font-size: 36px;
                    font-weight: 300;
                    color: var(--c-primary);
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: -0.01em;
                }
                .related-line { flex: 1; height: 1px; background: #eee; }
                
                .related-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 32px;
                }
                .related-card {
                    display: block;
                    text-decoration: none;
                    color: inherit;
                }
                .related-img-box {
                    aspect-ratio: 3/4;
                    background: var(--c-cream-dark);
                    margin-bottom: 20px;
                    position: relative;
                    overflow: hidden;
                }
                .related-img-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.6s;
                }
                .related-card:hover .related-img-box img { transform: scale(1.05); }
                .related-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .related-card:hover .related-overlay { opacity: 1; }
                .related-overlay span {
                    background: #fff;
                    padding: 10px 20px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .related-info h4 {
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin: 0 0 4px 0;
                }
                .related-info span {
                    font-family: var(--f-serif);
                    font-size: 18px;
                    color: #777;
                }

                /* Mobile */
                @media (max-width: 1024px) {
                    .container { padding: 0 24px; }
                    .mb-breadcrumb { padding-top: 20px; }
                    
                    /* Stack Layout */
                    .product-layout { grid-template-columns: 1fr; gap: 40px; }
                    
                    /* Mobile Gallery: Full width swipe, classic dots or just swipe */
                    .visuals-gallery-puma { 
                        display: block; 
                        height: auto; 
                        position: relative;
                    }
                    .thumbs-col-vertical { display: none; }
                    .main-visual-puma { aspect-ratio: 4/5; }
                }

                /* Zoom Overlay */
                .zoom-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.92);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: zoom-out;
                }
                .zoom-overlay__close {
                    position: absolute;
                    top: 20px; right: 20px;
                    width: 44px; height: 44px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.15);
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                    z-index: 10001;
                }
                .zoom-overlay__close:hover { background: rgba(255,255,255,0.3); }
                .zoom-overlay__img {
                    max-width: 90vw;
                    max-height: 90vh;
                    object-fit: contain;
                    border-radius: 8px;
                    cursor: default;
                }
                .zoom-overlay__nav {
                    position: absolute;
                    bottom: 30px;
                    left: 50%; transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    color: #fff;
                    font-size: 14px;
                }
                .zoom-overlay__nav button {
                    width: 40px; height: 40px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.15);
                    border: none;
                    color: #fff;
                    font-size: 22px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .zoom-overlay__nav button:hover { background: rgba(255,255,255,0.3); }

                /* Quick Buy button */
                .btn-quick-buy {
                    padding: 14px 20px;
                    background: transparent;
                    border: 2px solid var(--color-primary, #2a5a5a);
                    color: var(--color-primary, #2a5a5a);
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .btn-quick-buy:hover {
                    background: var(--color-primary, #2a5a5a);
                    color: #fff;
                }

                /* Quick Buy Modal */
                .quick-buy-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .quick-buy-modal {
                    background: #fff;
                    border-radius: 20px;
                    padding: 32px;
                    max-width: 420px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    animation: modalIn 0.25s ease;
                }
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .quick-buy-modal__title {
                    margin: 0 0 8px;
                    font-size: 20px;
                    font-weight: 700;
                }
                .quick-buy-modal__product {
                    margin: 0 0 20px;
                    color: #666;
                    font-size: 14px;
                }
                .quick-buy-modal__input {
                    width: 100%;
                    padding: 14px 16px;
                    border: 2px solid #e0e0e0;
                    border-radius: 12px;
                    font-size: 16px;
                    box-sizing: border-box;
                    margin-bottom: 12px;
                    transition: border-color 0.2s;
                }
                .quick-buy-modal__input:focus {
                    outline: none;
                    border-color: var(--color-primary, #2a5a5a);
                }
                .quick-buy-modal__hint {
                    margin: 0 0 16px;
                    color: #999;
                    font-size: 12px;
                }
                .quick-buy-modal__submit {
                    width: 100%;
                    padding: 14px;
                    background: var(--color-primary, #2a5a5a);
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .quick-buy-modal__submit:hover { filter: brightness(1.1); }
                .quick-buy-modal__cancel {
                    width: 100%;
                    padding: 10px;
                    background: none;
                    border: none;
                    color: #999;
                    font-size: 13px;
                    cursor: pointer;
                    margin-top: 8px;
                }
                .quick-buy-modal__cancel:hover { color: #666; }

                /* Mobile Sticky CTA */
                .mobile-sticky-cta {
                    display: none;
                }
                @media (max-width: 768px) {
                    .mobile-sticky-cta {
                        display: flex;
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: #fff;
                        border-top: 1px solid #e5e7eb;
                        padding: 12px 16px;
                        z-index: 999;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
                    }
                    .mobile-sticky-cta__price {
                        font-family: var(--font-display, var(--f-display));
                        font-size: 22px;
                        font-weight: 700;
                        color: #0d3838;
                        white-space: nowrap;
                    }
                    .mobile-sticky-cta__btn {
                        flex: 1;
                        padding: 14px 20px;
                        background: var(--color-primary, #2a5a5a);
                        color: #fff;
                        border: none;
                        border-radius: 12px;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        transition: opacity 0.2s;
                    }
                    .mobile-sticky-cta__btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    /* add padding to bottom of page so content not hidden */
                    main.product-page-luxe { padding-bottom: 80px; }
                }
            `}</style>

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
