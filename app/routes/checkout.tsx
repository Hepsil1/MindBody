import { useState, useEffect, useRef } from "react";
import { StorageUtils, type CartItem } from "../utils/storage";
import { AuthUtils } from "../utils/auth";
import { useToast } from "../components/Toast";
import { trackBeginCheckout, trackPurchase } from "../utils/analytics.client";
import { formatPhoneUA, getPhoneDigits } from "../utils/phone";
import { productImageSrc, IMAGE_FALLBACK, formatPrice } from "../utils/format";
import { splitLocalePath } from "../i18n/config";
import { useI18n, useMoney, getT, LLink, plural } from "../i18n";
import {
    useNovaPoshtaAutocomplete,
    type NovaPoshtaCity,
    type NovaPoshtaWarehouse,
} from "../hooks/useNovaPoshtaAutocomplete";
import "../styles/checkout.css";

export function meta({ location }: { location: { pathname: string } }) {
    const t = getT(splitLocalePath(location.pathname).locale);
    return [
        { title: `${t("Кошик")} | MIND BODY` },
        {
            name: "description",
            content: t(
                "Оформіть замовлення спортивного одягу MIND BODY. Швидка доставка по Україні.",
            ),
        },
        // Transient, session-specific page — keep it out of the index.
        { name: "robots", content: "noindex, nofollow" },
    ];
}

// Telegram messages are sent via server-side API route (token is NOT in client code)

type CheckoutStep = "cart" | "info" | "success";
type PaymentMethod = "cash" | "card" | "apple_pay" | "google_pay";
type DeliveryService = "nova_poshta" | "ukrposhta";

interface CustomerInfo {
    name: string;
    email: string;
    phone: string;
    city: string;
    cityRef: string;
    warehouse: string;
    warehouseRef: string;
    comment: string;
    payment: PaymentMethod;
    delivery: DeliveryService;
}

// Nova Poshta types + phone helpers now live in their own modules. See
// app/hooks/useNovaPoshtaAutocomplete.ts and app/utils/phone.ts.

