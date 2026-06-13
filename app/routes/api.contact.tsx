import { prisma } from "../db.server";
import { checkRateLimit } from "../utils/rateLimit.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { sendTelegramMessage } from "../utils/telegram.server";

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // CSRF: reject demonstrably cross-origin POSTs.
    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;

    // Rate limit: 5 requests per minute
    const rateLimited = checkRateLimit(request, "contact", 5, 60_000);
    if (rateLimited) return rateLimited;

    try {
        const body = await request.json();
        // Accepts both the Footer's simple { contact } and the Contacts page's
        // richer { name, contact, message }. The client never supplies the
        // Telegram message body — the server composes it from validated fields
        // (that client-controlled body was the /api/telegram/send hole).
        const pick = (v: unknown, max: number) =>
            typeof v === "string" ? v.trim().slice(0, max) : "";
        const contact = pick(body?.contact, 100);
        const name = pick(body?.name, 100);
        const message = pick(body?.message, 2000);

        if (contact.length < 3) {
            return Response.json({ error: "Введіть номер телефону або email" }, { status: 400 });
        }

        // Persist the contact so the lead survives even if Telegram is down.
        await prisma.contactRequest.create({
            data: { contact },
        });

        // Notify via Telegram — fire-and-forget (3s timeout, never throws). Plain
        // text (no parse_mode) so user-supplied name/message can't break Markdown.
        const msg = [
            "📩 Нова заявка з сайту",
            name ? `👤 Ім'я: ${name}` : null,
            `📞 Контакт: ${contact}`,
            message ? `💬 Повідомлення: ${message}` : null,
            `🕒 ${new Date().toLocaleString("uk-UA")}`,
        ]
            .filter(Boolean)
            .join("\n");
        void sendTelegramMessage(msg);

        return Response.json({ success: true });
    } catch (e) {
        console.error("Contact request error:", e);
        return Response.json({ error: "Помилка збереження" }, { status: 500 });
    }
}
