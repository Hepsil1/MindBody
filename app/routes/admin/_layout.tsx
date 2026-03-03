import { NavLink, Outlet, Link, redirect } from "react-router";
import { useState } from "react";
import "../../styles/admin.css";
import "../../app.css";
import { isAuthenticated, adminSession } from "../../utils/admin.server";
import type { Route } from "./+types/_layout";

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    if (url.pathname === "/admin/login") {
        return null; // Skip check for login page
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    ),
    Products: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </svg>
    ),
    Customers: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
    ),
    Eye: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    Edit: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    Slides: () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
        </svg>
    ),
};

const navItems = [
    { to: "/admin", icon: <Icons.Dashboard />, label: "Dashboard", end: true },
    {
        to: "/admin/orders", icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ), label: "Замовлення"
    },
    // { to: "/admin/slides", icon: <Icons.Slides />, label: "Слайди" }, // Removed as requested
    { to: "/admin/products", icon: <Icons.Products />, label: "Товари" },
    { to: "/admin/customers", icon: <Icons.Customers />, label: "Клієнти" },
    {
        to: "/admin/promo", icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
                <line x1="13" y1="13" x2="13.01" y2="13" />
                <line x1="7" y1="13" x2="13" y2="7" />
            </svg>
        ), label: "Промокоди"
    },
];

export default function AdminLayout() {
    const [editMode, setEditMode] = useState(false);

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '12px' }}>
                    <Link to="/admin" className="admin-logo">
                        <div className="admin-logo__icon">
                            <span>M</span>
                        </div>
                        <span className="admin-logo__text">MIND BODY</span>
                    </Link>

                    <Link to="/admin/logout" title="Вийти" style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none'
                    }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="admin-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
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
                <div style={{ padding: '0 12px 24px 12px', marginTop: 'auto' }}>
                    <div style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: 'var(--text-muted)',
                        marginBottom: '12px',
                        paddingLeft: '12px',
                        fontWeight: '600'
                    }}>
                        Режими сайту
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* View Mode */}
                        <a href="/" target="_blank" className="admin-nav__item" style={{ cursor: 'pointer' }}>
                            <span className="admin-nav__icon"><Icons.Eye /></span>
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
                            <span className="admin-nav__icon"><Icons.Edit /></span>
                            <span className="admin-nav__label">
                                Режим редагування
                                <span className="active-dot" style={{
                                    display: 'inline-block',
                                    width: '6px',
                                    height: '6px',
                                    background: 'var(--accent-primary)',
                                    borderRadius: '50%',
                                    marginLeft: '8px',
                                    boxShadow: '0 0 8px var(--accent-primary)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s'
                                }} />
                            </span>
                        </NavLink>
                    </div>
                </div>

            </aside>

            {/* Main Content */}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
