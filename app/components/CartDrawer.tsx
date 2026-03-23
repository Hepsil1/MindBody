import { Link } from "react-router";
import { useState, useEffect } from "react";
import { StorageUtils, type CartItem } from "../utils/storage";

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
    const [cart, setCart] = useState<CartItem[]>([]);

    useEffect(() => {
        const updateCart = () => setCart(StorageUtils.getCart());
        updateCart();
        const unsub = StorageUtils.subscribeToCart(updateCart);
        return unsub;
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleQuantity = (item: CartItem, delta: number) => {
        if (item.quantity + delta < 1) {
            StorageUtils.removeFromCart(item.id, item.size, item.color);
        } else {
            StorageUtils.updateCartQuantity(item.id, delta, item.size, item.color);
        }
    };

    const handleRemove = (item: CartItem) => {
        StorageUtils.removeFromCart(item.id, item.size, item.color);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`cart-drawer__backdrop ${isOpen ? "cart-drawer__backdrop--open" : ""}`}
                onClick={onClose}
            />

            {/* Drawer */}
            <aside className={`cart-drawer ${isOpen ? "cart-drawer--open" : ""}`}>
                {/* Header */}
                <div className="cart-drawer__header">
                    <h3 className="cart-drawer__title">
                        Кошик
                        {itemCount > 0 && <span className="cart-drawer__count">{itemCount}</span>}
                    </h3>
                    <button className="cart-drawer__close" onClick={onClose} aria-label="Закрити кошик">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Cart Items */}
                {cart.length === 0 ? (
                    <div className="cart-drawer__empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <p>Кошик порожній</p>
                        <button className="cart-drawer__continue" onClick={onClose}>
                            Продовжити покупки
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="cart-drawer__items">
                            {cart.map((item, index) => (
                                <div key={`${item.id}-${item.size}-${item.color}-${index}`} className="cart-drawer__item">
                                    <div className="cart-drawer__item-image">
                                        <img
                                            src={typeof item.image === 'string' && (item.image.startsWith('http') || item.image.startsWith('/'))
                                                ? item.image
                                                : `/uploads/${item.image}`}
                                            alt={item.name}
                                        />
                                    </div>
                                    <div className="cart-drawer__item-info">
                                        <h4 className="cart-drawer__item-name">{item.name}</h4>
                                        <div className="cart-drawer__item-meta">
                                            {item.size && <span>Розмір: {item.size}</span>}
                                            {item.color && <span>Колір: {item.color}</span>}
                                        </div>
                                        <div className="cart-drawer__item-bottom">
                                            <div className="cart-drawer__qty">
                                                <button onClick={() => handleQuantity(item, -1)} aria-label="Зменшити">−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => handleQuantity(item, 1)} aria-label="Збільшити">+</button>
                                            </div>
                                            <span className="cart-drawer__item-price">
                                                {(item.price * item.quantity).toLocaleString()} ₴
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className="cart-drawer__item-remove"
                                        onClick={() => handleRemove(item)}
                                        aria-label="Видалити"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="cart-drawer__footer">
                            {/* Free shipping progress bar */}
                            {(() => {
                                const FREE_SHIPPING = 2000;
                                const remaining = Math.max(0, FREE_SHIPPING - total);
                                const progress = Math.min(100, (total / FREE_SHIPPING) * 100);
                                return remaining > 0 ? (
                                    <div className="cart-drawer__shipping-progress">
                                        <div className="cart-drawer__shipping-bar">
                                            <div className="cart-drawer__shipping-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                        <span className="cart-drawer__shipping-text">
                                            До безкоштовної доставки ще <strong>{remaining.toLocaleString()} ₴</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <div className="cart-drawer__shipping-free">
                                        🎉 Безкоштовна доставка!
                                    </div>
                                );
                            })()}

                            <div className="cart-drawer__total">
                                <span>Разом:</span>
                                <span className="cart-drawer__total-price">{total.toLocaleString()} ₴</span>
                            </div>
                            <Link to="/checkout" className="cart-drawer__checkout-btn" onClick={onClose}>
                                Оформити замовлення
                            </Link>
                            <button className="cart-drawer__continue-btn" onClick={onClose}>
                                Продовжити покупки
                            </button>
                        </div>
                    </>
                )}
            </aside>
        </>
    );
}
