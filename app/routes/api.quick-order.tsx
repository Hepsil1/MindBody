import { prisma } from "../db.server";
import { checkRateLimit } from "../utils/rateLimit.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { sendTelegramMessage } from "../utils/telegram.server";

// Quick-order ("Швидке замовлення") lead from the product page.
//
// The product page used to POST a fully-composed message straight to
// /api/telegram/send — which is exactly the arbitrary-message-injection vector
// that route was locked down to close. Here the client sends STRUCTURED fields
// only and the server composes the Telegram text, so a visitor can't inject
// arbitrary content. The lead is also persisted as a ContactRequest so it
// survives a Telegram outage (the old direct-send dropped it silently).
export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;

    const rateLimited = checkRateLimit(request, "quick-order", 5, 60_000);
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

    const str = (v: unknown, max: number): string =>
        typeof v === "string"
            ? v.trim().slice(0, max)
            : typeof v === "number" && Number.isFinite(v)
              ? String(v).slice(0, max)
              : "";

    const phone = str(b.phone, 20);
    const name = str(b.name, 100);
    const productName = str(b.productName, 200);
    const price = str(b.price, 20);
    const size = str(b.size, 50);
    const color = str(b.color, 50);

    // Phone is the one required field (mirrors the client's phone.length < 10 gate).
    if (phone.replace(/\D/g, "").length < 10) {
        return Response.json({ error: "Вкажіть коректний номер телефону" }, { status: 400 });
    }

    try {
        // Persist as a contact lead so it isn't lost if Telegram is unreachable.
        await prisma.contactRequest.create({
            data: {
                contact: `${phone}${name ? ` (${name})` : ""} — ${productName || "товар"}`.slice(
                    0,
                    100,
                ),
            },
        });

        const msg = [
            "🔥 ШВИДКЕ ЗАМОВЛЕННЯ",
            productName ? `📦 ${productName}` : null,
            price ? `💰 ${price} ₴` : null,
            size ? `📏 Розмір: ${size}` : null,
            color ? `🎨 Колір: ${color}` : null,
            `👤 Ім'я: ${name || "Не вказано"}`,
            `📞 Телефон: ${phone}`,
        ]
            .filter(Boolean)
            .join("\n");
        void sendTelegramMessage(msg);

        return Response.json({ success: true });
    } catch (e) {
        console.error("Quick order error:", e);
        return Response.json({ error: "Помилка збереження" }, { status: 500 });
    }
}
