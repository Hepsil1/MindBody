import cartStyles from "./styles/cart.css?url";
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import appCss from "./app.css?url";
import loadingScreenCss from "./styles/loading-screen.css?url";
import { Header } from "./components/Header";
import Footer from "./components/Footer";
import { LoadingScreen } from "./components/LoadingScreen";
import { ToastProvider } from "./components/Toast";
import FloatingContact from "./components/FloatingContact";
import SmartSunParticles from "./components/SmartSunParticles";

export const links: Route.LinksFunction = () => [
    { rel: "icon", type: "image/png", href: "/logo-sun.png" },
    // iOS home-screen icon + PWA manifest — lets the site be "added to
    // home screen" with a proper icon and standalone display on mobile.
    { rel: "apple-touch-icon", href: "/logo-sun.png" },
    { rel: "manifest", href: "/manifest.json" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    // Critical fonts — preloaded for fastest LCP
    {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap",
    },
    // Secondary fonts — reduced set (Montserrat + Outfit only), others use system fallback
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Outfit:wght@300;400;500&display=swap",
    },
    { rel: "stylesheet", href: appCss },
    { rel: "stylesheet", href: cartStyles },
    { rel: "stylesheet", href: loadingScreenCss },
];

// Wrapper component that can use hooks
function AppContent({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith("/admin");

    return (
        <ToastProvider>
            {!isAdminRoute && <SmartSunParticles />}
            <LoadingScreen />
            {!isAdminRoute && <Header />}
            <div id="main-content">{children}</div>
            {!isAdminRoute && <Footer />}
            {!isAdminRoute && <FloatingContact />}
        </ToastProvider>
    );
}

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="uk">
            <head>
                <meta charSet="utf-8" />
                {/* viewport-fit=cover unlocks env(safe-area-inset-*) for
                    notch/home-indicator on iOS 11+ — fixed bars (checkout
                    sticky CTA, floating cluster) need it.  Without it the
                    page draws to the edge but env() returns 0. */}
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                <meta name="theme-color" content="#2a5a68" />
                <Meta />
                <Links />
            </head>
            <body>
                <a href="#main-content" className="skip-link">
                    Перейти до контенту
                </a>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <AppContent>
            <Outlet />
        </AppContent>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = "Помилка!";
    let details = "Виникла неочікувана помилка.";
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Помилка";
        details = error.status === 404 ? "Сторінку не знайдено." : error.statusText || details;
    } else if (error && error instanceof Error) {
        details = error.message;
        stack = import.meta.env.DEV ? error.stack : undefined;
    }

    return (
        <ToastProvider>
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
                <Header />
                <main
                    className="auth-page"
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <section
                        className="auth-hero"
                        style={{
                            width: "100%",
                            padding: "100px 0",
                            minHeight: "60vh",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <div className="container" style={{ position: "relative", zIndex: 10 }}>
                            <h1
                                className="auth-hero__title"
                                style={{ color: "#fff", marginBottom: "20px" }}
                            >
                                <em>{message}</em>
                            </h1>
                            <p className="auth-hero__subtitle" style={{ marginBottom: "32px" }}>
                                {details}
                            </p>

                            {/* Atom Q — 404 recovery options.  Background agent
                                flagged the old version as a styled generic: one
                                CTA, no popular links, no search.  Now: search
                                form (GET /search?q=) + popular-category chips. */}
                            <form
                                action="/search"
                                method="get"
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    maxWidth: "420px",
                                    margin: "0 auto 24px",
                                }}
                            >
                                <input
                                    type="search"
                                    name="q"
                                    placeholder="Пошук товарів..."
                                    aria-label="Пошук товарів"
                                    style={{
                                        flex: 1,
                                        padding: "12px 16px",
                                        borderRadius: "999px",
                                        border: "1px solid rgba(255,255,255,0.3)",
                                        background: "rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        fontSize: "15px",
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    style={{
                                        background: "#fff",
                                        color: "var(--color-primary)",
                                    }}
                                >
                                    Знайти
                                </button>
                            </form>

                            {/* Popular category chips — give the user fast
                                routes back into the catalogue. */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                    justifyContent: "center",
                                    marginBottom: "32px",
                                }}
                            >
                                {[
                                    { to: "/shop/yoga", label: "Yoga" },
                                    { to: "/shop/sport", label: "Sport" },
                                    { to: "/shop/dance", label: "Dance" },
                                    { to: "/shop/casual", label: "Casual" },
                                    { to: "/shop/kids", label: "Kids" },
                                ].map((c) => (
                                    <a
                                        key={c.to}
                                        href={c.to}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: "999px",
                                            border: "1px solid rgba(255,255,255,0.3)",
                                            color: "#fff",
                                            fontSize: "13px",
                                            textDecoration: "none",
                                            background: "rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        {c.label}
                                    </a>
                                ))}
                            </div>

                            <a
                                href="/"
                                className="btn btn--primary"
                                style={{
                                    display: "inline-block",
                                    background: "#fff",
                                    color: "var(--color-primary)",
                                }}
                            >
                                На головну
                            </a>

                            {stack && (
                                <pre
                                    style={{
                                        marginTop: "60px",
                                        padding: "20px",
                                        background: "rgba(0,0,0,0.5)",
                                        borderRadius: "12px",
                                        textAlign: "left",
                                        fontSize: "12px",
                                        overflow: "auto",
                                        maxWidth: "800px",
                                        margin: "60px auto 0",
                                    }}
                                >
                                    <code>{stack}</code>
                                </pre>
                            )}
                        </div>
                    </section>
                </main>
                <Footer />
            </div>
        </ToastProvider>
    );
}
