// CSRF guard for customer-facing POST endpoints.
//
// Admin routes use the stricter requireAdmin (which rejects when Origin/Referer
// is absent). Customer endpoints are also hit by non-browser clients we control —
// the deploy e2e scripts (scripts/*.mjs) and monitoring — which send no Origin
// header. So here we reject only on a *demonstrable* cross-origin request
// (Origin/Referer present and host mismatch), and allow requests with no Origin.
//
// This still closes the browser-driven CSRF vector: a victim's browser ALWAYS
// attaches an unforgeable Origin header on a cross-site POST (fetch/XHR and form
// submits alike). These endpoints additionally read application/json bodies,
// which a cross-site HTML form cannot produce — so this check is defence-in-depth
// on top of that inherent resistance.

/**
 * Returns a 403 JSON Response when the request is provably cross-origin,
 * otherwise null. Use at the top of a customer POST action:
 *
 *   const denied = rejectCrossOrigin(request);
 *   if (denied) return denied;
 */
export function rejectCrossOrigin(request: Request): Response | null {
    const host = request.headers.get("Host");
    const source = request.headers.get("Origin") ?? request.headers.get("Referer");
    // No Origin/Referer to compare → not a browser cross-site POST. Allow.
    if (!host || !source) return null;

    let sameHost = false;
    try {
        sameHost = new URL(source).host === host;
    } catch {
        sameHost = false; // malformed Origin/Referer → treat as cross-origin
    }

    if (sameHost) return null;

    return new Response(JSON.stringify({ error: "Forbidden (cross-origin request rejected)" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
    });
}
