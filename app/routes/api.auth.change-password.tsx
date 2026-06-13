import type { ActionFunctionArgs } from "react-router";
import bcrypt from "bcryptjs";
import { prisma } from "../db.server";
import { logger } from "../utils/logger.server";
import { ChangePasswordSchema, formatZodErrors } from "../utils/validation";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { checkRateLimit } from "../utils/rateLimit.server";
import { getSession } from "../utils/userSession.server";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

/**
 * Change the password of the currently logged-in customer. Identity comes from
 * the session cookie; the current password is verified with bcrypt before the
 * new one is hashed and stored. (The profile UI posted here all along — the route
 * just never existed, so "Змінити пароль" always 404'd.)
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;
    const limited = checkRateLimit(request, "change-password", 5, 60_000);
    if (limited) return limited;

    const session = await getSession(request.headers.get("Cookie"));
    const sessionEmail = session.get("email");
    if (!sessionEmail) return json({ error: "Unauthorized" }, 401);

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return json({ error: "Invalid JSON" }, 400);
    }
    const parsed = ChangePasswordSchema.safeParse(raw);
    if (!parsed.success) return json({ error: formatZodErrors(parsed.error) }, 400);
    const { currentPassword, newPassword } = parsed.data;

    try {
        const customer = await prisma.customer.findUnique({
            where: { email: String(sessionEmail).toLowerCase().trim() },
        });
        if (!customer) return json({ error: "Unauthorized" }, 401);
        if (!customer.passwordHash) {
            return json(
                { error: "Цей акаунт використовує вхід через Google — пароль не встановлено" },
                400,
            );
        }
        const ok = await bcrypt.compare(currentPassword, customer.passwordHash);
        if (!ok) return json({ error: "Поточний пароль невірний" }, 400);

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.customer.update({
            where: { id: customer.id },
            data: { passwordHash: newHash },
        });
        return json({ success: true });
    } catch (e) {
        logger.error({ err: e }, "[auth] change-password failed");
        return json({ error: "Помилка зміни паролю" }, 500);
    }
}
