import { prisma } from "../db.server";

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const { contact } = body;

        if (!contact || contact.trim().length < 3) {
            return Response.json({ error: "Введіть номер телефону або email" }, { status: 400 });
        }

        const trimmed = contact.trim().substring(0, 100);
        const id = crypto.randomUUID();

        await prisma.$executeRawUnsafe(
            `INSERT INTO "ContactRequest" (id, contact, "createdAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
            id, trimmed
        );

        // Also send to Telegram
        try {
            const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
            const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
            if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
                const msg = `📩 Нова заявка на зворотній зв'язок!\n\nКонтакт: ${trimmed}\nЧас: ${new Date().toLocaleString('uk-UA')}`;
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
                });
            }
        } catch { /* Telegram is optional */ }

        return Response.json({ success: true });
    } catch (e) {
        console.error("Contact request error:", e);
        return Response.json({ error: "Помилка збереження" }, { status: 500 });
    }
}
