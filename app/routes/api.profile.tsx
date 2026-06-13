import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import { logger } from "../utils/logger.server";
import { ProfileUpdateSchema, formatZodErrors } from "../utils/validation";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { checkRateLimit } from "../utils/rateLimit.server";
import { getSession } from "../utils/userSession.server";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

/**
 * Self-service profile update. The customer is identified by the signed session
 * cookie (never by a body field), then name + phone are persisted to the Customer
 * row. This is what makes profile edits — and the Google-OAuth phone-capture form —
 * actually stick (previously updateProfile only wrote sessionStorage).
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;
    const limited = checkRateLimit(request, "profile", 10, 60_000);
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
    const parsed = ProfileUpdateSchema.safeParse(raw);
    if (!parsed.success) return json({ error: formatZodErrors(parsed.error) }, 400);

    const { name, phone } = parsed.data;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");

    try {
        const customer = await prisma.customer.update({
            where: { email: String(sessionEmail).toLowerCase().trim() },
            data: { firstName, lastName, phone: phone.trim() },
        });
        const { passwordHash: _omit, ...safe } = customer;
        return json(safe);
    } catch (e) {
        logger.error({ err: e }, "[profile] update failed");
        return json({ error: "Не вдалося зберегти профіль" }, 500);
    }
}
