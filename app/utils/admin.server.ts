import { createCookie } from "react-router";
import { randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const SESSION_SECRET = process.env.SESSION_SECRET || "default_dev_secret_replace_me_in_prod";

// Fail fast in production if the session secret was never set: the admin cookie
// is signed with it, so the public default value would make sessions forgeable.
if (
    process.env.NODE_ENV === "production" &&
    SESSION_SECRET === "default_dev_secret_replace_me_in_prod"
) {
    throw new Error(
        "SESSION_SECRET must be set in production — it signs the admin session cookie.",
    );
}

// Simple admin session cookie
// secure: only true when SITE_URL uses https (prevents broken auth if HTTPS isn't set up yet)
export const adminSession = createCookie("admin_session", {
    maxAge: 604800, // 7 days
    httpOnly: true,
    secure: (process.env.SITE_URL || "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    secrets: [SESSION_SECRET],
});

// Optional username gate. Auth was password-only historically; the login
// form now also asks for a username so the admin has a login + password
// pair. Defaults to "Admin" when ADMIN_USERNAME is unset.
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Admin";

let warnedPlaintext = false;

/**
 * Verify an admin password attempt. Prefers a bcrypt hash in ADMIN_PASSWORD_HASH
 * (bcrypt.compare is constant-time). Falls back to the legacy plaintext
 * ADMIN_PASSWORD during the transition — compared in constant time, with a
 * one-time warning. Generate a hash with `node scripts/hash-admin-password.mjs
 * <password>` and set ADMIN_PASSWORD_HASH, then ADMIN_PASSWORD can be removed.
 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (hash) return bcrypt.compare(input, hash);

    const plain = process.env.ADMIN_PASSWORD;
    if (plain) {
        if (!warnedPlaintext) {
            warnedPlaintext = true;
            console.warn(
                "[admin] Using plaintext ADMIN_PASSWORD. Generate a hash with " +
                    "`node scripts/hash-admin-password.mjs <password>` and set ADMIN_PASSWORD_HASH.",
            );
        }
        return timingSafeEqualStr(input, plain);
    }
    return false;
}

/** Constant-time string compare that doesn't early-exit on a length mismatch. */
function timingSafeEqualStr(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
        timingSafeEqual(bufA, bufA); // keep timing roughly flat
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

/** A random opaque session token, stored (signed) in the cookie on login. */
export function newSessionToken(): string {
    return randomUUID();
}

export async function isAuthenticated(request: Request) {
    try {
        const cookieHeader = request.headers.get("Cookie");
        if (!cookieHeader) return false;
        const value = await adminSession.parse(cookieHeader);
        // Any non-empty, validly-signed value is an authenticated session. Login
        // issues a random token; the legacy literal "authenticated" still
        // validates so existing sessions aren't force-logged-out.
        return typeof value === "string" && value.length > 0;
    } catch {
        return false;
    }
}
