import { useEffect } from "react";
import { ensureAnalyticsLoaded, CONSENT_EVENT } from "../utils/analytics.client";

/**
 * Mounted once at the root. Loads GA4 + Meta Pixel exactly when
 * consent is present — either on first hydration (visitor accepted
 * on a previous visit) or after the cookie banner dispatches the
 * accept event from the current session. Renders nothing.
 */
export default function Analytics() {
    useEffect(() => {
        // First-paint check covers returning visitors whose consent
        // is already stored — they don't see the banner, but analytics
        // still needs to come up.
        ensureAnalyticsLoaded();
        // Same-session: banner fires this after the click; idempotent.
        const onAccept = () => ensureAnalyticsLoaded();
        window.addEventListener(CONSENT_EVENT, onAccept);
        return () => window.removeEventListener(CONSENT_EVENT, onAccept);
    }, []);
    return null;
}
