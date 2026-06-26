import cartStyles from "./styles/cart.css?url";
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    redirect,
    Scripts,
    ScrollRestoration,
    useLocation,
    useRouteLoaderData,
} from "react-router";
import { isbot } from "isbot";

import type { Route } from "./+types/root";
import { getSiteSettings } from "./utils/site-settings.server";
import { getMegaCounts } from "./utils/mega-counts.server";
import { getUsdRate } from "./utils/currency.server";
import {
    getActiveTaxonomyForClient,
    getActiveVocabForClient,
} from "./utils/taxonomy-config.server";
import {
    HTML_LANG,
    LOCALES,
    localeFromCookieHeader,
    localizePath,
    splitLocalePath,
    translate,
    useI18n,
} from "./i18n";
import { DEFAULT_SITE_URL } from "./utils/site-url";
import { LanguageGate } from "./components/LanguageGate";
import appCss from "./app.css?url";
import loadingScreenCss from "./styles/loading-screen.css?url";
import { Header } from "./components/Header";
import Footer from "./components/Footer";
import { LoadingScreen } from "./components/LoadingScreen";
import { ToastProvider } from "./components/Toast";
import FloatingContact from "./components/FloatingContact";
import SmartSunParticles from "./components/SmartSunParticles";
import CookieBanner from "./components/CookieBanner";
import Analytics from "./components/Analytics";

// GA4 Measurement / Google tag ID — inlined at build by Vite. Rendered as a
// STATIC tag in <head> (below) so Google's tag detector and crawler find it in
// the served HTML (a JS-injected tag is invisible to them → "тег не виявлено")
// and so it initialises before hydration instead of depending on a useEffect.
const GA4_ID = (import.meta.env.VITE_GA4_ID || "") as string;

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
    /* Batch 40 atom 3: preconnect to external APIs we hit on user-facing
       interactions (Nova Poshta address autocomplete in checkout;
       Telegram for the contact form).  Saves ~50-100 ms on the first
       hit by warming up DNS + TCP + TLS handshake. */
    { rel: "preconnect", href: "https://api.novaposhta.ua", crossOrigin: "anonymous" },
    { rel: "preconnect", href: "https://api.telegram.org", crossOrigin: "anonymous" },
    /* Fonts: Cormorant Garamond (display) + DM Sans (body) are used
       site-wide.  Italiana is the eyebrow/label face — it is referenced by
       --font-accent in app.css (and every .ab-eyebrow), so it MUST be
       loaded or those labels silently fall back to Georgia (this was the
       case after Batch 40 dropped it — re-added here).  Fraunces (variable,
       opsz+wght) is used only on /about for the Latin wordmark + monumental
       act numerals; its woff2 is fetched only when a page actually renders
       those glyphs, so non-/about pages pay nothing. */
    {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Italiana&family=Fraunces:opsz,wght@9..144,300..600&display=swap",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Italiana&family=Fraunces:opsz,wght@9..144,300..600&display=swap",
    },
    { rel: "stylesheet", href: appCss },
    { rel: "stylesheet", href: cartStyles },
    { rel: "stylesheet", href: loadingScreenCss },
];

// Owner-editable site content (contacts etc.) for Header/Footer/
// FloatingContact. getSiteSettings never throws (it degrades to hardcoded
// defaults), and the result is server-cached for 5 minutes — one cheap read
// per navigation. Root loaders revalidate after actions, so an admin save
// shows up on the next render.
export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const cookieLocale = localeFromCookieHeader(request.headers.get("cookie"));

    // Returning visitor lands on bare "/" but previously chose en/ru →
    // send them to their language home. Only the exact root path redirects
    // (deep links stay as-typed), and bots never carry the cookie, so SEO
    // sees the canonical trees untouched.
    if (url.pathname === "/" && cookieLocale && cookieLocale !== "uk") {
        throw redirect(`/${cookieLocale}`);
    }

    // F-024 — load alongside siteSettings so the Header sees both as a
    // single root loaderData object. Parallelised because the queries are
    // independent. usdRate powers the $ prices on /en and /ru.
    // getActiveTaxonomyForClient() both LOADS the DB taxonomy into the server's
    // active TAXONOMY (so the SSR mega-menu / shop filters / slug validation use
    // the edited structure) AND returns it for the client — passed down so the
    // mega-menu renders identically on SSR and after hydration (no mismatch).
    const [siteSettings, megaCounts, usdRate, taxonomy, vocab] = await Promise.all([
        getSiteSettings(),
        getMegaCounts(),
        getUsdRate(),
        getActiveTaxonomyForClient(),
        getActiveVocabForClient(),
    ]);

    // First visit (no remembered language) → offer the language gate once.
    const showLanguageGate =
        cookieLocale === null && !isbot(request.headers.get("user-agent") ?? "");

    return { siteSettings, megaCounts, usdRate, showLanguageGate, taxonomy, vocab };
}

