/**
 * Analytics — GA4 + Meta Pixel, gated by cookie consent.
 *
 * The page-load script never touches a third-party host; instead the
 * site stays beacon-free until the visitor accepts the cookie banner.
 * On accept (or on first hydration when consent was already stored),
 * `ensureAnalyticsLoaded()` dynamically injects the gtag + fbq init
 * snippets. Track helpers in this module no-op until that's done, so
 * any call site can fire blindly without worrying about timing.
 *
 * IDs come from build-time Vite env (`VITE_GA4_ID`, `VITE_META_PIXEL_ID`).
 * When a variable is empty, the corresponding loader is skipped — the
 * site still renders without analytics, useful for review/staging.
 *
 * All entry points are SSR-safe (typeof window === "undefined" → bail).
 */

const CONSENT_KEY = "mb_cookies_consent_v1";
export const CONSENT_EVENT = "mb-cookies-accepted";

// Vite inlines these at build time. `as string | undefined` keeps the
// types honest when the variable is absent — the rest of the file treats
// "" and undefined identically (truthy check).
// Measurement ID — the data-stream destination. The actual gtag.js + config +
// Consent Mode default live in a STATIC <head> tag (app/root.tsx); this module
// only upgrades consent on banner-accept and fires custom events.
const GA4_ID = (import.meta.env.VITE_GA4_ID || "") as string;
const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID || "") as string;

interface ConsentRecord {
    accepted?: boolean;
    at?: number;
}

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
        fbq?: (...args: unknown[]) => void;
        _fbq?: unknown;
    }
}

let gaLoaded = false;
let pixelLoaded = false;
let consentGranted = false;

export function hasConsent(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = window.localStorage.getItem(CONSENT_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as ConsentRecord;
        return parsed?.accepted === true;
    } catch {
        return false;
    }
}

function bootstrapGtag() {
    // The static <head> tag (app/root.tsx) already defines these before
    // hydration; this is a defensive fallback so event helpers never throw if
    // they somehow run first.
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
        window.gtag = function gtag(...args: unknown[]) {
            window.dataLayer?.push(args);
        };
    }
}

// GA4 is installed STATICALLY in the document <head> (see app/root.tsx): the
// gtag.js loader, Consent Mode default (denied → cookieless), and gtag('config')
// all run there, before hydration, so Google's crawler/tag-detector see the tag
// in the served HTML and data collection starts immediately. This module no
// longer injects gtag.js; it only makes sure gtag() exists for the event
// helpers below and lets grantConsent() upgrade Consent Mode on banner-accept.
function loadGA4() {
    if (gaLoaded || !GA4_ID) return;
    gaLoaded = true;
    bootstrapGtag();
}

// Upgrade Consent Mode to granted (analytics + ads cookies) and bring up the
// Meta Pixel, which has no cookieless mode and so only loads after consent.
function grantConsent() {
    if (consentGranted) return;
    consentGranted = true;
    bootstrapGtag();
    window.gtag?.("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
    });
    loadMetaPixel();
}

function loadMetaPixel() {
    if (pixelLoaded || !META_PIXEL_ID) return;
    pixelLoaded = true;
    // Standard fbq bootstrap, lifted from Meta's own snippet. The IIFE
    // creates the queue function before the actual library loads so any
    // synchronous .fbq() calls below get buffered correctly.
    type FbqFn = ((...args: unknown[]) => void) & {
        callMethod?: (...a: unknown[]) => void;
        queue?: unknown[];
        push?: unknown;
        loaded?: boolean;
        version?: string;
    };
    if (!window.fbq) {
        const n: FbqFn = function (...args: unknown[]) {
            if (n.callMethod) {
                n.callMethod(...args);
            } else {
                n.queue?.push(args);
            }
        };
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        window.fbq = n as unknown as Window["fbq"];
        if (!window._fbq) window._fbq = n;
        const t = document.createElement("script");
        t.async = true;
        t.src = "https://connect.facebook.net/en_US/fbevents.js";
        const s = document.getElementsByTagName("script")[0];
        s.parentNode?.insertBefore(t, s);
    }
    window.fbq?.("init", META_PIXEL_ID);
    window.fbq?.("track", "PageView");
}

