import cartStyles from './styles/cart.css?url';
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
import CookieBanner from "./components/CookieBanner";

const SITE_URL = "https://mindbody.com.ua";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/logo-sun.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  // hreflang for Ukrainian locale
  { rel: "alternate", hrefLang: "uk", href: SITE_URL },
  { rel: "alternate", hrefLang: "x-default", href: SITE_URL },
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

const GLOBAL_JSONLD = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "MIND BODY",
    "url": SITE_URL,
    "logo": `${SITE_URL}/brand-sun.png`,
    "description": "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика.",
    "address": { "@type": "PostalAddress", "addressCountry": "UA" },
    "sameAs": ["https://www.instagram.com/mindbody_ua"]
  },
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "MIND BODY",
    "url": SITE_URL,
    "inLanguage": "uk-UA",
    "potentialAction": {
      "@type": "SearchAction",
      "target": { "@type": "EntryPoint", "urlTemplate": `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string"
    }
  }
};

// Wrapper component that can use hooks
function AppContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <ToastProvider>
      <LoadingScreen />
      {!isAdminRoute && <Header />}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <FloatingContact />}
      {!isAdminRoute && <CookieBanner />}
    </ToastProvider>
  );
}



export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" dir="ltr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2a5a68" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="format-detection" content="telephone=no" />
        <Meta />
        <Links />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Перейти до контенту</a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(GLOBAL_JSONLD.organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(GLOBAL_JSONLD.website) }}
        />
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
  let status = 500;
  let bigLabel = "Помилка";
  let title = "Щось пішло не так";
  let subtitle = "Спробуй оновити сторінку або повернись на головну.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    bigLabel = String(error.status);
    if (error.status === 404) {
      title = "Ця сторінка вислизнула";
      subtitle = "Можливо, її перенесли або вона ще не з’явилась. Знайди свій рух заново.";
    } else if (error.status === 403) {
      title = "Доступ закрито";
      subtitle = "Цей розділ не для відвідувачів. Якщо вважаєш, що це помилка — напиши нам.";
    } else if (error.status >= 500) {
      title = "Ми вже знаємо";
      subtitle = "На нашій стороні сталась тимчасова помилка. Спробуй за хвилину.";
    } else {
      title = error.statusText || title;
    }
  } else if (error && error instanceof Error) {
    subtitle = error.message;
    stack = import.meta.env.DEV ? error.stack : undefined;
  }

  return (
    <ToastProvider>
      <div className="error-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--color-bg-cream, #faf8f6)" }}>
        <Header />
        <main id="main-content" tabIndex={-1} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 20px 80px" }}>
          <div className="container" style={{ maxWidth: "640px", textAlign: "center" }}>
            <div
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
                fontSize: "clamp(120px, 22vw, 220px)",
                fontWeight: 500,
                color: "var(--color-primary, #2a5a5a)",
                lineHeight: 0.85,
                letterSpacing: "-0.04em",
                opacity: 0.92,
                marginBottom: "16px"
              }}
            >
              {bigLabel}
            </div>
            <h1 style={{
              fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 500,
              color: "var(--color-text-primary, #1a1a1a)",
              marginBottom: "16px"
            }}>
              {title}
            </h1>
            <p style={{ color: "var(--color-text-secondary, #555)", marginBottom: "40px", fontSize: "16px", lineHeight: 1.6 }}>
              {subtitle}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/" className="btn btn--primary" style={{ padding: "14px 32px" }}>
                Повернутись на головну
              </a>
              <a href="/shop/yoga" className="btn" style={{
                padding: "14px 32px",
                background: "transparent",
                color: "var(--color-primary, #2a5a5a)",
                border: "1px solid var(--color-primary, #2a5a5a)",
                borderRadius: "999px"
              }}>
                Переглянути колекцію
              </a>
            </div>

            {stack && (
              <pre style={{
                marginTop: "60px",
                padding: "20px",
                background: "rgba(0,0,0,0.04)",
                borderRadius: "12px",
                textAlign: "left",
                fontSize: "12px",
                overflow: "auto",
                maxWidth: "800px",
                margin: "60px auto 0",
                color: "var(--color-text-secondary, #555)"
              }}>
                <code>{stack}</code>
              </pre>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
