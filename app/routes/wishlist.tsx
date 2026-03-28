import { Link } from "react-router";
import { useState, useEffect } from "react";
import { StorageUtils, type WishlistItem } from "../utils/storage";
import { useToast } from "../components/Toast";
import styles from "../styles/wishlist.css?url";


export default function Wishlist() {
    const { showToast } = useToast();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const updateItems = () => {
            setItems(StorageUtils.getWishlist());
            setIsLoading(false);
        };

        updateItems();
        const unsub = StorageUtils.subscribeToWishlist(updateItems);
        return () => unsub();
    }, []);

    const removeItem = (id: string | number) => {
        StorageUtils.removeFromWishlist(id);
    };

    const addToCart = (item: WishlistItem) => {
        StorageUtils.addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            quantity: 1
        });
        showToast('Товар додано до кошика!');
    };

    const addAllToCart = () => {
        items.forEach(item => {
            StorageUtils.addToCart({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                quantity: 1
            });
        });
        showToast(`${items.length} товарів додано до кошика!`);
    };

    const clearWishlist = () => {
        if (confirm('Ви впевнені, що хочете очистити список улюбленого?')) {
            items.forEach(item => StorageUtils.removeFromWishlist(item.id));
        }
    };

    const totalValue = items.reduce((sum, item) => sum + item.price, 0);

    if (isLoading) {
        return (
            <main className="wishlist-page">
                <div className="wishlist-loading">
                    <div className="wishlist-loading__spinner"></div>
                    <p>Завантаження...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="wishlist-page">
            {/* Hero Section */}
            <div className="wishlist-hero">
                <div className="container">
                    <nav className="wishlist-breadcrumb">
                        <Link to="/">Головна</Link>
                        <span>/</span>
                        <span className="active">Улюблене</span>
                    </nav>
                    <div className="wishlist-hero__content">
                        <h1>Моє <em>Улюблене</em></h1>
                        <p className="wishlist-count">{items.length} {items.length === 1 ? 'товар' : items.length < 5 ? 'товари' : 'товарів'} у списку</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="wishlist-content">
                <div className="container">
                    {items.length === 0 ? (
                        /* Empty State */
                        <div className="wishlist-empty">
                            <div className="wishlist-empty__visual">
                                <div className="wishlist-empty__circle">
                                    <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                </div>
                            </div>
                            <h2>Список улюбленого <em>порожній</em></h2>
                            <p>Збережіть товари, які вам сподобалися, щоб повернутися до них пізніше</p>
                            <Link to="/shop/women" className="wishlist-btn wishlist-btn--primary">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <path d="M16 10a4 4 0 0 1-8 0" />
                                </svg>
                                Перейти до каталогу
                            </Link>
                        </div>
                    ) : (
                        /* Items Grid + Sidebar */
                        <div className="wishlist-grid-layout">
                            <div className="wishlist-main">
                                {/* Actions Bar */}
                                <div className="wishlist-actions">
                                    <span className="wishlist-actions__count">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                        </svg>
                                        {items.length} товарів збережено
                                    </span>
                                    <button className="wishlist-actions__clear" onClick={clearWishlist}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                        Очистити все
                                    </button>
                                </div>

                                {/* Products Grid */}
                                <div className="wishlist-grid">
                                    {items.map(item => (
                                        <div key={item.id} className="wishlist-card">
                                            <div className="wishlist-card__image">
                                                <Link to={`/product/${item.id}`}>
                                                    <img src={item.image} alt={item.name} />
                                                </Link>
                                                <button
                                                    className="wishlist-card__remove"
                                                    onClick={() => removeItem(item.id)}
                                                    aria-label="Видалити з улюбленого"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="wishlist-card__cart"
                                                    onClick={() => addToCart(item)}
                                                    aria-label="Додати до кошика"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                                        <line x1="3" y1="6" x2="21" y2="6" />
                                                        <path d="M16 10a4 4 0 0 1-8 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="wishlist-card__info">
                                                <span className="wishlist-card__category">{item.category === 'kids' ? 'Дітям' : 'Жінкам'}</span>
                                                <Link to={`/product/${item.id}`} className="wishlist-card__name">{item.name}</Link>
                                                <span className="wishlist-card__price">{item.price.toLocaleString()} ₴</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="wishlist-sidebar">
                                {/* Quick Actions Card */}
                                <div className="wishlist-quick-actions">
                                    <button className="wishlist-action-btn wishlist-action-btn--primary" onClick={addAllToCart}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                            <line x1="3" y1="6" x2="21" y2="6" />
                                            <path d="M16 10a4 4 0 0 1-8 0" />
                                        </svg>
                                        <div className="wishlist-action-btn__text">
                                            <span className="wishlist-action-btn__title">Додати все</span>
                                            <span className="wishlist-action-btn__subtitle">{items.length} товарів • {totalValue.toLocaleString()} ₴</span>
                                        </div>
                                    </button>
                                </div>

                                {/* Help Card */}
                                <div className="wishlist-help-card">
                                    <div className="wishlist-help-card__icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                        </svg>
                                    </div>
                                    <h4>Потрібна допомога?</h4>
                                    <p>Наші консультанти допоможуть з вибором розміру та відповідять на будь-які питання</p>
                                    <div className="wishlist-help-card__buttons">
                                        <a href="https://instagram.com/mindbody.sportwear" target="_blank" rel="noopener noreferrer" className="wishlist-help-card__link wishlist-help-card__link--instagram">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                            </svg>
                                            Instagram
                                        </a>
                                        <Link to="/contacts" className="wishlist-help-card__link wishlist-help-card__link--contact">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                            </svg>
                                            Швидке запитання
                                        </Link>
                                    </div>
                                </div>

                                {/* Continue Shopping */}
                                <Link to="/shop/women" className="wishlist-continue-link">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                    Продовжити покупки
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
