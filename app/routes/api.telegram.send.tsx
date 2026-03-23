import { isAuthenticated } from "../utils/admin.server";

// Server-side only — Telegram token from env, NEVER hardcoded
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const INTERNAL_SECRET = process.env.TELEGRAM_INTERNAL_SECRET || process.env.SESSION_SECRET || "";

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Auth: internal token (server-to-server) OR admin cookie OR same-origin browser call
    const internalToken = request.headers.get("X-Internal-Token") || "";
    const isInternalCall = INTERNAL_SECRET && internalToken === INTERNAL_SECRET;
    const isAdmin = await isAuthenticated(request);
    
    // Same-origin check: browsers enforce Origin header on POST — not spoofable from cross-site
    const origin = request.headers.get("Origin") || "";
    const requestHost = new URL(request.url).origin;
    const isSameOrigin = origin && origin === requestHost;

    if (!isInternalCall && !isAdmin && !isSameOrigin) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("Telegram credentials not configured in env");
        return Response.json({ success: false, error: "Telegram not configured" }, { status: 500 });
    }

    try {
        const { message } = await request.json();

        if (!message || typeof message !== "string") {
            return Response.json({ error: "Message is required" }, { status: 400 });
        }

        const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: "Markdown",
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Telegram API error:", errorData);
            return Response.json({ success: false, error: "Failed to send" }, { status: 500 });
        }

        return Response.json({ success: true });
    } catch (error) {
        console.error("Telegram send error:", error);
        return Response.json({ success: false, error: "Server error" }, { status: 500 });
    }
}
