import { Link } from "react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { StorageUtils, type CartItem } from "../utils/storage";
import { AuthUtils } from "../utils/auth";
import { useToast } from "../components/Toast";

export function meta() {
    return [
        { title: "Кошик | MIND BODY" },
        { name: "description", content: "Оформіть замовлення спортивного одягу MIND BODY. Швидка доставка по Україні." },
    ];
}

// Telegram messages are sent via server-side API route (token is NOT in client code)

// Nova Poshta API (using server-side route to avoid CORS)
const NOVA_POSHTA_API_ROUTE = "/api/novaposhta";

type CheckoutStep = 'cart' | 'info' | 'success';
type PaymentMethod = 'cash' | 'card' | 'apple_pay' | 'google_pay';
type DeliveryService = 'nova_poshta' | 'ukrposhta';

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

interface NovaPoshtaCity {
    Ref: string;
    Description: string;
    AreaDescription: string;
}

interface NovaPoshtaWarehouse {
    Ref: string;
    Description: string;
    Number: string;
    ShortAddress: string;
}

// Phone formatting helper: +380 (XX) XXX-XX-XX
function formatPhoneUA(value: string): string {
    const digits = value.replace(/\D/g, '');
    // Ensure starts with 380
    let d = digits;
    if (d.startsWith('380')) d = d;
    else if (d.startsWith('80')) d = '3' + d;
    else if (d.startsWith('0')) d = '38' + d;
    else if (!d.startsWith('3')) d = '380' + d;

    // Build formatted string
    let result = '+380';
    const rest = d.slice(3);
    if (rest.length > 0) result += ' (' + rest.slice(0, 2);
    if (rest.length >= 2) result += ') ';
    if (rest.length > 2) result += rest.slice(2, 5);
    if (rest.length > 5) result += '-' + rest.slice(5, 7);
    if (rest.length > 7) result += '-' + rest.slice(7, 9);
    return result;
}

function getPhoneDigits(formatted: string): string {
    return formatted.replace(/\D/g, '');
}