export default function Checkout() {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [step, setStep] = useState<CheckoutStep>("cart");
    const { t, locale } = useI18n();
    const money = useMoney();
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderNumber, setOrderNumber] = useState("");
    // Stable idempotency key for the current checkout attempt. Reused across
    // retries/double-submits (so the server dedupes), reset after a successful order.
    const idempotencyKeyRef = useRef<string | null>(null);

    const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
        name: "",
        email: "",
        phone: "",
        city: "",
        cityRef: "",
        warehouse: "",
        warehouseRef: "",
        comment: "",
        payment: "cash",
        delivery: "nova_poshta",
    });

    const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});

    // Nova Poshta autocomplete (cities + warehouses) — fetching, debouncing,
    // dropdown visibility, and click-outside live in app/hooks. Parent owns
    // the canonical customerInfo state via the two callbacks.
    const {
        cities,
        warehouses,
        citySearch,
        setCitySearch,
        warehouseSearch,
        setWarehouseSearch,
        showCitiesDropdown,
        setShowCitiesDropdown,
        showWarehousesDropdown,
        setShowWarehousesDropdown,
        isLoadingCities,
        isLoadingWarehouses,
        cityAutocompleteRef,
        warehouseAutocompleteRef,
        selectCity,
        selectWarehouse,
    } = useNovaPoshtaAutocomplete({
        enabled: customerInfo.delivery === "nova_poshta",
        cityRef: customerInfo.cityRef,
        onCitySelect: (city) =>
            setCustomerInfo((prev) => ({
                ...prev,
                city: city.Description,
                cityRef: city.Ref,
                // Pick a city → discard previous warehouse, the user will pick a new one
                warehouse: "",
                warehouseRef: "",
            })),
        onWarehouseSelect: (warehouse) =>
            setCustomerInfo((prev) => ({
                ...prev,
                warehouse: warehouse.Description,
                warehouseRef: warehouse.Ref,
            })),
    });

    useEffect(() => {
        const updateItems = () => {
            setItems(StorageUtils.getCart());
            setIsLoading(false);
        };

        const authState = AuthUtils.getAuthState();
        if (authState.isAuthenticated && authState.user) {
            setCustomerInfo((prev) => ({
                ...prev,
                name: prev.name || authState.user!.name,
                email: prev.email || authState.user!.email,
                phone: prev.phone || authState.user!.phone || "",
            }));
        }

        updateItems();
        const unsub = StorageUtils.subscribeToCart(updateItems);
        return () => unsub();
    }, []);

    const updateQuantity = (id: string | number, delta: number, size?: string, color?: string) => {
        const item = items.find((i) => i.id === id && i.size === size && i.color === color);
        if (item && item.quantity + delta > 0) {
            StorageUtils.updateCartQuantity(id, delta, size, color);
        } else if (item && item.quantity + delta === 0) {
            StorageUtils.removeFromCart(id, size, color);
        }
    };

    const removeItem = (id: string | number, size?: string, color?: string) => {
        StorageUtils.removeFromCart(id, size, color);
    };

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Promo code state
    const [promoCode, setPromoCode] = useState("");
    const [promoApplied, setPromoApplied] = useState<{
        code: string;
        discountType: string;
        discountValue: number;
        minOrder: number;
    } | null>(null);
    const [promoError, setPromoError] = useState("");
    const [promoLoading, setPromoLoading] = useState(false);

    const promoDiscount = promoApplied
        ? promoApplied.discountType === "percent"
            ? Math.round((subtotal * promoApplied.discountValue) / 100)
            : Math.min(promoApplied.discountValue, subtotal)
        : 0;
    const total = subtotal - promoDiscount;

    // F-002 — funnel-step #3. Fire begin_checkout exactly once when the
    // visitor advances from "cart" to "info" (regardless of route: the
    // path is the same /checkout, only `step` changes). Putting the
    // effect on [step] keeps the firing semantics clean and idempotent.
    useEffect(() => {
        if (step !== "info") return;
        if (items.length === 0) return;
        trackBeginCheckout(
            items.map((it) => ({
                id: String(it.id),
                name: it.name,
                price: it.price,
                quantity: it.quantity,
                variant: it.size || undefined,
            })),
            total,
        );
        // total derives from items + promo — depending on `items` alone
        // is enough because moving to "info" re-runs once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const handleApplyPromo = async () => {
        if (!promoCode.trim()) return;
        setPromoLoading(true);
        setPromoError("");
        try {
            const res = await fetch(`/api/promo?code=${encodeURIComponent(promoCode.trim())}`);
            const data = await res.json();
            if (data.valid) {
                if (data.minOrder > 0 && subtotal < data.minOrder) {
                    setPromoError(
                        t("Мінімальне замовлення: {amount}", { amount: money(data.minOrder) }),
                    );
                } else {
                    setPromoApplied(data);
                    setPromoError("");
                }
            } else {
                setPromoError(data.error || t("Промокод невалідний"));
            }
        } catch {
            setPromoError(t("Помилка перевірки"));
        } finally {
            setPromoLoading(false);
        }
    };

    const handleRemovePromo = () => {
        setPromoApplied(null);
        setPromoCode("");
        setPromoError("");
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCustomerInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleDeliveryChange = (delivery: DeliveryService) => {
        setCustomerInfo((prev) => ({
            ...prev,
            delivery,
            city: "",
            cityRef: "",
            warehouse: "",
            warehouseRef: "",
        }));
        setCitySearch("");
        setWarehouseSearch("");
        // cities/warehouses arrays are owned by the hook now — they're
        // implicitly stale once `enabled` flips and get re-populated on
        // the next search when the user switches back to Nova Poshta.
    };

    const handlePaymentChange = (payment: PaymentMethod) => {
        setCustomerInfo((prev) => ({ ...prev, payment }));
    };

    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};
        if (!customerInfo.name.trim()) newErrors.name = t("Введіть ваше ім'я");
        if (!customerInfo.email.trim())
            newErrors.email = t("Введіть email для підтвердження замовлення");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email.trim()))
            newErrors.email = t("Введіть коректний email");
        if (!customerInfo.phone) newErrors.phone = t("Введіть номер телефону");
        else if (getPhoneDigits(customerInfo.phone).length < 12)
            newErrors.phone = t("Введіть коректний номер");

        if (customerInfo.delivery === "nova_poshta") {
            if (!customerInfo.cityRef) newErrors.city = t("Оберіть місто зі списку");
            if (!customerInfo.warehouseRef) newErrors.warehouse = t("Оберіть відділення зі списку");
        } else {
            if (!customerInfo.city.trim()) newErrors.city = t("Введіть місто");
            if (!customerInfo.warehouse.trim())
                newErrors.warehouse = t("Введіть адресу відділення");
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showToast(t("Будь ласка, перевірте правильність заповнення полів"), "warning");
            // After React paints the new error spans, scroll the first one
            // into view + focus the offending field so the user lands
            // directly on what to fix. requestAnimationFrame ensures the
            // DOM has the new aria-invalid + error spans before we query.
            requestAnimationFrame(() => {
                const firstErrorField = Object.keys(newErrors)[0];
                const el = document.getElementById(firstErrorField);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    (el as HTMLInputElement).focus({ preventScroll: true });
                }
            });
            return;
        }

        setErrors({});

        setIsSubmitting(true);

        // Generate (once) a stable key for this checkout attempt so a network
        // retry or accidental double-submit can't create a duplicate order.
        if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();

        try {
            const response = await fetch("/api/orders/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer: customerInfo,
                    items: items.map((item) => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        size: item.size,
                        color: item.color,
                    })),
                    total: total,
                    shippingCost: 0,
                    paymentMethod: customerInfo.payment,
                    deliveryMethod: customerInfo.delivery,
                    comment: customerInfo.comment,
                    promoCode: promoApplied?.code,
                    idempotencyKey: idempotencyKeyRef.current,
                    // Storefront language → confirmation-email language.
                    // Submit happens client-side only, so window is available.
                    locale: splitLocalePath(window.location.pathname).locale,
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Promo code usage is already incremented server-side in api.orders.create
                // Order placed — drop the key so a brand-new checkout gets a fresh one.
                idempotencyKeyRef.current = null;
                setOrderNumber(result.orderId);
                // F-002 — funnel-step #4. Fire BEFORE clearing the cart so
                // we still have the items in `items` (they go straight into
                // the GA4 e-commerce schema). Reading from the server's
                // returned orderId keeps GA's transaction_id matched to
                // what the customer sees on the confirmation screen.
                trackPurchase({
                    orderId: String(result.orderId),
                    total,
                    items: items.map((it) => ({
                        id: String(it.id),
                        name: it.name,
                        price: it.price,
                        quantity: it.quantity,
                        variant: it.size || undefined,
                    })),
                });
                StorageUtils.clearCart();
                // Reset promo state so back-navigation to /checkout doesn't
                // show stale "promo applied" UI on an empty cart.
                setPromoApplied(null);
                setPromoCode("");
                setPromoError("");
                setStep("success");
            } else {
                showToast(t("Помилка при створенні замовлення. Спробуйте ще раз."), "error");
                console.error(result.error);
            }
        } catch (error) {
            console.error("Order submit error:", error);
            showToast(t("Помилка з'єднання. Спробуйте ще раз."), "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Step indicator component
    const StepIndicator = () => (
        <div className="checkout-steps">
            <div
                className={`checkout-steps__item ${step === "cart" ? "active" : step === "info" || step === "success" ? "completed" : ""}`}
            >
                <div className="checkout-steps__circle">
                    {step === "info" || step === "success" ? (
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : (
                        "1"
                    )}
                </div>
                <span className="checkout-steps__label">{t("Кошик")}</span>
            </div>
            <div className="checkout-steps__line" />
            <div
                className={`checkout-steps__item ${step === "info" ? "active" : step === "success" ? "completed" : ""}`}
            >
                <div className="checkout-steps__circle">
                    {step === "success" ? (
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : (
                        "2"
                    )}
                </div>
                <span className="checkout-steps__label">{t("Оформлення")}</span>
            </div>
            <div className="checkout-steps__line" />
            <div className={`checkout-steps__item ${step === "success" ? "active" : ""}`}>
                <div className="checkout-steps__circle">3</div>
                <span className="checkout-steps__label">{t("Готово")}</span>
            </div>
        </div>
    );

    const Hero = ({
        title,
        subtitle,
        showBreadcrumb = true,
        breadcrumbExtra = null,
    }: {
        title: React.ReactNode;
        subtitle?: string;
        showBreadcrumb?: boolean;
        breadcrumbExtra?: React.ReactNode;
    }) => (
        <section className="checkout-hero">
            <div className="container">
                {showBreadcrumb && (
                    <nav className="breadcrumb">
                        <LLink to="/">{t("Головна")}</LLink>
                        <span>/</span>
                        <LLink to="/shop/yoga">{t("Каталог")}</LLink>
                        <span>/</span>
                        {breadcrumbExtra}
                        <span className="active">
                            {step === "cart"
                                ? t("Кошик")
                                : step === "info"
                                  ? t("Оформлення")
                                  : t("Успішно")}
                        </span>
                    </nav>
                )}
                <StepIndicator />
                <div className="checkout-hero__content">
                    <h1 className="checkout-hero__title">{title}</h1>
                    {subtitle && <p className="checkout-hero__subtitle">{subtitle}</p>}
                </div>
            </div>
        </section>
    );

    if (isLoading) {
        return (
            <main className="checkout-page">
                <div className="cart-loading">
                    <div className="cart-loading__spinner"></div>
                    <p>{t("Завантаження...")}</p>
                </div>
            </main>
        );
    }

    // SUCCESS STEP
    if (step === "success") {
        return (
            <main className="checkout-page">
                <Hero
                    title={
                        <>
                            {t("Замовлення")} <em>{t("оформлено")}</em>
                        </>
                    }
                    subtitle={t("Дякуємо, що обрали MIND BODY")}
                />
                <div className="cart-page__content">
                    <div className="container">
                        <div className="cart-success">
                            <div className="cart-success__icon">
                                <svg
                                    width="80"
                                    height="80"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h2>{t("Дякуємо за замовлення!")}</h2>
                            {/* Atom O: order number + copy-to-clipboard.  Was just
                                <strong> with no affordance — user had to manually
                                select + copy on mobile, friction. */}
                            <div className="cart-success__order-row">
                                <span className="cart-success__order-label">
                                    {t("Номер замовлення")}
                                </span>
                                <div className="cart-success__order-id">
                                    <strong>{orderNumber}</strong>
                                    <button
                                        type="button"
                                        className="cart-success__copy"
                                        onClick={() => {
                                            navigator.clipboard
                                                .writeText(orderNumber)
                                                .then(() =>
                                                    showToast(t("Номер скопійовано"), "success"),
                                                )
                                                .catch(() =>
                                                    showToast(
                                                        t("Не вдалося скопіювати"),
                                                        "warning",
                                                    ),
                                                );
                                        }}
                                        aria-label={t("Скопіювати номер замовлення")}
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.6"
                                        >
                                            <rect
                                                x="9"
                                                y="9"
                                                width="13"
                                                height="13"
                                                rx="2"
                                                ry="2"
                                            />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {customerInfo.email && (
                                <p className="cart-success__email">
                                    {t("Підтвердження надіслано на")}{" "}
                                    <strong>{customerInfo.email}</strong>
                                </p>
                            )}
                            <div className="cart-success__eta">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    aria-hidden="true"
                                >
                                    <rect x="1" y="3" width="15" height="13" />
                                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                    <circle cx="5.5" cy="18.5" r="2.5" />
                                    <circle cx="18.5" cy="18.5" r="2.5" />
                                </svg>
                                <span>
                                    {customerInfo.delivery === "nova_poshta"
                                        ? t("Доставка Новою Поштою 1-3 дні")
                                        : t("Доставка Укрпоштою 3-7 днів")}
                                </span>
                            </div>
                            <p className="cart-success__hint">
                                {t(
                                    "Ми зв'яжемося з вами найближчим часом для підтвердження деталей.",
                                )}
                            </p>
                            <div className="cart-success__ctas">
                                <LLink to="/shop/yoga" className="cart-btn cart-btn--primary">
                                    {t("До магазину")}
                                </LLink>
                                <LLink to="/" className="cart-btn cart-btn--ghost">
                                    {t("На головну")}
                                </LLink>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // EMPTY CART
    if (items.length === 0 && step === "cart") {
        return (
            <main className="checkout-page">
                <Hero
                    title={
                        <>
                            {t("Мій")} <em>{t("Кошик")}</em>
                        </>
                    }
                    subtitle={t("Ваш кошик порожній")}
                />
                <div className="cart-page__content">
                    <div className="container">
                        <div className="cart-empty">
                            <div className="cart-empty__visual">
                                <div className="cart-empty__circle">
                                    <svg
                                        width="70"
                                        height="70"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                    >
                                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                        <path d="M3 6h18" />
                                        <path d="M16 10a4 4 0 0 1-8 0" />
                                    </svg>
                                </div>
                            </div>
                            <h2>
                                {t("Ваш кошик")} <em>{t("порожній")}</em>
                            </h2>
                            <p>
                                {t("Здається, ви ще нічого не додали. Наш каталог чекає на вас!")}
                            </p>
                            <LLink
                                to="/shop/yoga"
                                className="cart-btn cart-btn--primary"
                                style={{ maxWidth: "300px", margin: "0 auto" }}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    style={{ marginRight: "10px" }}
                                >
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <path d="M16 10a4 4 0 0 1-8 0" />
                                </svg>
                                {t("Перейти до каталогу")}
                            </LLink>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // INFO STEP - Customer Form
    if (step === "info") {
        return (
            <main className="checkout-page">
                <Hero
                    title={
                        <>
                            {t("Оформлення")} <em>{t("замовлення")}</em>
                        </>
                    }
                    breadcrumbExtra={
                        <>
                            <button onClick={() => setStep("cart")}>{t("Кошик")}</button>
                            <span>/</span>
                        </>
                    }
                />
                <div className="cart-page__content">
                    <div className="container">
                        <div className="checkout-form-grid">
                            <form className="checkout-form" onSubmit={handleSubmitOrder}>
                                {/* Contact Info */}
                                <div className="form-section">
                                    <h3>{t("Контактні дані")}</h3>
                                    <div className="form-group">
                                        <label htmlFor="name">{t("Ім'я та прізвище")} *</label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={customerInfo.name}
                                            onChange={handleInputChange}
                                            placeholder={t("Ваше повне ім'я")}
                                            autoComplete="name"
                                            required
                                        />
                                        {errors.name && (
                                            <span className="field-error-text" role="alert">
                                                {errors.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email">Email *</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={customerInfo.email}
                                            onChange={handleInputChange}
                                            placeholder="olena@example.com"
                                            autoComplete="email"
                                            inputMode="email"
                                            required
                                            aria-invalid={errors.email ? "true" : undefined}
                                            aria-describedby={
                                                errors.email ? "email-error" : undefined
                                            }
                                        />
                                        {errors.email && (
                                            <span
                                                id="email-error"
                                                className="field-error-text"
                                                role="alert"
                                            >
                                                {errors.email}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="phone">{t("Телефон")} *</label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={customerInfo.phone}
                                            onChange={(e) => {
                                                const formatted = formatPhoneUA(e.target.value);
                                                setCustomerInfo((prev) => ({
                                                    ...prev,
                                                    phone: formatted,
                                                }));
                                            }}
                                            placeholder="+380 (XX) XXX-XX-XX"
                                            autoComplete="tel"
                                            inputMode="tel"
                                            required
                                        />
                                        {errors.phone && (
                                            <span className="field-error-text" role="alert">
                                                {errors.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Delivery Service Selection */}
                                <div className="form-section">
                                    <h3>{t("Спосіб доставки")}</h3>
                                    <div className="delivery-options">
                                        <label
                                            className={`delivery-option ${customerInfo.delivery === "nova_poshta" ? "active" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="delivery"
                                                value="nova_poshta"
                                                checked={customerInfo.delivery === "nova_poshta"}
                                                onChange={() => handleDeliveryChange("nova_poshta")}
                                            />
                                            <div className="delivery-option__content">
                                                <div className="delivery-option__logo nova-poshta">
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        width="32"
                                                        height="32"
                                                    >
                                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                                    </svg>
                                                </div>
                                                <div className="delivery-option__info">
                                                    <span className="delivery-option__name">
                                                        {t("Нова Пошта")}
                                                    </span>
                                                    <span className="delivery-option__desc">
                                                        {t("1-3 дні • Відділення або поштомат")}
                                                    </span>
                                                </div>
                                            </div>
                                        </label>
                                        <label
                                            className={`delivery-option ${customerInfo.delivery === "ukrposhta" ? "active" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="delivery"
                                                value="ukrposhta"
                                                checked={customerInfo.delivery === "ukrposhta"}
                                                onChange={() => handleDeliveryChange("ukrposhta")}
                                            />
                                            <div className="delivery-option__content">
                                                <div className="delivery-option__logo ukrposhta">
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        width="32"
                                                        height="32"
                                                    >
                                                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                                    </svg>
                                                </div>
                                                <div className="delivery-option__info">
                                                    <span className="delivery-option__name">
                                                        {t("Укрпошта")}
                                                    </span>
                                                    <span className="delivery-option__desc">
                                                        {t("3-7 днів • Економ варіант")}
                                                    </span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Delivery Address */}
                                <div className="form-section">
                                    <h3>{t("Адреса доставки")}</h3>

                                    {customerInfo.delivery === "nova_poshta" ? (
                                        <>
                                            {/* Nova Poshta City Search */}
                                            <div
                                                className="form-group autocomplete-wrapper"
                                                ref={cityAutocompleteRef}
                                            >
                                                <label htmlFor="city">{t("Місто")} *</label>
                                                <input
                                                    type="text"
                                                    id="city"
                                                    value={citySearch}
                                                    onChange={(e) => {
                                                        setCitySearch(e.target.value);
                                                        setShowCitiesDropdown(true);
                                                    }}
                                                    onFocus={() => setShowCitiesDropdown(true)}
                                                    placeholder={t(
                                                        "Почніть вводити назву міста...",
                                                    )}
                                                    autoComplete="off"
                                                />
                                                {errors.city && (
                                                    <span className="field-error-text" role="alert">
                                                        {errors.city}
                                                    </span>
                                                )}
                                                {showCitiesDropdown &&
                                                    (cities.length > 0 || isLoadingCities) && (
                                                        <div className="autocomplete-dropdown">
                                                            {isLoadingCities ? (
                                                                <div className="autocomplete-loading">
                                                                    {t("Пошук...")}
                                                                </div>
                                                            ) : (
                                                                cities.map((city) => (
                                                                    <button
                                                                        key={city.Ref}
                                                                        type="button"
                                                                        className="autocomplete-item"
                                                                        onClick={() =>
                                                                            selectCity(city)
                                                                        }
                                                                    >
                                                                        <span className="autocomplete-item__main">
                                                                            {city.Description}
                                                                        </span>
                                                                        <span className="autocomplete-item__sub">
                                                                            {city.AreaDescription}{" "}
                                                                            {t("обл.")}
                                                                        </span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                            </div>

                                            {/* Nova Poshta Warehouse Search */}
                                            <div
                                                className="form-group autocomplete-wrapper"
                                                ref={warehouseAutocompleteRef}
                                            >
                                                <label htmlFor="warehouse">
                                                    {t("Відділення або поштомат")} *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="warehouse"
                                                    value={warehouseSearch}
                                                    onChange={(e) => {
                                                        setWarehouseSearch(e.target.value);
                                                        setShowWarehousesDropdown(true);
                                                    }}
                                                    onFocus={() => setShowWarehousesDropdown(true)}
                                                    placeholder={
                                                        customerInfo.cityRef
                                                            ? t("Оберіть відділення...")
                                                            : t("Спочатку оберіть місто")
                                                    }
                                                    disabled={!customerInfo.cityRef}
                                                    autoComplete="off"
                                                />
                                                {errors.warehouse && (
                                                    <span className="field-error-text" role="alert">
                                                        {errors.warehouse}
                                                    </span>
                                                )}
                                                {showWarehousesDropdown &&
                                                    customerInfo.cityRef &&
                                                    (warehouses.length > 0 ||
                                                        isLoadingWarehouses) && (
                                                        <div className="autocomplete-dropdown">
                                                            {isLoadingWarehouses ? (
                                                                <div className="autocomplete-loading">
                                                                    {t("Пошук відділень...")}
                                                                </div>
                                                            ) : (
                                                                warehouses.map((warehouse) => (
                                                                    <button
                                                                        key={warehouse.Ref}
                                                                        type="button"
                                                                        className="autocomplete-item"
                                                                        onClick={() =>
                                                                            selectWarehouse(
                                                                                warehouse,
                                                                            )
                                                                        }
                                                                    >
                                                                        <span className="autocomplete-item__main">
                                                                            {warehouse.Description}
                                                                        </span>
                                                                        <span className="autocomplete-item__sub">
                                                                            {warehouse.ShortAddress}
                                                                        </span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Ukrposhta - Manual input */}
                                            <div className="form-group">
                                                <label htmlFor="city-ukr">{t("Місто")} *</label>
                                                <input
                                                    type="text"
                                                    id="city-ukr"
                                                    value={customerInfo.city}
                                                    onChange={(e) =>
                                                        setCustomerInfo((prev) => ({
                                                            ...prev,
                                                            city: e.target.value,
                                                        }))
                                                    }
                                                    placeholder={t("Введіть назву міста")}
                                                />
                                                {errors.city && (
                                                    <span className="field-error-text" role="alert">
                                                        {errors.city}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="warehouse-ukr">
                                                    {t("Адреса відділення або індекс")} *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="warehouse-ukr"
                                                    value={customerInfo.warehouse}
                                                    onChange={(e) =>
                                                        setCustomerInfo((prev) => ({
                                                            ...prev,
                                                            warehouse: e.target.value,
                                                        }))
                                                    }
                                                    placeholder={t("вул. Хрещатик, 1 або 01001")}
                                                />
                                                {errors.warehouse && (
                                                    <span className="field-error-text" role="alert">
                                                        {errors.warehouse}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Payment Options */}
                                <div className="form-section">
                                    <h3>{t("Спосіб оплати")}</h3>
                                    <div className="payment-options">
                                        {/* COD is the only working method right now. Online
                                            payment (card/Apple/Google Pay) had selectable radios
                                            that did NOTHING — the order saved as paymentStatus
                                            "pending" with no charge and no error, so customers
                                            thought they'd paid. Until an acquirer is wired, offer
                                            only Cash-on-Delivery + an honest "coming soon" note. */}
                                        <label className="payment-option active">
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="cash"
                                                checked={customerInfo.payment === "cash"}
                                                onChange={() => handlePaymentChange("cash")}
                                            />
                                            <div className="payment-option__content">
                                                <svg
                                                    className="payment-icon cash"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    width="28"
                                                    height="28"
                                                >
                                                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                                </svg>
                                                <span>
                                                    {t("Накладений платіж (оплата при отриманні)")}
                                                </span>
                                            </div>
                                        </label>

                                        {/* F-039 — removed the «Оплата карткою онлайн —
                                            скоро» disabled placeholder. Showing a payment
                                            method that doesn't work at the most trust-
                                            sensitive point of the funnel reads as
                                            "site under construction" right before the
                                            money decision. It comes back the day acquiring
                                            actually goes live. */}
                                    </div>
                                </div>

                                {/* Comment */}
                                <div className="form-section">
                                    <h3>{t("Коментар до замовлення")}</h3>
                                    <div className="form-group">
                                        <label htmlFor="comment" className="visually-hidden">
                                            {t("Коментар до замовлення")}
                                        </label>
                                        <textarea
                                            id="comment"
                                            name="comment"
                                            value={customerInfo.comment}
                                            onChange={handleInputChange}
                                            placeholder={t("Додаткові побажання...")}
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="cart-btn cart-btn--primary cart-btn--full"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting
                                        ? t("Відправляємо...")
                                        : t("Підтвердити замовлення")}
                                </button>
                            </form>

                            <div className="checkout-sidebar checkout-sidebar--sticky">
                                <div className="order-summary">
                                    <h3>{t("Ваше замовлення")}</h3>
                                    <div className="order-items">
                                        {items.map((item) => (
                                            <div
                                                key={`${item.id}-${item.size ?? ""}-${item.color ?? ""}`}
                                                className="order-item"
                                            >
                                                {/* width/height set so the browser reserves the
                                                    layout space before the image arrives — kills CLS.
                                                    Square because our CSS uses object-fit: cover on
                                                    .order-item img. */}
                                                <img
                                                    src={productImageSrc(item.image)}
                                                    onError={(e) => {
                                                        e.currentTarget.src = IMAGE_FALLBACK;
                                                    }}
                                                    alt={item.name}
                                                    width="80"
                                                    height="80"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                                <div className="order-item__info">
                                                    <span className="order-item__name">
                                                        {item.name}
                                                    </span>
                                                    <span className="order-item__meta">
                                                        {item.size} • {item.quantity} {t("шт")}
                                                    </span>
                                                </div>
                                                <span className="order-item__price">
                                                    {money(item.price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="order-totals">
                                        <div className="order-row">
                                            <span>{t("Товари")}</span>
                                            <span>{money(subtotal)}</span>
                                        </div>
                                        {/* F-036 — same shipping logic as the cart-step
                                            summary; the buyer is past the cart but still
                                            needs the threshold reminder + concrete range. */}
                                        <div className="order-row">
                                            <span>{t("Доставка@@totals")}</span>
                                            <span>
                                                {subtotal >= 2000
                                                    ? t("Безкоштовно ✓")
                                                    : t("≈70–120 ₴ (Нова Пошта)")}
                                            </span>
                                        </div>
                                        <div className="order-row total">
                                            <span>{t("Разом")}</span>
                                            <span>{money(total)}</span>
                                        </div>
                                        {locale !== "uk" && (
                                            <p
                                                className="checkout-uah-note"
                                                style={{
                                                    fontSize: "12px",
                                                    color: "var(--color-text-secondary, #777)",
                                                    margin: "6px 0 0",
                                                }}
                                            >
                                                {t("Оплата здійснюється у гривні — {amount}", {
                                                    amount: `${formatPrice(total)} ₴`,
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // CART STEP - Main Cart View
    const cartQty = items.reduce((a, b) => a + b.quantity, 0);
    return (
        <main className="checkout-page">
            <Hero
                title={
                    <>
                        {t("Мій")} <em>{t("Кошик")}</em>
                    </>
                }
                subtitle={`${cartQty} ${plural(locale, cartQty, "товар", "товари", "товарів")} ${t("у списку")}`}
            />
            <div className="cart-page__content">
                <div className="container">
                    <div className="cart-grid">
                        <div className="cart-items">
                            {items.map((item) => (
                                <div
                                    key={`${item.id}-${item.size ?? ""}-${item.color ?? ""}`}
                                    className="cart-item"
                                >
                                    <div className="cart-item__image">
                                        <img
                                            src={productImageSrc(item.image)}
                                            onError={(e) => {
                                                e.currentTarget.src = IMAGE_FALLBACK;
                                            }}
                                            alt={item.name}
                                        />
                                    </div>
                                    <div className="cart-item__body">
                                        <div className="cart-item__top">
                                            <h3>{item.name}</h3>
                                            <button
                                                className="cart-item__delete"
                                                onClick={() =>
                                                    removeItem(item.id, item.size, item.color)
                                                }
                                            >
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="cart-item__details">
                                            {item.size && (
                                                <span>
                                                    {t("Розмір:")} <strong>{item.size}</strong>
                                                </span>
                                            )}
                                            {item.color && (
                                                <span>
                                                    {t("Колір:")} <strong>{item.color}</strong>
                                                </span>
                                            )}
                                        </div>
                                        <div className="cart-item__bottom">
                                            <div className="cart-qty">
                                                <button
                                                    onClick={() =>
                                                        updateQuantity(
                                                            item.id,
                                                            -1,
                                                            item.size,
                                                            item.color,
                                                        )
                                                    }
                                                >
                                                    −
                                                </button>
                                                <span>{item.quantity}</span>
                                                <button
                                                    onClick={() =>
                                                        updateQuantity(
                                                            item.id,
                                                            1,
                                                            item.size,
                                                            item.color,
                                                        )
                                                    }
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <div className="cart-item__price">
                                                {money(item.price * item.quantity)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="checkout-trust-premium">
                                <div className="trust-card-premium">
                                    <div className="trust-card-premium__icon">
                                        <svg
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        >
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                    </div>
                                    <span>{t("Безпечна оплата")}</span>
                                </div>
                                <div className="trust-card-premium">
                                    <div className="trust-card-premium__icon">
                                        <svg
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        >
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                    </div>
                                    <span>{t("Доставка по Україні")}</span>
                                </div>
                                <div className="trust-card-premium">
                                    <div className="trust-card-premium__icon">
                                        <svg
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        >
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <span>{t("Підтримка у месенджерах")}</span>
                                </div>
                            </div>
                        </div>

                        <div className="cart-summary">
                            <div className="cart-summary__card">
                                <h3>{t("Підсумок")}</h3>
                                <div className="summary-lines">
                                    <div className="summary-line">
                                        <span>
                                            {t("Товари")} ({cartQty})
                                        </span>
                                        <span>{money(subtotal)}</span>
                                    </div>
                                    {/* Phase 6 atom 4 — free-shipping nudge.
                                        Mirrors the cart-drawer pattern at
                                        FREE_SHIPPING=2000.  Disappears once
                                        the threshold is met. */}
                                    {(() => {
                                        const FREE_SHIPPING = 2000;
                                        const remaining = Math.max(0, FREE_SHIPPING - subtotal);
                                        const progress = Math.min(
                                            100,
                                            (subtotal / FREE_SHIPPING) * 100,
                                        );
                                        return remaining > 0 ? (
                                            <div className="shipping-progress">
                                                <div className="shipping-progress__bar">
                                                    <div
                                                        className="shipping-progress__fill"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span>
                                                    {t("До безкоштовної доставки ще")}{" "}
                                                    <strong>{money(remaining)}</strong>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="shipping-progress shipping-progress--free">
                                                <span>{t("🎉 Безкоштовна доставка!")}</span>
                                            </div>
                                        );
                                    })()}
                                    {/* F-036 — single source of truth for shipping line.
                                        Above-threshold: matches the green nudge above ("free");
                                        below: names a concrete UAH range so the buyer knows what
                                        they will pay (Baymard: unexpected shipping cost = #1
                                        cart-abandonment driver). The number is Nova Poshta's
                                        typical city→city box price, not a fixed promise — see
                                        /delivery for context. */}
                                    <div className="summary-line">
                                        <span>{t("Доставка@@totals")}</span>
                                        <span>
                                            {subtotal >= 2000
                                                ? t("Безкоштовно ✓")
                                                : t("≈70–120 ₴ (Нова Пошта)")}
                                        </span>
                                    </div>
                                    {promoApplied && (
                                        <div className="summary-line" style={{ color: "#10b981" }}>
                                            <span>🏷️ {promoApplied.code}</span>
                                            <span>-{money(promoDiscount)}</span>
                                        </div>
                                    )}
                                    {!promoApplied && (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "8px",
                                                marginTop: "8px",
                                            }}
                                        >
                                            <input
                                                type="text"
                                                value={promoCode}
                                                onChange={(e) =>
                                                    setPromoCode(e.target.value.toUpperCase())
                                                }
                                                placeholder={t("Промокод")}
                                                style={{
                                                    flex: 1,
                                                    padding: "8px 12px",
                                                    border: "1px solid #e0e0e0",
                                                    borderRadius: "8px",
                                                    fontSize: "13px",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                }}
                                            />
                                            <button
                                                onClick={handleApplyPromo}
                                                disabled={promoLoading || !promoCode.trim()}
                                                style={{
                                                    padding: "8px 16px",
                                                    background: "var(--color-primary, #2a5a5a)",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: "8px",
                                                    fontSize: "13px",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    opacity:
                                                        promoLoading || !promoCode.trim() ? 0.5 : 1,
                                                }}
                                            >
                                                {promoLoading ? "..." : t("Застосувати")}
                                            </button>
                                        </div>
                                    )}
                                    {promoApplied && (
                                        <button
                                            onClick={handleRemovePromo}
                                            style={{
                                                marginTop: "4px",
                                                background: "none",
                                                border: "none",
                                                color: "#ef4444",
                                                fontSize: "12px",
                                                cursor: "pointer",
                                                padding: "4px 0",
                                            }}
                                        >
                                            {t("✕ Видалити промокод")}
                                        </button>
                                    )}
                                    {promoError && (
                                        <div
                                            style={{
                                                color: "#ef4444",
                                                fontSize: "12px",
                                                marginTop: "4px",
                                            }}
                                        >
                                            {promoError}
                                        </div>
                                    )}
                                </div>
                                <div className="summary-total">
                                    <span>{t("Разом:")}</span>
                                    <span>{money(total)}</span>
                                </div>
                                {locale !== "uk" && (
                                    <p
                                        className="checkout-uah-note"
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--color-text-secondary, #777)",
                                            margin: "6px 0 0",
                                        }}
                                    >
                                        {t("Оплата здійснюється у гривні — {amount}", {
                                            amount: `${formatPrice(total)} ₴`,
                                        })}
                                    </p>
                                )}
                                <button
                                    className="cart-btn cart-btn--primary cart-btn--full"
                                    onClick={() => setStep("info")}
                                >
                                    {t("Оформити замовлення")}
                                </button>
                                <LLink
                                    to="/shop/yoga"
                                    className="cart-btn cart-btn--ghost cart-btn--full"
                                >
                                    {t("Продовжити покупки")}
                                </LLink>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
