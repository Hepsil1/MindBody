import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { prisma } from "../db.server";
import { logger } from "../utils/logger.server";
import { getSession, commitSession } from "../utils/userSession.server";
import {
    googleConfigured,
    exchangeGoogleCode,
    googleStateCookie,
} from "../utils/googleAuth.server";

// Google OAuth callback. Validates the state nonce against the signed cookie,
// exchanges the code for the user's profile, upserts the customer (no password —
// Google accounts have passwordHash = null), issues the same HttpOnly session
// cookie as email login, then redirects to /auth/callback?user=... so the client
// can populate sessionStorage for UI state. The cookie is the real auth.
export async function loader({ request }: LoaderFunctionArgs) {
    if (!googleConfigured()) {
        return redirect("/auth?error=google_unavailable");
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) {
        return redirect("/auth?error=google_failed");
    }

    // CSRF: the state must match the signed cookie set when the flow started.
    const cookieState = await googleStateCookie.parse(request.headers.get("Cookie"));
    if (!cookieState || cookieState !== state) {
        return redirect("/auth?error=google_state");
    }

    const profile = await exchangeGoogleCode(code);
    if (!profile?.email) {
        return redirect("/auth?error=google_failed");
    }

    const email = profile.email.toLowerCase().trim();
    const firstName =
        profile.given_name?.trim() || profile.name?.trim().split(" ")[0] || email.split("@")[0];
    const lastName = profile.family_name?.trim() || "";
    const avatar = profile.picture || null;

    let customer;
    try {
        customer = await prisma.customer.upsert({
            where: { email },
            // Returning Google users: refresh the avatar only; never clobber a
            // name the customer may have edited, and never touch passwordHash.
            update: avatar ? { avatar } : {},
            create: { email, firstName, lastName, avatar, passwordHash: null },
        });
    } catch (e) {
        logger.error({ err: e }, "[auth] google upsert failed");
        return redirect("/auth?error=google_failed");
    }

    // Issue the server session (same as email login).
    const session = await getSession(request.headers.get("Cookie"));
    session.set("email", customer.email.toLowerCase().trim());
    session.set("customerId", customer.id);

    // Minimal user object for the client's handleOAuthCallback (UI state only).
    const userParam = encodeURIComponent(
        JSON.stringify({
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            avatar: customer.avatar,
            createdAt: customer.createdAt,
        }),
    );

    // Commit the session AND expire the one-time state cookie.
    const headers = new Headers();
    headers.append("Set-Cookie", await commitSession(session));
    headers.append("Set-Cookie", await googleStateCookie.serialize("", { maxAge: 0 }));
    return redirect(`/auth/callback?user=${userParam}`, { headers });
}
