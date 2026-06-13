// Google OAuth 2.0 (Authorization Code) helpers — server-side only.
//
// The storefront login page already redirects to /api/auth/google and the
// /auth/callback page already consumes ?user=... — only the two server routes
// were missing. This module centralizes the Google endpoints, the signed
// one-time state cookie (CSRF for the OAuth round-trip), and the code→profile
// exchange. Everything is inert until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
// GOOGLE_REDIRECT_URI are set in the environment (all-or-none, enforced in
// env.server.ts), so shipping these routes can't break a deploy without creds.

import { createCookie } from "react-router";
import { env } from "./env.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const FETCH_TIMEOUT_MS = 5000;

/** Signed, HttpOnly, 10-minute one-time cookie holding the OAuth state nonce. */
export const googleStateCookie = createCookie("g_oauth_state", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.SITE_URL || "").startsWith("https://"),
    maxAge: 600,
    secrets: [process.env.SESSION_SECRET || "default_dev_secret_replace_me_in_prod"],
});

/** True only when all three Google OAuth vars are configured. */
export function googleConfigured(): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

/** Build the Google consent-screen URL for the start of the flow. */
export function buildGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID ?? "",
        redirect_uri: env.GOOGLE_REDIRECT_URI ?? "",
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account",
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleProfile {
    email: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
}

/**
 * Exchange the authorization code for an access token and fetch the user's
 * profile. Returns null on any failure (bad code, network, timeout) so the
 * caller can redirect to /auth with a generic error. Both calls are bounded by
 * a 5s timeout — a hanging Google endpoint can't stall the callback request.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile | null> {
    try {
        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: env.GOOGLE_CLIENT_ID ?? "",
                client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
                redirect_uri: env.GOOGLE_REDIRECT_URI ?? "",
                grant_type: "authorization_code",
            }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!tokenRes.ok) return null;
        const token = (await tokenRes.json()) as { access_token?: string };
        if (!token.access_token) return null;

        const profRes = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${token.access_token}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!profRes.ok) return null;

        const profile = (await profRes.json()) as GoogleProfile;
        return profile?.email ? profile : null;
    } catch {
        return null;
    }
}
