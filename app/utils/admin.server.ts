import { createCookie } from "react-router";

// Simple admin session cookie
export const adminSession = createCookie("admin_session", {
    maxAge: 604800, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    secrets: [process.env.SESSION_SECRET || "mindbody_admin_secret_default_123"],
});

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin"; // Use env var or default

export async function isAuthenticated(request: Request) {
    try {
        const cookieHeader = request.headers.get("Cookie");
        if (!cookieHeader) return false;
        const value = await adminSession.parse(cookieHeader);
        return value === "authenticated";
    } catch (e) {
        return false;
    }
}
