import crypto from "crypto";

/**
 * Generates a cryptographically strong, 192-bit URL-safe token (32 base64url chars).
 * Used for secure guest access to the order status & confirmation screen (/order/:token).
 */
export function generateOrderToken(): string {
    return crypto.randomBytes(24).toString("base64url");
}

/**
 * Validates token format before hitting the database.
 */
export function isWellFormedToken(token: string): boolean {
    return /^[A-Za-z0-9_-]{32,64}$/.test(token);
}
