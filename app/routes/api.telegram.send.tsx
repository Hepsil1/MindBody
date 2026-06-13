import { isAuthenticated } from "../utils/admin.server";
import { sendTelegramMessage } from "../utils/telegram.server";

// Internal server-to-server secret. Falls back to SESSION_SECRET so a dedicated
// var is optional. Used by trusted callers that set the X-Internal-Token header.
const INTERNAL_SECRET = process.env.TELEGRAM_INTERNAL_SECRET || process.env.SESSION_SECRET || "";

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Authorization: a server-to-server internal token OR an authenticated admin.
    //
    // The previous "same-origin browser POST is allowed" rule made this a public
    // message-injection channel: any visitor — or any script running on the page —
    // could relay arbitrary text (with Markdown) into the operators' Telegram,
    // enabling spam and staff-targeted phishing. Every legitimate browser lead
    // (registration, quick-order, contact form) now goes through a dedicated
    // server-side endpoint that composes the message from validated fields, so no
    // browser calls this route anymore.
    const internalToken = request.headers.get("X-Internal-Token") || "";
    const isInternalCall = Boolean(INTERNAL_SECRET) && internalToken === INTERNAL_SECRET;
    const isAdmin = await isAuthenticated(request);

    if (!isInternalCall && !isAdmin) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let message: unknown;
    try {
        ({ message } = await request.json());
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!message || typeof message !== "string") {
        return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const ok = await sendTelegramMessage(message, { parseMode: "Markdown" });
    return ok
        ? Response.json({ success: true })
        : Response.json({ success: false, error: "Failed to send" }, { status: 502 });
}
