import { Link, NavLink, useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { StorageUtils } from "../utils/storage";
import { AuthUtils, type User } from "../utils/auth";
import { useDebounce } from "../hooks/useDebounce";
import CartDrawer from "./CartDrawer";

interface SearchResult {
    id: string;
    name: string;
    price: number;
    comparePrice?: number | null;
    category: string;
    image: string;
    shopPageSlug: string;
}

export function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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
        navigate(user ? "/profile" : "/auth");
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
                        <a href="tel:+380671234567" className="top-bar__phone">
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
                            <span>+380 67 123 45 67</span>
                        </a>
                    </div>

                    <div className="top-bar__center">
                        <Link to="/" className="top-bar__logo-link" prefetch="intent">
                            <img
                                src="/pics/mind_body_logo_sun.png"
                                alt="Mind Body"
                                className="top-bar__logo-icon"
                            />
                        </Link>
                    </div>

                    <div className="top-bar__right">
                        <NavLink to="/about" className="top-bar__link">
                            Про бренд
                        </NavLink>
                        <NavLink to="/about#contact-premium" className="top-bar__link">
                            Контакти
                        </NavLink>
                        <NavLink to={user ? "/profile" : "/auth"} className="top-bar__link">
                            {user ? "Профіль" : "Увійти"}
                        </NavLink>
                    </div>
                </div>
            </div>

            <header
                className={`header ${isScrolled ? "is-scrolled" : ""} ${isMenuOpen ? "is-menu-open" : ""}`}
                id="header"
            >
                <div className="header__container">
                    {/* Burger — its own grid cell (left) on mobile; hidden
                        on desktop where the inline nav shows instead. */}
                    <button
                        className={`header__burger ${isMenuOpen ? "header__burger--active" : ""}`}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Меню"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <Link to="/" prefetch="intent" className="header__logo">
                        <img
                            src="/pics/mind_body_1.png"
                            alt="MIND BODY"
                            className="header__logo-img"
                        />
                    </Link>

                    <nav className={`header__nav ${isMenuOpen ? "header__nav--active" : ""}`}>
                        <ul className="header__nav-list">
                            {/* YOGA */}
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink
                                    to="/shop/yoga"
                                    prefetch="intent"
                                    className="header__nav-link"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    YOGA
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link
                                                to="/shop/yoga"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Всі товари
                                            </Link>
                                            <Link
                                                to="/shop/yoga/jumpsuit"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Комбінезони
                                            </Link>
                                            <Link
                                                to="/shop/yoga/leggings"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Легінси
                                            </Link>
                                            <Link
                                                to="/shop/yoga/velo"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                VELO
                                            </Link>
                                            <Link
                                                to="/shop/yoga/tops"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Топи
                                            </Link>
                                            <Link
                                                to="/shop/yoga/shorts"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Шорти
                                            </Link>
                                            <Link
                                                to="/shop/yoga/longsleeve"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Лонгсліви
                                            </Link>
                                            <Link
                                                to="/shop/yoga/tshirts"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Футболки
                                            </Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img
                                                    src="/pics1cloths/IMG_6201.webp"
                                                    alt="Yoga Collection"
                                                    loading="lazy"
                                                />
                                                <div className="mega-menu__featured-badge">
                                                    YOGA
                                                </div>
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Yoga Колекція</h5>
                                                <Link
                                                    to="/shop/yoga"
                                                    className="mega-menu__featured-link"
                                                    onClick={() => setIsMenuOpen(false)}
                                                >
                                                    Переглянути →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>

                            {/* SPORT */}
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink
                                    to="/shop/sport"
                                    prefetch="intent"
                                    className="header__nav-link"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    SPORT
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link
                                                to="/shop/sport"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Всі товари
                                            </Link>
                                            <Link
                                                to="/shop/sport/jumpsuit"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Комбінезони
                                            </Link>
                                            <Link
                                                to="/shop/sport/leggings"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Легінси
                                            </Link>
                                            <Link
                                                to="/shop/sport/velo"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                VELO
                                            </Link>
                                            <Link
                                                to="/shop/sport/tops"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Топи
                                            </Link>
                                            <Link
                                                to="/shop/sport/shorts"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Шорти
                                            </Link>
                                            <Link
                                                to="/shop/sport/longsleeve"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Лонгсліви
                                            </Link>
                                            <Link
                                                to="/shop/sport/sets"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Комплекти
                                            </Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img
                                                    src="/generalpics/333_131123.webp"
                                                    alt="Sport Collection"
                                                    loading="lazy"
                                                />
                                                <div className="mega-menu__featured-badge">
                                                    SPORT
                                                </div>
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Sport Колекція</h5>
                                                <Link
                                                    to="/shop/sport"
                                                    className="mega-menu__featured-link"
                                                    onClick={() => setIsMenuOpen(false)}
                                                >
                                                    Переглянути →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>

                            {/* DANCE */}
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink
                                    to="/shop/dance"
                                    prefetch="intent"
                                    className="header__nav-link"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    DANCE
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link
                                                to="/shop/dance"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Всі товари
                                            </Link>
                                            <Link
                                                to="/shop/dance/jumpsuit"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Комбінезони
                                            </Link>
                                            <Link
                                                to="/shop/dance/net-models"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Моделі із сітки
                                            </Link>
                                            <Link
                                                to="/shop/dance/pole-sets"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Комплекти пілон
                                            </Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img
                                                    src="/generalpics/374_131123.webp"
                                                    alt="Dance Collection"
                                                    loading="lazy"
                                                />
                                                <div className="mega-menu__featured-badge">
                                                    DANCE
                                                </div>
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Dance Колекція</h5>
                                                <Link
                                                    to="/shop/dance"
                                                    className="mega-menu__featured-link"
                                                    onClick={() => setIsMenuOpen(false)}
                                                >
                                                    Переглянути →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>

                            {/* CASUAL */}
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink
                                    to="/shop/casual"
                                    prefetch="intent"
                                    className="header__nav-link"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    CASUAL
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link
                                                to="/shop/casual"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Всі товари
                                            </Link>
                                            <Link
                                                to="/shop/casual/suits"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Костюми
                                            </Link>
                                            <Link
                                                to="/shop/casual/shirts"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Сорочки
                                            </Link>
                                            <Link
                                                to="/shop/casual/tshirts"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Футболки
                                            </Link>
                                            <Link
                                                to="/shop/casual/singlets"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Майки
                                            </Link>
                                        </div>
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Ще</h4>
                                            <Link
                                                to="/shop/casual/shorts"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Шорти
                                            </Link>
                                            <Link
                                                to="/shop/casual/thermo"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Термо
                                            </Link>
                                            <Link
                                                to="/shop/casual/hoodies"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Худі / Світшоти
                                            </Link>
                                            <Link
                                                to="/shop/casual/joggers"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Джоггери
                                            </Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img
                                                    src="/generalpics/595_131123.webp"
                                                    alt="Casual Collection"
                                                    loading="lazy"
                                                />
                                                <div className="mega-menu__featured-badge">
                                                    CASUAL
                                                </div>
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Casual Колекція</h5>
                                                <Link
                                                    to="/shop/casual"
                                                    className="mega-menu__featured-link"
                                                    onClick={() => setIsMenuOpen(false)}
                                                >
                                                    Переглянути →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>

                            {/* KIDS */}
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink
                                    to="/shop/kids"
                                    prefetch="intent"
                                    className="header__nav-link"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    KIDS
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link
                                                to="/shop/kids"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Всі товари
                                            </Link>
                                            <Link
                                                to="/shop/kids/jumpsuit"
                                                className="mega-menu__link"
                                                prefetch="intent"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                Комбінезони
                                            </Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img
                                                    src="/pics2cloths/IMG_5222.webp"
                                                    alt="Kids Collection"
                                                    loading="lazy"
                                                />
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Дитяча Колекція</h5>
                                                <Link
                                                    to="/shop/kids"
                                                    className="mega-menu__featured-link"
                                                    onClick={() => setIsMenuOpen(false)}
                                                >
                                                    Переглянути →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>

                            {/* YOGATOOLS */}
                            <li className="header__nav-item">
                                <NavLink
                                    to="/shop/yogatools"
                                    prefetch="intent"
                                    className="header__nav-link"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    YOGATOOLS
                                </NavLink>
                            </li>
                        </ul>

                        {/* Secondary links — shown only inside the mobile
                            slide-out menu (hidden on desktop via CSS). */}
                        <div className="header__nav-extra">
                            <NavLink
                                to={user ? "/profile" : "/auth"}
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {user ? "Профіль" : "Увійти"}
                            </NavLink>
                            <Link
                                to="/wishlist"
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Обране{wishlistCount > 0 ? ` (${wishlistCount})` : ""}
                            </Link>
                            <NavLink
                                to="/about"
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Про бренд
                            </NavLink>
                            <NavLink
                                to="/about#contact-premium"
                                className="header__nav-extra-link"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Контакти
                            </NavLink>
                            <a
                                href="tel:+380671234567"
                                className="header__nav-extra-link header__nav-extra-link--phone"
                            >
                                +380 67 123 45 67
                            </a>
                        </div>
                    </nav>

                    <div className="header__actions">
                        {/* Search Button */}
                        <button
                            className="header__action-btn header__action-btn--search"
                            aria-label="Пошук"
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
                            aria-label="Профіль"
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
                        <Link
                            to="/wishlist"
                            className="header__action-btn header__action-btn--wishlist"
                            aria-label={`Улюблені${wishlistCount > 0 ? `: ${wishlistCount}` : ""}`}
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
                        </Link>
                        <button
                            className="header__action-btn header__action-btn--cart"
                            aria-label={`Кошик${cartCount > 0 ? `: ${cartCount} товарів` : ""}`}
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
                                type="text"
                                className="search-overlay__input"
                                placeholder="Пошук товарів..."
                                value={searchQuery}
                                onChange={handleSearchInput}
                                autoComplete="off"
                            />
                            <button
                                className="search-overlay__close"
                                onClick={closeSearch}
                                aria-label="Закрити"
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
                                    <div className="search-overlay__loading">Пошук...</div>
                                ) : searchResults.length > 0 ? (
                                    <div className="search-overlay__list">
                                        {searchResults.map((item) => (
                                            <Link
                                                key={item.id}
                                                to={`/product/${item.id}`}
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
                                                        {item.price.toLocaleString()} ₴
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="search-overlay__empty">
                                        Нічого не знайдено за запитом «{searchQuery}»
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
