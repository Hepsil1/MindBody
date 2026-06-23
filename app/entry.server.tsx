import { PassThrough } from "node:stream";
import type { EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { startInstagramScheduler } from "./services/instagram-refresh.server";

// Kick the background Instagram refresh once, when the server build loads.
// No-op unless IG_SCRAPE_ENABLED=true AND IG_SCRAPE_SESSIONID is set, and
// internally guarded against a double start. Single PM2 fork → safe.
startInstagramScheduler();

const ABORT_DELAY = 5_000;

// CSP allowlist — kept permissive enough to not break inline styles (React),
// Google Fonts, Instagram CDN images, Google Analytics (gtag.js) and our
// integrated APIs. Tighten with nonces if/when we eliminate all inline scripts.
const CSP = [
    "default-src 'self'",
    // googletagmanager.com serves gtag.js (GA4). The Google tag runs a
    // sandboxed-JS environment that uses eval/Function — without 'unsafe-eval'
    // it loads but never finishes initialising (no client_id, no hits sent), so
    // GA shows "data not collected". 'unsafe-inline' covers the inline gtag
    // bootstrap. See app/components/Analytics.tsx.
    // connect.facebook.net serves the Meta Pixel (fbevents.js); it loads only
    // after cookie-consent AND only when VITE_META_PIXEL_ID is set (empty today,
    // so dormant) — pre-listed so the Pixel works the moment an id is added
    // instead of being silently CSP-blocked.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // 'https:' already covers GA + Meta image beacons (google-analytics.com,
    // www.facebook.com/tr, etc.).
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    // GA4 sends hits/config over connect-src (collect endpoint + regional hosts).
    // www.facebook.com is the Meta Pixel's fetch/sendBeacon target (dormant, see above).
    "connect-src 'self' https://api.novaposhta.ua https://api.telegram.org https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net",
    // 'self' (not 'none') so the admin visual editor can iframe-preview our own
    // storefront. Cross-origin framing (clickjacking) is still blocked.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    // SAMEORIGIN (not DENY) so the admin visual editor can iframe-preview our
    // own storefront; cross-origin framing stays blocked. Matches the Caddyfile.
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": CSP,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
};

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
) {
    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

    // Add security headers to every response
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        responseHeaders.set(key, value);
    }

    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const { pipe, abort } = renderToPipeableStream(
            <ServerRouter context={routerContext} url={request.url} />,
            {
                [callbackName]() {
                    shellRendered = true;
                    const body = new PassThrough();
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set("Content-Type", "text/html");

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        }),
                    );

                    pipe(body);
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            },
        );

        setTimeout(abort, ABORT_DELAY);
    });
}
