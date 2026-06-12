import { useState, useEffect, useRef } from "react";
import { useI18n, useMoney, LLink } from "../i18n";
import { StorageUtils, type CartItem } from "../utils/storage";
import { getColorLabel } from "../utils/colors";

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// CSS selector listing every element the user can normally tab to. We use
// it both to move focus into the drawer on open and to wrap the Tab cycle.
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
    const { t } = useI18n();
    const money = useMoney();
    const [cart, setCart] = useState<CartItem[]>([]);
    const drawerRef = useRef<HTMLElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

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
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Focus management: when the drawer opens, remember where focus was,
    // move it inside the drawer; when it closes, return focus to the
    // trigger. Without this a keyboard / screen-reader user opens the
    // cart and their focus is left behind on the page below.
    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        const first = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
        return () => {
            previousFocusRef.current?.focus?.();
        };
    }, [isOpen]);

    // Focus trap: while the drawer is open Tab/Shift+Tab cycle only among
    // the drawer's own focusable elements. Without this the user tabs
    // out into the obscured background page and gets stuck behind the
    // backdrop.
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const drawer = drawerRef.current;
            if (!drawer) return;
            const focusables = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
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
            <aside
                ref={drawerRef}
                className={`cart-drawer ${isOpen ? "cart-drawer--open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cart-drawer-title"
                aria-hidden={!isOpen}
            >
                {/* Header */}
                <div className="cart-drawer__header">
                    <h3 className="cart-drawer__title" id="cart-drawer-title">
                        {t("Кошик")}
                        {itemCount > 0 && (
                            <span className="cart-drawer__count" aria-live="polite">
                                {itemCount}
                            </span>
                        )}
                    </h3>
                    <button
                        className="cart-drawer__close"
                        onClick={onClose}
                        aria-label={t("Закрити кошик")}
                    >
                        <svg
                            aria-hidden="true"
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

                {/* Cart Items */}
                {cart.length === 0 ? (
                    <div className="cart-drawer__empty">
                        <svg
                            aria-hidden="true"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                        >
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <p>{t("Кошик порожній")}</p>
                        <button className="cart-drawer__continue" onClick={onClose}>
                            {t("Продовжити покупки")}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="cart-drawer__items">
                            {cart.map((item) => (
                                <div
                                    key={`${item.id}-${item.size ?? ""}-${item.color ?? ""}`}
                                    className="cart-drawer__item"
                                >
                                    <div className="cart-drawer__item-image">
                                        <img
                                            src={
                                                typeof item.image === "string" &&
                                                (item.image.startsWith("http") ||
                                                    item.image.startsWith("/"))
                                                    ? item.image
                                                    : `/uploads/${item.image}`
                                            }
                                            alt={item.name}
                                        />
                                    </div>
                                    <div className="cart-drawer__item-info">
                                        <h4 className="cart-drawer__item-name">{item.name}</h4>
                                        <div className="cart-drawer__item-meta">
                                            {item.size && (
                                                <span>
                                                    {t("Розмір: {size}", { size: item.size })}
                                                </span>
                                            )}
                                            {item.color && (
                                                <span>
                                                    {/* getColorLabel: «black» из БД → «Чорний»
                                                        (аудит F-032 — англ. код тёк в UI) */}
                                                    {t("Колір: {color}", {
                                                        color: getColorLabel(item.color),
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="cart-drawer__item-bottom">
                                            <div className="cart-drawer__qty">
                                                <button
                                                    onClick={() => handleQuantity(item, -1)}
                                                    aria-label={t("Зменшити кількість {name}", {
                                                        name: item.name,
                                                    })}
                                                >
                                                    −
                                                </button>
                                                <span aria-live="polite" aria-atomic="true">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => handleQuantity(item, 1)}
                                                    aria-label={t("Збільшити кількість {name}", {
                                                        name: item.name,
                                                    })}
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="cart-drawer__item-price">
                                                {money(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className="cart-drawer__item-remove"
                                        onClick={() => handleRemove(item)}
                                        aria-label={t("Видалити")}
                                    >
                                        <svg
                                            aria-hidden="true"
                                            width="16"
                                            height="16"
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
                                            <div
                                                className="cart-drawer__shipping-fill"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className="cart-drawer__shipping-text">
                                            {t("До безкоштовної доставки ще {amount}", {
                                                amount: money(remaining),
                                            })}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="cart-drawer__shipping-free">
                                        {t("🎉 Безкоштовна доставка!")}
                                    </div>
                                );
                            })()}

                            <div className="cart-drawer__total">
                                <span>{t("Разом:")}</span>
                                <span className="cart-drawer__total-price">{money(total)}</span>
                            </div>
                            <LLink
                                to="/checkout"
                                className="cart-drawer__checkout-btn"
                                onClick={onClose}
                            >
                                {t("Оформити замовлення@@drawer")}
                            </LLink>
                            <button className="cart-drawer__continue-btn" onClick={onClose}>
                                {t("Продовжити покупки")}
                            </button>
                        </div>
                    </>
                )}
            </aside>
        </>
    );
}
