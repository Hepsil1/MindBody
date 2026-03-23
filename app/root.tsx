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

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/logo-sun.png" },
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
  // Secondary fonts — display=swap ensures non-blocking rendering
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Outfit:wght@300;400;500&family=Syncopate:wght@400;700&family=Manrope:wght@200;400;600&family=Bodoni+Moda:ital,wght@0,400;0,700;1,400&family=Prata&family=Marcellus&display=swap",
  },
  { rel: "stylesheet", href: appCss },
  { rel: "stylesheet", href: loadingScreenCss },
];

// Wrapper component that can use hooks
function AppContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <ToastProvider>
      <LoadingScreen />
      {!isAdminRoute && <Header />}
      <main id="main-content">
        {children}
      </main>
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Перейти до контенту</a>
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
    details =
      error.status === 404
        ? "Сторінку не знайдено."
        : error.statusText || details;
  } else if (error && error instanceof Error) {
    details = error.message;
    stack = import.meta.env.DEV ? error.stack : undefined;
  }

  return (
    <ToastProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main className="auth-page" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <section className="auth-hero" style={{ width: "100%", padding: "100px 0", minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="container" style={{ position: "relative", zIndex: 10 }}>
              <h1 className="auth-hero__title" style={{ color: "#fff", marginBottom: "20px" }}>
                <em>{message}</em>
              </h1>
              <p className="auth-hero__subtitle" style={{ marginBottom: "40px" }}>
                {details}
              </p>
              <a href="/" className="btn btn--primary" style={{ display: "inline-block", background: "#fff", color: "var(--color-primary)" }}>
                Повернутися на головну
              </a>

              {stack && (
                <pre style={{ marginTop: "60px", padding: "20px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", textAlign: "left", fontSize: "12px", overflow: "auto", maxWidth: "800px", margin: "60px auto 0" }}>
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
