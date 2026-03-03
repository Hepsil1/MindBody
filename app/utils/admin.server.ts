import { createCookie } from "react-router";

// Simple admin session cookie
export const adminSession = createCookie("admin_session", {
    maxAge: 604800, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    secrets: ["mindbody_admin_secret"],
});

export const ADMIN_PASSWORD = "admin"; // Default password for now

export async function isAuthenticated(request: Request) {
    const cookieHeader = request.headers.get("Cookie");
    const value = await adminSession.parse(cookieHeader);
    return value === "authenticated";
}
