// Server-side only — Telegram token is NEVER exposed to the client
const TELEGRAM_BOT_TOKEN = "7516303735:AAFZtMq37IfEFmDzNTkNrZiKh8OOBjpiTQ0";
const TELEGRAM_CHAT_ID = "5429418837";

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
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
