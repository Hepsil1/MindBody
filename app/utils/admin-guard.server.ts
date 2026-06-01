// Single entry guard for admin actions and loaders.
//
// Unifies the previously inconsistent auth handling (some routes redirected,
// some returned a 401 Response) AND adds CSRF defence-in-depth: state-changing
// requests must be same-origin. Combined with the SameSite=Lax session cookie,
// this blocks the cross-site request-forgery class at near-zero cost.

import { redirect } from "react-router";
import { isAuthenticated } from "./admin.server";

/**
 * True when the request's Origin/Referer host matches the Host header. We compare
 * against the Host header (which a reverse proxy like Caddy forwards) rather than
 * reconstructing the origin from request.url, so it stays correct behind the
 * proxy in production as well as in local dev.
 */
export function isSameOrigin(request: Request): boolean {
    const host = request.headers.get("Host");
    if (!host) return false;
    const source = request.headers.get("Origin") ?? request.headers.get("Referer");
    if (!source) return false;
    try {
        return new URL(source).host === host;
    } catch {
        return false;
    }
}

/**
 * Guard an admin action/loader. Returns a redirect Response when unauthenticated
 * (return it from your action), or throws a 403 Response for a cross-origin
 * state-changing request. Returns null when the request may proceed.
 *
 *   export async function action({ request }: Route.ActionArgs) {
 *     const denied = await requireAdmin(request);
 *     if (denied) return denied;
 *     // ... mutation ...
 *   }
 */
export async function requireAdmin(request: Request): Promise<Response | null> {
    if (!(await isAuthenticated(request))) {
        return redirect("/admin/login");
    }
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        if (!isSameOrigin(request)) {
            throw new Response("Forbidden (cross-origin request rejected)", { status: 403 });
        }
    }
    return null;
}
