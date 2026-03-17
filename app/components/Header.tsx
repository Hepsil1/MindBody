import { Link, NavLink, useNavigate } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { StorageUtils } from "../utils/storage";
import { AuthUtils, type User } from "../utils/auth";
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
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

        updateCounts();
        updateAuth();

        const unsubCart = StorageUtils.subscribeToCart(updateCounts);
        const unsubWishlist = StorageUtils.subscribeToWishlist(updateCounts);
        const unsubAuth = AuthUtils.subscribeToAuth(updateAuth);

        // Auto-open cart drawer when item added
        const openDrawerOnAdd = () => setIsCartOpen(true);
        window.addEventListener('cart-item-added', openDrawerOnAdd);

        return () => {
            unsubCart();
            unsubWishlist();
            unsubAuth();
            window.removeEventListener('cart-item-added', openDrawerOnAdd);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Search debounce
    const performSearch = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data.products || []);
        } catch {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => performSearch(value), 300);
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
        window.location.href = user ? '/profile' : '/auth';
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <>
            <div className="top-bar">
                <div className="container top-bar__container">
                    <div className="top-bar__item">
                        <span className="top-bar__text">🇺🇦 Українське виробництво · Доставка по Україні</span>
                    </div>
                    <div className="top-bar__item">
                        <span className="top-bar__link">
                            ✨ -10% на перше замовлення
                        </span>
                    </div>
                </div>
            </div>

            <header className={`header ${isScrolled ? 'is-scrolled' : ''}`} id="header">
                <div className="header__container">
                    <Link to="/" className="header__logo">
                        <img src="/pics/mind_body_1.png" alt="MIND BODY" className="header__logo-img" />
                    </Link>

                    <nav className={`header__nav ${isMenuOpen ? "header__nav--active" : ""}`}>
                        <ul className="header__nav-list">
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink to="/shop/women" className="header__nav-link" onClick={() => setIsMenuOpen(false)}>
                                    Жінкам
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link to="/shop/women" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Всі товари</Link>
                                            <Link to="/shop/women?cat=jumpsuit" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Комбінезони</Link>
                                            <Link to="/shop/women?cat=leggings" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Легінси</Link>
                                            <Link to="/shop/women?cat=tops" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Топи</Link>
                                            <Link to="/shop/women?cat=shorts" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Шорти</Link>
                                            <Link to="/shop/women?cat=sets" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Комплекти</Link>
                                        </div>
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Популярне</h4>
                                            <Link to="/shop/women?sort=newest" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Новинки</Link>
                                            <Link to="/shop/women?sort=popular" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Бестселери</Link>
                                            <Link to="/shop/women?sale=true" className="mega-menu__link mega-menu__link--accent" onClick={() => setIsMenuOpen(false)}>Розпродаж</Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img src="/pics1cloths/IMG_6201.JPG" alt="Нова Колекція" />
                                                <div className="mega-menu__featured-badge">NEW</div>
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Нова Колекція</h5>
                                                <Link to="/shop/women" className="mega-menu__featured-link" onClick={() => setIsMenuOpen(false)}>Переглянути →</Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>
                            <li className="header__nav-item header__nav-item--mega">
                                <NavLink to="/shop/kids" className="header__nav-link" onClick={() => setIsMenuOpen(false)}>
                                    Дітям
                                </NavLink>
                                <div className="mega-menu">
                                    <div className="mega-menu__inner">
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Категорії</h4>
                                            <Link to="/shop/kids" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Всі товари</Link>
                                            <Link to="/shop/kids?cat=jumpsuit" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Комбінезони</Link>
                                            <Link to="/shop/kids?cat=sets" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Комплекти</Link>
                                            <Link to="/shop/kids?cat=tops" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Топи</Link>
                                        </div>
                                        <div className="mega-menu__col">
                                            <h4 className="mega-menu__heading">Популярне</h4>
                                            <Link to="/shop/kids?sort=newest" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Новинки</Link>
                                            <Link to="/shop/kids?sort=popular" className="mega-menu__link" onClick={() => setIsMenuOpen(false)}>Бестселери</Link>
                                        </div>
                                        <div className="mega-menu__featured">
                                            <div className="mega-menu__featured-img">
                                                <img src="/pics2cloths/IMG_5222.JPG" alt="Дитяча Колекція" />
                                            </div>
                                            <div className="mega-menu__featured-content">
                                                <h5>Дитяча Колекція</h5>
                                                <Link to="/shop/kids" className="mega-menu__featured-link" onClick={() => setIsMenuOpen(false)}>Переглянути →</Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </li>
                            <li className="header__nav-item">
                                <NavLink to="/about" className="header__nav-link" onClick={() => setIsMenuOpen(false)}>
                                    Про бренд
                                </NavLink>
                            </li>
                        </ul>
                    </nav>

                    <div className="header__actions">
                        {/* Search Button */}
                        <button className="header__action-btn" aria-label="Пошук" onClick={openSearch}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </button>

                        <button className={`header__action-btn ${user ? 'header__action-btn--avatar' : ''}`} aria-label="Профіль" onClick={handleProfileClick}>
                            {user ? (
                                <span className="header__user-avatar">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} />
                                    ) : getInitials(user.name)}
                                </span>
                            ) : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            )}
                        </button>
                        <Link to="/wishlist" className="header__action-btn" aria-label="Улюблені">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            <span className="header__wishlist-count">{wishlistCount}</span>
                        </Link>
                        <button className="header__action-btn" aria-label="Кошик" onClick={() => setIsCartOpen(true)}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                            <span className="header__cart-count">{cartCount}</span>
                        </button>
                        <button
                            className={`header__burger ${isMenuOpen ? "header__burger--active" : ""}`}
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label="Меню"
                        >
                            <span></span><span></span><span></span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Search Overlay */}
            {isSearchOpen && (
                <div className="search-overlay" onClick={closeSearch}>
                    <div className="search-overlay__content" onClick={(e) => e.stopPropagation()}>
                        <div className="search-overlay__input-wrap">
                            <svg className="search-overlay__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                            <button className="search-overlay__close" onClick={closeSearch} aria-label="Закрити">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                                <img src={item.image} alt={item.name} className="search-result-item__img" />
                                                <div className="search-result-item__info">
                                                    <span className="search-result-item__name">{item.name}</span>
                                                    <span className="search-result-item__price">{item.price.toLocaleString()} ₴</span>
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