// Wrapper component that can use hooks
function AppContent({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith("/admin");
    const rootData = useRouteLoaderData("root") as { showLanguageGate?: boolean } | undefined;

    return (
        <ToastProvider>
            {!isAdminRoute && <SmartSunParticles />}
            <LoadingScreen />
            {!isAdminRoute && rootData?.showLanguageGate && <LanguageGate />}
            {!isAdminRoute && <Header />}
            {/* tabIndex=-1 so the skip link actually moves focus into the
                content (a bare div isn't focusable, so focus would stay on the
                link and the next Tab re-enters the header). */}
            <div id="main-content" tabIndex={-1}>
                {children}
            </div>
            {!isAdminRoute && <Footer />}
            {!isAdminRoute && <FloatingContact />}
            {/* CookieBanner shows once per visitor; Analytics is a tiny
                hook component that loads GA4/Pixel after consent. Both
                stay out of the /admin bundle — admin doesn't need either. */}
            {!isAdminRoute && <CookieBanner />}
            {!isAdminRoute && <Analytics />}
        </ToastProvider>
    );
}

export function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { locale, path: barePath } = splitLocalePath(location.pathname);
    const isPublicPage = !barePath.startsWith("/admin") && !barePath.startsWith("/api");

    return (
        <html lang={HTML_LANG[locale]}>
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
                {/* hreflang alternates — every public URL exists in all three
                    language trees; x-default points at the Ukrainian original. */}
                {isPublicPage &&
                    LOCALES.map((l) => (
                        <link
                            key={l}
                            rel="alternate"
                            hrefLang={HTML_LANG[l]}
                            href={DEFAULT_SITE_URL + localizePath(barePath, l)}
                        />
                    ))}
                {isPublicPage && (
                    <link rel="alternate" hrefLang="x-default" href={DEFAULT_SITE_URL + barePath} />
                )}
                {/* Google tag (gtag.js) — STATIC install so Google's tag
                    detector/crawler see it in the served HTML and it boots
                    before hydration. Consent Mode v2: everything defaults to
                    DENIED (cookieless pings only, no analytics/ads cookies).
                    A returning visitor who already accepted is upgraded to
                    "granted" SYNCHRONOUSLY here — reading the same localStorage
                    key the banner writes — so the FIRST page_view (sent by the
                    config below) is cookied instead of racing the post-hydration
                    React effect (wait_for_update:500 would otherwise lapse on
                    slow loads).
                    page_views: the config fires the initial one; SPA <Link>
                    navigations are tracked by GA4 Enhanced Measurement ("page
                    changes based on browser history events", on by default for
                    this stream — verified firing on prod). We deliberately do
                    NOT also emit page_views from a route effect: that would
                    double-count every navigation against Enhanced Measurement. */}
                {GA4_ID && (
                    <>
                        <script
                            dangerouslySetInnerHTML={{
                                __html:
                                    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
                                    `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});` +
                                    `try{var c=JSON.parse(localStorage.getItem('mb_cookies_consent_v1')||'null');if(c&&c.accepted===true){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}}catch(e){}` +
                                    `gtag('js',new Date());` +
                                    `gtag('config','${GA4_ID}',{anonymize_ip:true});`,
                            }}
                        />
                        <script
                            async
                            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
                        />
                    </>
                )}
                <Meta />
                <Links />
            </head>
            <body>
                <a href="#main-content" className="skip-link">
                    {translate(locale, "Перейти до контенту")}
                </a>
                {children}
                <ScrollRestoration />
                <Scripts />
                {/* Loading-screen escape hatch — independent of React.
                    The <LoadingScreen> hides itself from a useEffect, so if the
                    client bundle ever fails to hydrate (e.g. a stale cached
                    document references a JS chunk a later deploy removed), that
                    effect never runs and the overlay sticks forever. This inline
                    script force-reveals the page on `load` and via a hard
                    backstop, regardless of hydration. For a healthy page React
                    has already removed the overlay long before these fire, so
                    this is a pure safety net (no flicker). */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){function h(){var e=document.querySelector('.loading-screen');if(e){e.style.opacity='0';e.style.visibility='hidden';e.style.pointerEvents='none';}}if(document.readyState==='complete'){h();}else{window.addEventListener('load',h);}setTimeout(h,4000);})();`,
                    }}
                />
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
    const { t, lp } = useI18n();
    let message = t("Помилка!");
    let details = t("Виникла неочікувана помилка.");
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : t("Помилка");
        details = error.status === 404 ? t("Сторінку не знайдено.") : error.statusText || details;
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
                                action={lp("/search")}
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
                                    placeholder={t("Пошук товарів...")}
                                    aria-label={t("Пошук товарів")}
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
                                    {t("Знайти")}
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
                                        href={lp(c.to)}
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
                                href={lp("/")}
                                className="btn btn--primary"
                                style={{
                                    display: "inline-block",
                                    background: "#fff",
                                    color: "var(--color-primary)",
                                }}
                            >
                                {t("На головну")}
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
