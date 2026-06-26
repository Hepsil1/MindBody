import { NavLink, Outlet, Link, redirect, isRouteErrorResponse, useRouteError } from "react-router";
import { useState, useEffect } from "react";
import adminCss from "../../styles/admin.css?url";
import appCss from "../../app.css?url";
import { isAuthenticated, adminSession } from "../../utils/admin.server";
import { Toaster } from "sonner";
import { CommandPalette } from "../../components/admin/CommandPalette";
import type { Route } from "./+types/_layout";

export function links() {
    return [
        { rel: "stylesheet", href: appCss },
        { rel: "stylesheet", href: adminCss },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    if (url.pathname === "/admin/login") {
        return null;
    }

    const authenticated = await isAuthenticated(request);
    if (!authenticated) {
        return redirect("/admin/login");
    }
    return null;
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    if (formData.get("intent") === "logout") {
        return redirect("/admin/login", {
            headers: {
                "Set-Cookie": await adminSession.serialize("", { maxAge: 0 }),
            },
        });
    }
    return null;
}

// Minimal icon set
const Icons = {
    Dashboard: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="20"
            height="20"
        >
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    ),
    Products: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="20"
            height="20"
        >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </svg>
    ),
    Customers: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="20"
            height="20"
        >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
    ),
    Eye: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="20"
            height="20"
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    Edit: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="20"
            height="20"
        >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    Slides: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="20"
            height="20"
        >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
        </svg>
    ),
};

const navItems = [
    { to: "/admin", icon: <Icons.Dashboard />, label: "Дашборд", end: true },
    {
        to: "/admin/orders",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="20"
                height="20"
            >
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
        label: "Замовлення",
    },
    // { to: "/admin/slides", icon: <Icons.Slides />, label: "Слайди" }, // Removed as requested
    { to: "/admin/products", icon: <Icons.Products />, label: "Товари" },
    // "Картки головної" (home banner cards) intentionally NOT in the sidebar —
    // it cluttered the nav and duplicated the visual editor. Cards are edited
    // inline in the visual editor («Режим редагування» → «Картки головної»); the
    // full add/delete/reorder manager is still at /admin/categories, reached via
    // a button inside that editor panel.
    {
        to: "/admin/inventory",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="20"
                height="20"
            >
                <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
                <path d="M3 7l9 4 9-4M12 11v10" />
            </svg>
        ),
        label: "Склад",
    },
    { to: "/admin/customers", icon: <Icons.Customers />, label: "Клієнти" },
    {
        to: "/admin/promo",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="20"
                height="20"
            >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
                <line x1="13" y1="13" x2="13.01" y2="13" />
                <line x1="7" y1="13" x2="13" y2="7" />
            </svg>
        ),
        label: "Промокоди",
    },
    {
        to: "/admin/reviews",
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="20"
                height="20"
            >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
        ),
        label: "Відгуки",
    },
];

export default function AdminLayout() {
    const [editMode, setEditMode] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);

    // Close the mobile drawer on Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    // Cmd+K / Ctrl+K opens the global search palette from anywhere in the admin.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="admin-layout">
            {/* Mobile top bar (revealed only on phones via admin.css). */}
            <div className="admin-topbar">
                <button
                    type="button"
                    className="admin-burger"
                    aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="22"
                        height="22"
                    >
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <span className="admin-topbar__brand">MIND BODY</span>
            </div>
            {/* Scrim to dismiss the drawer by tapping outside it. */}
            {menuOpen && (
                <div
                    className="admin-scrim"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside className={`admin-sidebar${menuOpen ? " is-open" : ""}`}>
                {/* Logo */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingRight: "12px",
                    }}
                >
                    <Link to="/admin" className="admin-logo">
                        <div className="admin-logo__icon">
                            <span>M</span>
                        </div>
                        <span className="admin-logo__text">MIND BODY</span>
                    </Link>

                    <Link
                        to="/admin/logout"
                        title="Вийти"
                        aria-label="Вийти з адмін-панелі"
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                        }}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            width="18"
                            height="18"
                        >
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                    </Link>
                </div>

                {/* Global search (Cmd+K) */}
                <button
                    type="button"
                    className="admin-search-btn"
                    onClick={() => {
                        setMenuOpen(false);
                        setPaletteOpen(true);
                    }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.5" y2="16.5" />
                    </svg>
                    <span>Пошук по магазину</span>
                    <kbd>Ctrl K</kbd>
                </button>

                {/* Navigation */}
                <nav className="admin-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={() => setMenuOpen(false)}
                            className={({ isActive }) =>
                                `admin-nav__item ${isActive ? "admin-nav__item--active" : ""}`
                            }
                        >
                            <span className="admin-nav__icon">{item.icon}</span>
                            <span className="admin-nav__label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Site Modes */}
                <div style={{ marginTop: "auto", paddingTop: "12px" }}>
                    <div className="admin-nav-section">Режими сайту</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {/* View Mode */}
                        <a
                            href="/"
                            target="_blank"
                            className="admin-nav__item"
                            style={{ cursor: "pointer" }}
                        >
                            <span className="admin-nav__icon">
                                <Icons.Eye />
                            </span>
                            <span className="admin-nav__label">Попередній перегляд</span>
                        </a>

                        {/* Edit Mode Toggle */}
                        {/* Edit Mode Toggle */}
                        <NavLink
                            to="/admin/slides"
                            className={({ isActive }) =>
                                `admin-nav__item ${isActive ? "admin-nav__item--active" : ""}`
                            }
                            title="Візуальний редактор сайту"
                        >
                            <span className="admin-nav__icon">
                                <Icons.Edit />
                            </span>
                            <span className="admin-nav__label">
                                Режим редагування
                                <span
                                    className="active-dot"
                                    style={{
                                        display: "inline-block",
                                        width: "6px",
                                        height: "6px",
                                        background: "var(--accent-primary)",
                                        borderRadius: "50%",
                                        marginLeft: "8px",
                                        boxShadow: "0 0 8px var(--accent-primary)",
                                        opacity: 0,
                                        transition: "opacity 0.2s",
                                    }}
                                />
                            </span>
                        </NavLink>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                <Outlet />
            </main>
            <Toaster richColors theme="dark" position="top-right" />
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </div>
    );
}

// Catch loader/render errors from any admin child route here (the dashboard
// aggregates and the list loaders all hit the DB, so a throw is realistic).
// Without this they bubble to the root boundary and the whole admin chrome
// vanishes; here the operator gets a clear message + a way back.
export function ErrorBoundary() {
    const error = useRouteError();
    const is404 = isRouteErrorResponse(error) && error.status === 404;
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                background: "var(--bg-page, #0f1115)",
                color: "#e2e8f0",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <div
                style={{
                    maxWidth: "440px",
                    textAlign: "center",
                    background: "var(--bg-card, #161b22)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    padding: "40px 32px",
                }}
            >
                <h1 style={{ fontSize: "22px", margin: "0 0 12px" }}>
                    {is404 ? "Сторінку не знайдено" : "Щось пішло не так"}
                </h1>
                <p style={{ color: "#94a3b8", fontSize: "14px", margin: "0 0 24px" }}>
                    {is404
                        ? "Можливо, запис було видалено або посилання застаріле."
                        : "Сталася помилка під час завантаження. Спробуйте ще раз або поверніться на головну."}
                </p>
                <Link
                    to="/admin"
                    style={{
                        display: "inline-block",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        background: "var(--accent-primary, #5eead4)",
                        color: "#06231f",
                        fontWeight: 600,
                        textDecoration: "none",
                    }}
                >
                    На головну адмінки
                </Link>
            </div>
        </div>
    );
}