export default function Checkout() {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [step, setStep] = useState<CheckoutStep>('cart');
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderNumber, setOrderNumber] = useState('');

    // Nova Poshta states
    const [cities, setCities] = useState<NovaPoshtaCity[]>([]);
    const [warehouses, setWarehouses] = useState<NovaPoshtaWarehouse[]>([]);
    const [citySearch, setCitySearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [showCitiesDropdown, setShowCitiesDropdown] = useState(false);
    const [showWarehousesDropdown, setShowWarehousesDropdown] = useState(false);
    const [isLoadingCities, setIsLoadingCities] = useState(false);
    const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

    // Refs for click-outside detection
    const cityAutocompleteRef = useRef<HTMLDivElement>(null);
    const warehouseAutocompleteRef = useRef<HTMLDivElement>(null);

    const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
        name: '',
        email: '',
        phone: '',
        city: '',
        cityRef: '',
        warehouse: '',
        warehouseRef: '',
        comment: '',
        payment: 'cash',
        delivery: 'nova_poshta'
    });

    useEffect(() => {
        const updateItems = () => {
            setItems(StorageUtils.getCart());
            setIsLoading(false);
        };

        const authState = AuthUtils.getAuthState();
        if (authState.isAuthenticated && authState.user) {
            setCustomerInfo(prev => ({
                ...prev,
                name: prev.name || authState.user!.name,
                email: prev.email || authState.user!.email,
                phone: prev.phone || authState.user!.phone || ''
            }));
        }

        updateItems();
        const unsub = StorageUtils.subscribeToCart(updateItems);
        return () => unsub();
    }, []);

    // Search cities via Nova Poshta API (server-side)
    const searchCities = useCallback(async (query: string) => {
        if (query.length < 2) {
            setCities([]);
            return;
        }

        setIsLoadingCities(true);
        try {
            const formData = new FormData();
            formData.append('action', 'searchCities');
            formData.append('query', query);

            const response = await fetch(NOVA_POSHTA_API_ROUTE, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                setCities(data.data || []);
                setShowCitiesDropdown(true);
            } else {
                console.error('Nova Poshta API error:', data.error);
                setCities([]);
            }
        } catch (error) {
            console.error('Nova Poshta API error:', error);
            setCities([]);
        } finally {
            setIsLoadingCities(false);
        }
    }, []);

    // Search warehouses via Nova Poshta API (server-side)
    const searchWarehouses = useCallback(async (cityRef: string, query: string = '') => {
        if (!cityRef) {
            setWarehouses([]);
            return;
        }

        setIsLoadingWarehouses(true);
        try {
            const formData = new FormData();
            formData.append('action', 'getWarehouses');
            formData.append('cityRef', cityRef);
            formData.append('query', query);

            const response = await fetch(NOVA_POSHTA_API_ROUTE, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                setWarehouses(data.data || []);
                setShowWarehousesDropdown(true);
            } else {
                console.error('Nova Poshta API error:', data.error);
                setWarehouses([]);
            }
        } catch (error) {
            console.error('Nova Poshta API error:', error);
            setWarehouses([]);
        } finally {
            setIsLoadingWarehouses(false);
        }
    }, []);

    // Debounced city search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (citySearch && customerInfo.delivery === 'nova_poshta') {
                searchCities(citySearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [citySearch, searchCities, customerInfo.delivery]);

    // Debounced warehouse search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (customerInfo.cityRef && customerInfo.delivery === 'nova_poshta') {
                searchWarehouses(customerInfo.cityRef, warehouseSearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [warehouseSearch, customerInfo.cityRef, searchWarehouses, customerInfo.delivery]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Close city dropdown if clicking outside
            if (cityAutocompleteRef.current && !cityAutocompleteRef.current.contains(event.target as Node)) {
                setShowCitiesDropdown(false);
            }
            // Close warehouse dropdown if clicking outside
            if (warehouseAutocompleteRef.current && !warehouseAutocompleteRef.current.contains(event.target as Node)) {
                setShowWarehousesDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectCity = (city: NovaPoshtaCity) => {
        setCustomerInfo(prev => ({
            ...prev,
            city: city.Description,
            cityRef: city.Ref,
            warehouse: '',
            warehouseRef: ''
        }));
        setCitySearch(city.Description);
        setShowCitiesDropdown(false);
        setWarehouses([]);
        searchWarehouses(city.Ref);
    };

    const selectWarehouse = (warehouse: NovaPoshtaWarehouse) => {
        setCustomerInfo(prev => ({
            ...prev,
            warehouse: warehouse.Description,
            warehouseRef: warehouse.Ref
        }));
        setWarehouseSearch(warehouse.Description);
        setShowWarehousesDropdown(false);
    };

    const updateQuantity = (id: string | number, delta: number, size?: string, color?: string) => {
        const item = items.find(i => i.id === id && i.size === size && i.color === color);
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
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState<{ code: string; discountType: string; discountValue: number; minOrder: number } | null>(null);
    const [promoError, setPromoError] = useState('');
    const [promoLoading, setPromoLoading] = useState(false);

    const promoDiscount = promoApplied
        ? promoApplied.discountType === 'percent'
            ? Math.round(subtotal * promoApplied.discountValue / 100)
            : Math.min(promoApplied.discountValue, subtotal)
        : 0;
    const total = subtotal - promoDiscount;

    const handleApplyPromo = async () => {
        if (!promoCode.trim()) return;
        setPromoLoading(true);
        setPromoError('');
        try {
            const res = await fetch(`/api/promo?code=${encodeURIComponent(promoCode.trim())}`);
            const data = await res.json();
            if (data.valid) {
                if (data.minOrder > 0 && subtotal < data.minOrder) {
                    setPromoError(`Мінімальне замовлення: ${data.minOrder} ₴`);
                } else {
                    setPromoApplied(data);
                    setPromoError('');
                }
            } else {
                setPromoError(data.error || 'Промокод невалідний');
            }
        } catch {
            setPromoError('Помилка перевірки');
        } finally {
            setPromoLoading(false);
        }
    };

    const handleRemovePromo = () => {
        setPromoApplied(null);
        setPromoCode('');
        setPromoError('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCustomerInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleDeliveryChange = (delivery: DeliveryService) => {
        setCustomerInfo(prev => ({
            ...prev,
            delivery,
            city: '',
            cityRef: '',
            warehouse: '',
            warehouseRef: ''
        }));
        setCitySearch('');
        setWarehouseSearch('');
        setCities([]);
        setWarehouses([]);
    };

    const handlePaymentChange = (payment: PaymentMethod) => {
        setCustomerInfo(prev => ({ ...prev, payment }));
    };


    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!customerInfo.name || !customerInfo.phone || !customerInfo.city || !customerInfo.warehouse) {
            showToast('Будь ласка, заповніть всі обов\'язкові поля', 'warning');
            return;
        }

        // Phone validation: must have 12 digits (380XXXXXXXXX)
        const phoneDigits = getPhoneDigits(customerInfo.phone);
        if (phoneDigits.length < 12) {
            showToast('Введіть коректний номер телефону', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer: customerInfo,
                    items: items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        size: item.size,
                        color: item.color
                    })),
                    total: total,
                    shippingCost: 0,
                    paymentMethod: customerInfo.payment,
                    deliveryMethod: customerInfo.delivery,
                    comment: customerInfo.comment,
                    promoCode: promoApplied?.code
                })
            });

            const result = await response.json();

            if (result.success) {
                // Promo code usage is already incremented server-side in api.orders.create
                setOrderNumber(result.orderId);
                StorageUtils.clearCart();
                setStep('success');
            } else {
                showToast('Помилка при створенні замовлення. Спробуйте ще раз.', 'error');
                console.error(result.error);
            }
        } catch (error) {
            console.error('Order submit error:', error);
            showToast('Помилка з\'єднання. Спробуйте ще раз.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Step indicator component
    const StepIndicator = () => (
        <div className="checkout-steps">
            <div className={`checkout-steps__item ${step === 'cart' ? 'active' : (step === 'info' || step === 'success') ? 'completed' : ''}`}>
                <div className="checkout-steps__circle">
                    {step === 'info' || step === 'success' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : '1'}
                </div>
                <span className="checkout-steps__label">Кошик</span>
            </div>
            <div className="checkout-steps__line" />
            <div className={`checkout-steps__item ${step === 'info' ? 'active' : step === 'success' ? 'completed' : ''}`}>
                <div className="checkout-steps__circle">
                    {step === 'success' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : '2'}
                </div>
                <span className="checkout-steps__label">Оформлення</span>
            </div>
            <div className="checkout-steps__line" />
            <div className={`checkout-steps__item ${step === 'success' ? 'active' : ''}`}>
                <div className="checkout-steps__circle">3</div>
                <span className="checkout-steps__label">Готово</span>
            </div>
        </div>
    );

    const Hero = ({ title, subtitle, showBreadcrumb = true, breadcrumbExtra = null }: { title: React.ReactNode, subtitle?: string, showBreadcrumb?: boolean, breadcrumbExtra?: React.ReactNode }) => (
        <section className="checkout-hero">
            <div className="container">
                {showBreadcrumb && (
                    <nav className="breadcrumb">
                        <Link to="/">Головна</Link>
                        <span>/</span>
                        <Link to="/shop/women">Каталог</Link>
                        <span>/</span>
                        {breadcrumbExtra}
                        <span className="active">{step === 'cart' ? 'Кошик' : step === 'info' ? 'Оформлення' : 'Успішно'}</span>
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
                    <p>Завантаження...</p>
                </div>
            </main>
        );
    }

    // SUCCESS STEP
    if (step === 'success') {
        return (
            <main className="checkout-page">
                <Hero title={<>Замовлення <em>оформлено</em></>} subtitle="Дякуємо, що обрали MIND BODY" />
                <div className="cart-page__content">
                    <div className="container">
                        <div className="cart-success">
                            <div className="cart-success__icon">
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h2>Дякуємо за замовлення!</h2>
                            <p className="cart-success__order">Номер замовлення: <strong>{orderNumber}</strong></p>
                            <p>Ми зв'яжемося з вами найближчим часом для підтвердження деталей доставки.</p>
                            <Link to="/" className="cart-btn cart-btn--primary" style={{ maxWidth: '300px', margin: '0 auto' }}>
                                Повернутися на головну
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // EMPTY CART
    if (items.length === 0 && step === 'cart') {
        return (
            <main className="checkout-page">
                <Hero title={<>Мій <em>Кошик</em></>} subtitle="Ваш кошик порожній" />
                <div className="cart-page__content">
                    <div className="container">
                        <div className="cart-empty">
                            <div className="cart-empty__visual">
                                <div className="cart-empty__circle">
                                    <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                        <path d="M3 6h18" />
                                        <path d="M16 10a4 4 0 0 1-8 0" />
                                    </svg>
                                </div>
                            </div>
                            <h2>Ваш кошик <em>порожній</em></h2>
                            <p>Здається, ви ще нічого не додали. Наш каталог чекає на вас!</p>
                            <Link to="/shop/women" className="cart-btn cart-btn--primary" style={{ maxWidth: '300px', margin: '0 auto' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px' }}>
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <path d="M16 10a4 4 0 0 1-8 0" />
                                </svg>
                                Перейти до каталогу
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // INFO STEP - Customer Form
    if (step === 'info') {
        return (
            <main className="checkout-page">
                <Hero
                    title={<>Оформлення <em>замовлення</em></>}
                    breadcrumbExtra={<><button onClick={() => setStep('cart')}>Кошик</button><span>/</span></>}
                />
                <div className="cart-page__content">
                    <div className="container">
                        <div className="checkout-form-grid">
                            <form className="checkout-form" onSubmit={handleSubmitOrder}>
                                {/* Contact Info */}
                                <div className="form-section">
                                    <h3>Контактні дані</h3>
                                    <div className="form-group">
                                        <label htmlFor="name">Ім'я та прізвище *</label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={customerInfo.name}
                                            onChange={handleInputChange}
                                            placeholder="Олена Шевченко"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email">Email <span style={{ color: '#999', fontWeight: 400 }}>(необов'язково)</span></label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={customerInfo.email}
                                            onChange={handleInputChange}
                                            placeholder="olena@example.com"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="phone">Телефон *</label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={customerInfo.phone}
                                            onChange={(e) => {
                                                const formatted = formatPhoneUA(e.target.value);
                                                setCustomerInfo(prev => ({ ...prev, phone: formatted }));
                                            }}
                                            placeholder="+380 (XX) XXX-XX-XX"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Delivery Service Selection */}
                                <div className="form-section">
                                    <h3>Спосіб доставки</h3>
                                    <div className="delivery-options">
                                        <label className={`delivery-option ${customerInfo.delivery === 'nova_poshta' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="delivery"
                                                value="nova_poshta"
                                                checked={customerInfo.delivery === 'nova_poshta'}
                                                onChange={() => handleDeliveryChange('nova_poshta')}
                                            />
                                            <div className="delivery-option__content">
                                                <div className="delivery-option__logo nova-poshta">
                                                    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                                    </svg>
                                                </div>
                                                <div className="delivery-option__info">
                                                    <span className="delivery-option__name">Нова Пошта</span>
                                                    <span className="delivery-option__desc">1-3 дні • Відділення або поштомат</span>
                                                </div>
                                            </div>
                                        </label>
                                        <label className={`delivery-option ${customerInfo.delivery === 'ukrposhta' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="delivery"
                                                value="ukrposhta"
                                                checked={customerInfo.delivery === 'ukrposhta'}
                                                onChange={() => handleDeliveryChange('ukrposhta')}
                                            />
                                            <div className="delivery-option__content">
                                                <div className="delivery-option__logo ukrposhta">
                                                    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                                    </svg>
                                                </div>
                                                <div className="delivery-option__info">
                                                    <span className="delivery-option__name">Укрпошта</span>
                                                    <span className="delivery-option__desc">3-7 днів • Економ варіант</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Delivery Address */}
                                <div className="form-section">
                                    <h3>Адреса доставки</h3>

                                    {customerInfo.delivery === 'nova_poshta' ? (
                                        <>
                                            {/* Nova Poshta City Search */}
                                            <div className="form-group autocomplete-wrapper" ref={cityAutocompleteRef}>
                                                <label htmlFor="city">Місто *</label>
                                                <input
                                                    type="text"
                                                    id="city"
                                                    value={citySearch}
                                                    onChange={(e) => {
                                                        setCitySearch(e.target.value);
                                                        setShowCitiesDropdown(true);
                                                    }}
                                                    onFocus={() => setShowCitiesDropdown(true)}
                                                    placeholder="Почніть вводити назву міста..."
                                                    autoComplete="off"
                                                    required
                                                />
                                                {showCitiesDropdown && (cities.length > 0 || isLoadingCities) && (
                                                    <div className="autocomplete-dropdown">
                                                        {isLoadingCities ? (
                                                            <div className="autocomplete-loading">Пошук...</div>
                                                        ) : (
                                                            cities.map(city => (
                                                                <button
                                                                    key={city.Ref}
                                                                    type="button"
                                                                    className="autocomplete-item"
                                                                    onClick={() => selectCity(city)}
                                                                >
                                                                    <span className="autocomplete-item__main">{city.Description}</span>
                                                                    <span className="autocomplete-item__sub">{city.AreaDescription} обл.</span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Nova Poshta Warehouse Search */}
                                            <div className="form-group autocomplete-wrapper" ref={warehouseAutocompleteRef}>
                                                <label htmlFor="warehouse">Відділення або поштомат *</label>
                                                <input
                                                    type="text"
                                                    id="warehouse"
                                                    value={warehouseSearch}
                                                    onChange={(e) => {
                                                        setWarehouseSearch(e.target.value);
                                                        setShowWarehousesDropdown(true);
                                                    }}
                                                    onFocus={() => setShowWarehousesDropdown(true)}
                                                    placeholder={customerInfo.cityRef ? "Оберіть відділення..." : "Спочатку оберіть місто"}
                                                    disabled={!customerInfo.cityRef}
                                                    autoComplete="off"
                                                    required
                                                />
                                                {showWarehousesDropdown && customerInfo.cityRef && (warehouses.length > 0 || isLoadingWarehouses) && (
                                                    <div className="autocomplete-dropdown">
                                                        {isLoadingWarehouses ? (
                                                            <div className="autocomplete-loading">Пошук відділень...</div>
                                                        ) : (
                                                            warehouses.map(warehouse => (
                                                                <button
                                                                    key={warehouse.Ref}
                                                                    type="button"
                                                                    className="autocomplete-item"
                                                                    onClick={() => selectWarehouse(warehouse)}
                                                                >
                                                                    <span className="autocomplete-item__main">{warehouse.Description}</span>
                                                                    <span className="autocomplete-item__sub">{warehouse.ShortAddress}</span>
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
                                                <label htmlFor="city-ukr">Місто *</label>
                                                <input
                                                    type="text"
                                                    id="city-ukr"
                                                    value={customerInfo.city}
                                                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, city: e.target.value }))}
                                                    placeholder="Введіть назву міста"
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="warehouse-ukr">Адреса відділення або індекс *</label>
                                                <input
                                                    type="text"
                                                    id="warehouse-ukr"
                                                    value={customerInfo.warehouse}
                                                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, warehouse: e.target.value }))}
                                                    placeholder="вул. Хрещатик, 1 або 01001"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Payment Options */}
                                <div className="form-section">
                                    <h3>Спосіб оплати</h3>
                                    <div className="payment-options">
                                        <label className={`payment-option ${customerInfo.payment === 'apple_pay' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="apple_pay"
                                                checked={customerInfo.payment === 'apple_pay'}
                                                onChange={() => handlePaymentChange('apple_pay')}
                                            />
                                            <div className="payment-option__content">
                                                <svg className="payment-icon apple-pay" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                                                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                                </svg>
                                                <span>Apple Pay</span>
                                            </div>
                                        </label>

                                        <label className={`payment-option ${customerInfo.payment === 'google_pay' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="google_pay"
                                                checked={customerInfo.payment === 'google_pay'}
                                                onChange={() => handlePaymentChange('google_pay')}
                                            />
                                            <div className="payment-option__content">
                                                <svg className="payment-icon google-pay" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                                                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                                                </svg>
                                                <span>Google Pay</span>
                                            </div>
                                        </label>

                                        <label className={`payment-option ${customerInfo.payment === 'card' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="card"
                                                checked={customerInfo.payment === 'card'}
                                                onChange={() => handlePaymentChange('card')}
                                            />
                                            <div className="payment-option__content">
                                                <svg className="payment-icon card" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                                    <line x1="1" y1="10" x2="23" y2="10" />
                                                </svg>
                                                <span>Картка Visa / Mastercard</span>
                                            </div>
                                        </label>

                                        <label className={`payment-option ${customerInfo.payment === 'cash' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="cash"
                                                checked={customerInfo.payment === 'cash'}
                                                onChange={() => handlePaymentChange('cash')}
                                            />
                                            <div className="payment-option__content">
                                                <svg className="payment-icon cash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                                                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                                </svg>
                                                <span>Накладений платіж</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Comment */}
                                <div className="form-section">
                                    <h3>Коментар до замовлення</h3>
                                    <div className="form-group">
                                        <textarea
                                            id="comment"
                                            name="comment"
                                            value={customerInfo.comment}
                                            onChange={handleInputChange}
                                            placeholder="Додаткові побажання..."
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="cart-btn cart-btn--primary cart-btn--full"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Відправляємо...' : 'Підтвердити замовлення'}
                                </button>
                            </form>

                            <div className="checkout-sidebar checkout-sidebar--sticky">
                                <div className="order-summary">
                                    <h3>Ваше замовлення</h3>
                                    <div className="order-items">
                                        {items.map(item => (
                                            <div key={`${item.id}-${item.size}`} className="order-item">
                                                <img src={item.image} alt={item.name} />
                                                <div className="order-item__info">
                                                    <span className="order-item__name">{item.name}</span>
                                                    <span className="order-item__meta">{item.size} • {item.quantity} шт</span>
                                                </div>
                                                <span className="order-item__price">{(item.price * item.quantity).toLocaleString()} ₴</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="order-totals">
                                        <div className="order-row">
                                            <span>Товари</span>
                                            <span>{subtotal.toLocaleString()} ₴</span>
                                        </div>
                                        <div className="order-row">
                                            <span>Доставка</span>
                                            <span>
                                                За тарифами перевізника
                                            </span>
                                        </div>
                                        <div className="order-row total">
                                            <span>Разом</span>
                                            <span>{total.toLocaleString()} ₴</span>
                                        </div>
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
    return (
        <main className="checkout-page">
            <Hero title={<>Мій <em>Кошик</em></>} subtitle={`${items.reduce((a, b) => a + b.quantity, 0)} товарів у списку`} />
            <div className="cart-page__content">
                <div className="container">
                    <div className="cart-grid">
                        <div className="cart-items">
                            {items.map(item => (
                                <div key={`${item.id}-${item.size}`} className="cart-item">
                                    <div className="cart-item__image">
                                        <img src={item.image} alt={item.name} />
                                    </div>
                                    <div className="cart-item__body">
                                        <div className="cart-item__top">
                                            <h3>{item.name}</h3>
                                            <button
                                                className="cart-item__delete"
                                                onClick={() => removeItem(item.id, item.size, item.color)}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="cart-item__details">
                                            {item.size && <span>Розмір: <strong>{item.size}</strong></span>}
                                            {item.color && <span>Колір: <strong>{item.color}</strong></span>}
                                        </div>
                                        <div className="cart-item__bottom">
                                            <div className="cart-qty">
                                                <button onClick={() => updateQuantity(item.id, -1, item.size, item.color)}>−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1, item.size, item.color)}>+</button>
                                            </div>
                                            <div className="cart-item__price">
                                                {(item.price * item.quantity).toLocaleString()} ₴
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="checkout-trust-premium">
                                <div className="trust-card-premium">
                                    <div className="trust-card-premium__icon">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                    </div>
                                    <span>Безпечна оплата</span>
                                </div>
                                <div className="trust-card-premium">
                                    <div className="trust-card-premium__icon">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                    </div>
                                    <span>Доставка по Україні</span>
                                </div>
                                <div className="trust-card-premium">
                                    <div className="trust-card-premium__icon">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <span>Підтримка 24/7</span>
                                </div>
                            </div>
                        </div>

                        <div className="cart-summary">
                            <div className="cart-summary__card">
                                <h3>Підсумок</h3>
                                <div className="summary-lines">
                                    <div className="summary-line">
                                        <span>Товари ({items.reduce((a, b) => a + b.quantity, 0)})</span>
                                        <span>{subtotal.toLocaleString()} ₴</span>
                                    </div>
                                    <div className="summary-line">
                                        <span>Доставка</span>
                                        <span>За тарифами перевізника</span>
                                    </div>
                                    {promoApplied && (
                                        <div className="summary-line" style={{ color: '#10b981' }}>
                                            <span>🏷️ {promoApplied.code}</span>
                                            <span>-{promoDiscount.toLocaleString()} ₴</span>
                                        </div>
                                    )}
                                    {!promoApplied && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <input
                                                type="text"
                                                value={promoCode}
                                                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                                                placeholder="Промокод"
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    border: '1px solid #e0e0e0',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}
                                            />
                                            <button
                                                onClick={handleApplyPromo}
                                                disabled={promoLoading || !promoCode.trim()}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: 'var(--color-primary, #2a5a5a)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    opacity: promoLoading || !promoCode.trim() ? 0.5 : 1
                                                }}
                                            >
                                                {promoLoading ? '...' : 'Застосувати'}
                                            </button>
                                        </div>
                                    )}
                                    {promoApplied && (
                                        <button
                                            onClick={handleRemovePromo}
                                            style={{
                                                marginTop: '4px',
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                padding: '4px 0'
                                            }}
                                        >
                                            ✕ Видалити промокод
                                        </button>
                                    )}
                                    {promoError && (
                                        <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                                            {promoError}
                                        </div>
                                    )}
                                </div>
                                <div className="summary-total">
                                    <span>Разом:</span>
                                    <span>{total.toLocaleString()} ₴</span>
                                </div>
                                <button
                                    className="cart-btn cart-btn--primary cart-btn--full"
                                    onClick={() => setStep('info')}
                                >
                                    Оформити замовлення
                                </button>
                                <Link to="/shop/women" className="cart-btn cart-btn--ghost cart-btn--full">
                                    Продовжити покупки
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
