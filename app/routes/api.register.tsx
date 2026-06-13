import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger.server";
import { RegisterSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { getSession, commitSession } from "../utils/userSession.server";
import { sendTelegramMessage } from "../utils/telegram.server";

/**
 * Registration API — creates a customer (hashed password) and issues a session.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Not allowed", { status: 405 });
    }

    // CSRF + abuse protection.
    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;
    const rateLimited = checkRateLimit(request, "register", 5, 60_000);
    if (rateLimited) return rateLimited;

    try {
        const raw = await request.json();
        const parsed = RegisterSchema.safeParse(raw);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: formatZodErrors(parsed.error) }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }
        const { name, email, password, phone } = parsed.data;

        // Check if email already exists (Zod already lowercased + trimmed).
        const existing = await prisma.customer.findUnique({ where: { email } });

        if (existing) {
            // 409 is kept intentionally: the signup UX logs the user straight in
            // from this response, so a fake "success" for an existing email would
            // break the flow. The (lower-risk) enumeration here is rate-limited.
            return new Response(
                JSON.stringify({ error: "Цей email вже зареєстровано. Спробуйте увійти." }),
                { status: 409, headers: { "Content-Type": "application/json" } },
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Split name into first and last
        const nameParts = name.trim().split(" ");
        const firstName = nameParts[0] || email.split("@")[0];
        const lastName = nameParts.slice(1).join(" ") || "";

        // Create customer (email already lowercased by Zod schema).
        const customer = await prisma.customer.create({
            data: {
                firstName,
                lastName,
                email,
                phone: phone || null,
                avatar: null,
                passwordHash: hashedPassword,
            },
        });

        // Notify operators server-side. The browser no longer calls
        // /api/telegram/send (now locked down), so the new-registration alert is
        // sent here. Fire-and-forget: 3s timeout, never blocks the response.
        const notify = `🎉 *НОВА РЕЄСТРАЦІЯ - MIND BODY*\n━━━━━━━━━━━━━━━━━━━━━\n👤 *Ім'я:* ${`${firstName} ${lastName}`.trim()}\n📧 *Email:* ${email}\n📱 *Телефон:* ${phone || "Не вказано"}\n📅 *Дата:* ${new Date().toLocaleString("uk-UA")}\n━━━━━━━━━━━━━━━━━━━━━`;
        void sendTelegramMessage(notify, { parseMode: "Markdown" });

        // Issue the server session cookie alongside the response body.
        const session = await getSession(request.headers.get("Cookie"));
        session.set("email", customer.email.toLowerCase().trim());
        session.set("customerId", customer.id);

        // Never echo the bcrypt hash back to the client (it lands in sessionStorage).
        const { passwordHash: _omitHash, ...safeCustomer } = customer;
        return new Response(JSON.stringify(safeCustomer), {
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": await commitSession(session),
            },
        });
    } catch (e) {
        logger.error({ err: e }, "[auth] registration failed");
        return new Response(JSON.stringify({ error: "Помилка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