/**
 * Mount entry point — runs on every page load. Brings up GA4 immediately
 * under Consent Mode (default denied → cookieless, tag is detectable). If the
 * visitor already accepted on a previous visit, upgrade to granted at once.
 * Idempotent; subsequent calls are fast no-ops.
 */
export function ensureAnalyticsLoaded() {
    if (typeof window === "undefined") return;
    if (!GA4_ID && !META_PIXEL_ID) return; // nothing to load
    loadGA4();
    if (hasConsent()) grantConsent();
}

/**
 * Called when the cookie banner's accept event fires. Upgrades consent to
 * granted (cookies on) and loads the Meta Pixel.
 */
export function onConsentAccepted() {
    if (typeof window === "undefined") return;
    if (!GA4_ID && !META_PIXEL_ID) return;
    loadGA4();
    grantConsent();
}

// ─── Event helpers ────────────────────────────────────────────────────
// Each one fires the equivalent GA4 + Meta Pixel event when analytics
// is loaded; otherwise no-op. Names map to the GA4 e-commerce schema
// (`items` is the canonical key); Meta gets its own event-name dialect.

interface ItemInput {
    id: string;
    name: string;
    price?: number;
    category?: string | null;
    quantity?: number;
    variant?: string;
}

function toGa4Item(it: ItemInput) {
    return {
        item_id: it.id,
        item_name: it.name,
        item_category: it.category || undefined,
        item_variant: it.variant,
        price: it.price ?? 0,
        quantity: it.quantity ?? 1,
        currency: "UAH",
    };
}

export function trackViewItem(item: ItemInput) {
    if (typeof window === "undefined") return;
    const value = (item.price ?? 0) * (item.quantity ?? 1);
    window.gtag?.("event", "view_item", {
        currency: "UAH",
        value,
        items: [toGa4Item(item)],
    });
    window.fbq?.("track", "ViewContent", {
        content_ids: [item.id],
        content_name: item.name,
        content_type: "product",
        value,
        currency: "UAH",
    });
}

export function trackAddToCart(item: ItemInput) {
    if (typeof window === "undefined") return;
    const value = (item.price ?? 0) * (item.quantity ?? 1);
    window.gtag?.("event", "add_to_cart", {
        currency: "UAH",
        value,
        items: [toGa4Item(item)],
    });
    window.fbq?.("track", "AddToCart", {
        content_ids: [item.id],
        content_name: item.name,
        content_type: "product",
        value,
        currency: "UAH",
    });
}

export function trackBeginCheckout(items: ItemInput[], total: number) {
    if (typeof window === "undefined") return;
    window.gtag?.("event", "begin_checkout", {
        currency: "UAH",
        value: total,
        items: items.map(toGa4Item),
    });
    window.fbq?.("track", "InitiateCheckout", {
        content_ids: items.map((i) => i.id),
        contents: items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1 })),
        num_items: items.reduce((a, b) => a + (b.quantity ?? 1), 0),
        value: total,
        currency: "UAH",
    });
}

export function trackPurchase(opts: { orderId: string; items: ItemInput[]; total: number }) {
    if (typeof window === "undefined") return;
    window.gtag?.("event", "purchase", {
        transaction_id: opts.orderId,
        currency: "UAH",
        value: opts.total,
        items: opts.items.map(toGa4Item),
    });
    window.fbq?.("track", "Purchase", {
        content_ids: opts.items.map((i) => i.id),
        contents: opts.items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1 })),
        num_items: opts.items.reduce((a, b) => a + (b.quantity ?? 1), 0),
        value: opts.total,
        currency: "UAH",
    });
}

export function trackSearch(query: string) {
    if (typeof window === "undefined" || !query) return;
    window.gtag?.("event", "search", { search_term: query });
    window.fbq?.("track", "Search", { search_string: query });
}
