import { useEffect } from "react";
import { ensureAnalyticsLoaded, onConsentAccepted, CONSENT_EVENT } from "../utils/analytics.client";

/**
 * Mounted once at the root. Brings GA4 + Meta Pixel consent up — on first
 * hydration (visitor accepted on a previous visit) or after the cookie banner's
 * accept event. Renders nothing.
 *
 * page_views are NOT emitted here: the static gtag config (app/root.tsx) sends
 * the initial one, and GA4 Enhanced Measurement tracks SPA <Link> navigations
 * automatically. Adding a manual route-change page_view would double-count
 * every navigation against Enhanced Measurement (verified on prod).
 */
export default function Analytics() {
    useEffect(() => {
        // First-paint check covers returning visitors whose consent
        // is already stored — they don't see the banner, but analytics
        // still needs to come up.
        ensureAnalyticsLoaded();
        // Same-session: banner fires this after the click → upgrade consent.
        const onAccept = () => onConsentAccepted();
        window.addEventListener(CONSENT_EVENT, onAccept);
        return () => window.removeEventListener(CONSENT_EVENT, onAccept);
    }, []);
    return null;
}
