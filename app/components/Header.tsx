import { useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { StorageUtils } from "../utils/storage";
import { AuthUtils, type User } from "../utils/auth";
import { useDebounce } from "../hooks/useDebounce";
import { useSiteSettings, useMegaCounts } from "../utils/site-settings";
import { LLink, LNavLink, plural, useI18n, useMoney } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import CartDrawer from "./CartDrawer";
import MegaMenu, { MegaPanel, type MegaFeatured } from "./MegaMenu";

interface SearchResult {
    id: string;
    slug?: string | null;
    name: string;
    price: number;
    comparePrice?: number | null;
    category: string;
    image: string;
    shopPageSlug: string;
}

// Top-level nav → mega-menu config. The subcategory/fabric/sleeve depth comes
// from TAXONOMY (app/utils/taxonomy.ts); only the per-section featured image
// lives here.
const NAV: Array<{ shop: string; label: string; featured: MegaFeatured }> = [
    {
        shop: "yoga",
        label: "YOGA",
        featured: { image: "/pics1cloths/IMG_6201.webp", badge: "YOGA", title: "Yoga Колекція" },
    },
    {
        shop: "sport",
        label: "SPORT",
        featured: {
            image: "/generalpics/333_131123.webp",
            badge: "SPORT",
            title: "Sport Колекція",
        },
    },
    {
        shop: "dance",
        label: "DANCE",
        featured: {
            image: "/generalpics/374_131123.webp",
            badge: "DANCE",
            title: "Dance Колекція",
        },
    },
    {
        shop: "casual",
        label: "CASUAL",
        featured: {
            image: "/generalpics/595_131123.webp",
            badge: "CASUAL",
            title: "Casual Колекція",
        },
    },
    {
        shop: "kids",
        label: "KIDS",
        featured: { image: "/pics2cloths/IMG_5222.webp", title: "Дитяча Колекція" },
    },
    {
        shop: "yogatools",
        label: "YOGATOOLS",
        featured: {
            image: "/generalpics/348_131123.webp",
            badge: "YOGATOOLS",
            title: "Yoga Інвентар",
        },
    },
];

export function Header() {
    // Owner-editable contacts + mega-menu featured cards (admin → Редактор
    // сайту → Налаштування). The featured image/badge/title of each category's
    // mega-panel is overridden from settings when present; NAV stays the
    // structural source (slugs, labels, fallback featured).
    const { contacts, navFeatured } = useSiteSettings();
    // F-024 — counts loaded by root.tsx; empty map (loading/error) just
    // means MegaMenu renders everything, never less.
    const megaCounts = useMegaCounts();
    const { t, lp, locale } = useI18n();
    const money = useMoney();
    const navItems = NAV.map((item) => ({
        ...item,
        featured: navFeatured.items[item.shop] ?? item.featured,
    }));
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Mobile-only: which category's subcategory accordion is expanded in the drawer.
    const [expandedShop, setExpandedShop] = useState<string | null>(null);
    // Desktop mega-panel: the hovered category (null = closed) + the last
    // non-null one so the panel keeps its content while fading out.
    const [megaShop, setMegaShop] = useState<string | null>(null);
    const [megaShown, setMegaShown] = useState<string>(NAV[0].shop);
    // Width morph is for SWITCHING an open panel only. On open-from-closed
    // the panel must snap to the new section's width — otherwise the width
    // transition runs during the open fade and the masonry visibly reflows.
    const [megaMorph, setMegaMorph] = useState(false);
    // Hover-intent timers: a short open delay kills accidental fly-by opens;
    // a close delay lets the pointer cross the gap between pill and panel.
    const megaTimers = useRef<{ open: number | null; close: number | null }>({
        open: null,
        close: null,
    });
    const megaTriggerRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
    const [cartCount, setCartCount] = useState(0);
    const [wishlistCount, setWishlistCount] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Search state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const updateCounts = () => {
            const cart = StorageUtils.getCart();
            const wishlist = StorageUtils.getWishlist();
            setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
            setWishlistCount(wishlist.length);
        };

        const updateAuth = () => {
            const authState = AuthUtils.getAuthState();
            setUser(authState.user);
        };

        // Initial auth check
        updateAuth();

        updateCounts();

        const unsubCart = StorageUtils.subscribeToCart(updateCounts);
        const unsubWishlist = StorageUtils.subscribeToWishlist(updateCounts);
        const unsubAuth = AuthUtils.subscribeToAuth(updateAuth);

        // Auto-open cart drawer when item added
        const openDrawerOnAdd = () => setIsCartOpen(true);
        window.addEventListener("cart-item-added", openDrawerOnAdd);

        return () => {
            unsubCart();
            unsubWishlist();
            unsubAuth();
            window.removeEventListener("cart-item-added", openDrawerOnAdd);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // ---- Desktop mega-panel state machine -------------------------------
    const clearMegaTimers = () => {
        const t = megaTimers.current;
        if (t.open !== null) window.clearTimeout(t.open);
        if (t.close !== null) window.clearTimeout(t.close);
        t.open = null;
        t.close = null;
    };

    const openMega = (shop: string) => {
        clearMegaTimers();
        setMegaMorph(megaShop !== null);
        setMegaShown(shop);
        setMegaShop(shop);
    };

    const closeMega = () => {
        clearMegaTimers();
        setMegaShop(null);
    };

    /** Pointer entered a nav item: open after a short intent delay (or
     *  switch instantly when the panel is already showing). Mouse only —
     *  on touch, tapping the category link just navigates. */
    const handleMegaItemEnter = (shop: string) => (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const t = megaTimers.current;
        if (t.close !== null) {
            window.clearTimeout(t.close);
            t.close = null;
        }
        if (megaShop !== null) {
            openMega(shop);
        } else {
            if (t.open !== null) window.clearTimeout(t.open);
            t.open = window.setTimeout(() => openMega(shop), 70);
        }
    };

    /** Pointer left a nav item or the panel: close after a grace period so
     *  crossing the pill→panel gap (or item→item) never flickers. */
    const handleMegaLeave = (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const t = megaTimers.current;
        if (t.open !== null) {
            window.clearTimeout(t.open);
            t.open = null;
        }
        if (t.close !== null) window.clearTimeout(t.close);
        t.close = window.setTimeout(() => setMegaShop(null), 180);
    };

    const handleMegaPanelEnter = () => {
        const t = megaTimers.current;
        if (t.close !== null) {
            window.clearTimeout(t.close);
            t.close = null;
        }
    };

    /** ArrowDown on a category link drops focus into its panel (keyboard
     *  path — hover never fires for keyboard users). */
    const handleMegaKeyDown = (shop: string) => (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowDown") return;
        e.preventDefault();
        openMega(shop);
        requestAnimationFrame(() => {
            document
                .querySelector<HTMLAnchorElement>(
                    "#header-mega-panel .mega-panel__page.is-active a",
                )
                ?.focus();
        });
    };

    // While open: ESC closes (restoring focus to the trigger) and any scroll
    // closes — a dimmed page under a hover panel shouldn't scroll "through" it.
    useEffect(() => {
        if (megaShop === null) return;
        const shop = megaShop;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeMega();
                megaTriggerRefs.current[shop]?.focus();
            }
        };
        const onScroll = () => closeMega();
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("scroll", onScroll);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [megaShop]);

    // Unmount safety: never leave hover-intent timers running.
    useEffect(() => {
        const t = megaTimers.current;
        return () => {
            if (t.open !== null) window.clearTimeout(t.open);
            if (t.close !== null) window.clearTimeout(t.close);
        };
    }, []);

    // Debounce the search input so each keystroke doesn't fire a request.
    // The effect below reacts to debouncedQuery — see app/hooks/useDebounce.ts.
    const debouncedQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        const query = debouncedQuery.trim();
        if (query.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        let cancelled = false;
        setIsSearching(true);
        (async () => {
            try {
                const res = await fetch(
                    `/api/search?q=${encodeURIComponent(query)}&lang=${locale}`,
                );
                const data = await res.json();
                if (!cancelled) setSearchResults(data.products || []);
            } catch {
                if (!cancelled) setSearchResults([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        })();
        // Abort the late response if the user kept typing — otherwise an
        // older slow request could overwrite newer results.
        return () => {
            cancelled = true;
        };
    }, [debouncedQuery]);

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const openSearch = () => {
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 150);
    };

    const closeSearch = () => {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
    };

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSearchOpen) closeSearch();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSearchOpen]);

    const handleProfileClick = (e: React.MouseEvent) => {
        e.preventDefault();
        navigate(lp(user ? "/profile" : "/auth"));
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <>
            <div className="top-bar">
                <div className="top-bar__container">
                    <div className="top-bar__left">
                        <a href={`tel:${contacts.phoneTel}`} className="top-bar__phone">
                            <svg
                                className="top-bar__phone-icon"
                                viewBox="0 0 18 18"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M16.5 12.69v2.25a1.5 1.5 0 01-1.635 1.5 14.843 14.843 0 01-6.472-2.302 14.625 14.625 0 01-4.5-4.5A14.843 14.843 0 011.59 3.135 1.5 1.5 0 013.082 1.5H5.33a1.5 1.5 0 011.5 1.29 9.63 9.63 0 00.525 2.108 1.5 1.5 0 01-.337 1.582l-.953.953a12 12 0 004.5 4.5l.953-.952a1.5 1.5 0 011.582-.338 9.63 9.63 0 002.108.525 1.5 1.5 0 011.29 1.522z"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <span>{contacts.phoneDisplay}</span>
                        </a>
                    </div>

                    <div className="top-bar__center">
                        <LLink to="/" className="top-bar__logo-link" prefetch="intent">
                            <picture>
                                <source srcSet="/pics/mind_body_logo_sun.webp" type="image/webp" />
                                <img
                                    src="/pics/mind_body_logo_sun.png"
                                    alt="Mind Body"
                                    className="top-bar__logo-icon"
                                />
                            </picture>
                        </LLink>
                    </div>

                    <div className="top-bar__right">
                        <LNavLink to="/about" className="top-bar__link">
                            {t("Про бренд")}
                        </LNavLink>
                        <LNavLink to="/about#contact-premium" className="top-bar__link">
                            {t("Контакти")}
                        </LNavLink>
                        <LNavLink to={user ? "/profile" : "/auth"} className="top-bar__link">
                            {user ? t("Профіль") : t("Увійти")}
                        </LNavLink>
                        <LanguageSwitcher className="lang-switch--top-bar" />
                    </div>
                </div>
            </div>

            <header
                className={`header ${isScrolled ? "is-scrolled" : ""} ${isMenuOpen ? "is-menu-open" : ""}`}
                id="header"
                onBlur={(e) => {
                    // Focus left the header entirely (tab-out or click on the
                    // page) → close the mega-panel. relatedTarget is null for
                    // clicks on non-focusable page content, which also closes.
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closeMega();
                }}
            >
                <div className="header__container">
                    {/* Burger — its own grid cell (left) on mobile; hidden
                        on desktop where the inline nav shows instead. */}
                    <button
                        className={`header__burger ${isMenuOpen ? "header__burger--active" : ""}`}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label={isMenuOpen ? t("Закрити меню") : t("Відкрити меню")}
                        aria-expanded={isMenuOpen}
                        aria-controls="header-mobile-nav"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <LLink to="/" prefetch="intent" className="header__logo">
                        <picture>
                            <source srcSet="/pics/mind_body_1.webp" type="image/webp" />
                            <img
                                src="/pics/mind_body_1.png"
                                alt="MIND BODY"
                                className="header__logo-img"
                            />
                        </picture>
                    </LLink>

                    <nav
                        id="header-mobile-nav"
                        className={`header__nav ${isMenuOpen ? "header__nav--active" : ""}`}
                    >
                        <ul className="header__nav-list">
                            {/* Data-driven from TAXONOMY (app/utils/taxonomy.ts):
                                each section renders the full subcategory →
                                fabric → sleeve depth via <MegaMenu>. */}
                            {navItems.map((item) => (
                                <li
                                    key={item.shop}
                                    className={`header__nav-item header__nav-item--mega${
                                        expandedShop === item.shop ? " is-expanded" : ""
                                    }${megaShop === item.shop ? " is-mega-active" : ""}`}
                                    onPointerEnter={handleMegaItemEnter(item.shop)}
                                    onPointerLeave={handleMegaLeave}
                                >
                                    <div className="header__nav-head">
                                        <LNavLink
                                            to={`/shop/${item.shop}`}
                                            prefetch="intent"
                                            className="header__nav-link"
                                            ref={(el) => {
                                                megaTriggerRefs.current[item.shop] = el;
                                            }}
                                            aria-haspopup="true"
                                            aria-expanded={megaShop === item.shop}
                                            aria-controls="header-mega-panel"
                                            onKeyDown={handleMegaKeyDown(item.shop)}
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                closeMega();
                                            }}
                                        >
                                            {item.label}
                                        </LNavLink>
                                        {/* Mobile-only: expand this section's
                                            subcategory → fabric → sleeve accordion. */}
                                        <button
                                            type="button"
                                            className="header__nav-toggle"
                                            aria-expanded={expandedShop === item.shop}
                                            aria-label={t("Підкатегорії {label}", {
                                                label: item.label,
                                            })}
                                            onClick={() =>
                                                setExpandedShop((s) =>
                                                    s === item.shop ? null : item.shop,
                                                )
                                            }
                                        >
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                aria-hidden="true"
                                            >
                                                <path d="M6 9l6 6 6-6" />
                                            </svg>
                                        </button>
                                    </div>
                                    <MegaMenu
                                        shop={item.shop}
                                        featured={item.featured}
                                        onNavigate={() => setIsMenuOpen(false)}
                                        counts={megaCounts}
                                    />
                                </li>
                            ))}
                        </ul>

                        {/* Secondary links — shown only inside the mobile
                            slide-out menu (hidden on desktop via CSS). */}
                        <div className="header__nav-extra">
                            <LNavLink
                                to={user ? "/profile" : "/auth"}
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {user ? t("Профіль") : t("Увійти")}
                            </LNavLink>
                            <LLink
                                to="/wishlist"
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {t("Обране")}
                                {wishlistCount > 0 ? ` (${wishlistCount})` : ""}
                            </LLink>
                            <LNavLink
                                to="/about"
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {t("Про бренд")}
                            </LNavLink>
                            <LNavLink
                                to="/about#contact-premium"
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {t("Контакти")}
                            </LNavLink>
                            <LanguageSwitcher />
                            <a
                                href={`tel:${contacts.phoneTel}`}
                                className="header__nav-extra-link header__nav-extra-link--phone"
                            >
                                {contacts.phoneDisplay}
                            </a>
                        </div>
                    </nav>

                    <div className="header__actions">
                        {/* Search Button */}
                        <button
                            className="header__action-btn header__action-btn--search"
                            aria-label={t("Пошук")}
                            onClick={openSearch}
                        >
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </button>

                        <button
                            className={`header__action-btn header__action-btn--profile ${user ? "header__action-btn--avatar" : ""}`}
                            aria-label={t("Профіль")}
                            onClick={handleProfileClick}
                        >
                            {user ? (
                                <span className="header__user-avatar">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} />
                                    ) : (
                                        getInitials(user.name)
                                    )}
                                </span>
                            ) : (
                                <svg
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            )}
                        </button>
                        <LLink
                            to="/wishlist"
                            className="header__action-btn header__action-btn--wishlist"
                            aria-label={`${t("Улюблені")}${wishlistCount > 0 ? `: ${wishlistCount}` : ""}`}
                        >
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            {wishlistCount > 0 && (
                                <span className="header__wishlist-count" aria-hidden="true">
                                    {wishlistCount}
                                </span>
                            )}
                        </LLink>
                        <button
                            className="header__action-btn header__action-btn--cart"
                            aria-label={`${t("Кошик")}${cartCount > 0 ? `: ${cartCount} ${plural(locale, cartCount, "товар", "товари", "товарів")}` : ""}`}
                            onClick={() => setIsCartOpen(true)}
                        >
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                            {cartCount > 0 && (
                                <span className="header__cart-count" aria-hidden="true">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Desktop mega-menu: ONE shared panel under the header for
                    all categories — hover swaps its content, so two panels
                    can never overlap. Hidden on mobile (drawer accordion
                    handles the taxonomy there). */}
                <MegaPanel
                    items={navItems}
                    active={megaShop}
                    shown={megaShown}
                    morph={megaMorph}
                    id="header-mega-panel"
                    onNavigate={() => {
                        setIsMenuOpen(false);
                        closeMega();
                    }}
                    onPanelEnter={handleMegaPanelEnter}
                    onPanelLeave={handleMegaLeave}
                    counts={megaCounts}
                />
            </header>

            {/* Search Overlay */}
            {isSearchOpen && (
                <div className="search-overlay" onClick={closeSearch}>
                    <div className="search-overlay__content" onClick={(e) => e.stopPropagation()}>
                        <div className="search-overlay__input-wrap">
                            <svg
                                className="search-overlay__icon"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="search"
                                className="search-overlay__input"
                                placeholder={t("Пошук товарів...")}
                                value={searchQuery}
                                onChange={handleSearchInput}
                                autoComplete="off"
                                aria-label={t("Пошук товарів")}
                            />
                            <button
                                className="search-overlay__close"
                                onClick={closeSearch}
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

                        {/* Results */}
                        {searchQuery.length >= 2 && (
                            <div className="search-overlay__results">
                                {isSearching ? (
                                    <div className="search-overlay__loading">{t("Пошук...")}</div>
                                ) : searchResults.length > 0 ? (
                                    <div className="search-overlay__list">
                                        {searchResults.map((item) => (
                                            <LLink
                                                key={item.id}
                                                to={
                                                    item.slug
                                                        ? `/p/${item.slug}`
                                                        : `/product/${item.id}`
                                                }
                                                className="search-result-item"
                                                onClick={closeSearch}
                                            >
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="search-result-item__img"
                                                />
                                                <div className="search-result-item__info">
                                                    <span className="search-result-item__name">
                                                        {item.name}
                                                    </span>
                                                    <span className="search-result-item__price">
                                                        {money(item.price)}
                                                    </span>
                                                </div>
                                            </LLink>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="search-overlay__empty">
                                        {t("Нічого не знайдено за запитом «{query}»", {
                                            query: searchQuery,
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cart Drawer */}
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </>
    );
}
