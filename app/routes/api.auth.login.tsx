import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger.server";
import { LoginSchema, formatZodErrors } from "../utils/validation";

/**
 * Login API — Authenticates customer with email/password.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Not allowed", { status: 405 });
    }

    try {
        const raw = await request.json();
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: formatZodErrors(parsed.error) }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }
        const { email, password } = parsed.data;

        // Find customer by email (Zod already lowercased the email).
        const customer = await prisma.customer.findUnique({
            where: { email },
        });

        if (!customer) {
            return new Response(JSON.stringify({ error: "Невірний email або пароль" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const passwordHash = customer.passwordHash;
        if (!passwordHash) {
            return new Response(
                JSON.stringify({ error: "Цей акаунт використовує вхід через Google" }),
                { status: 401, headers: { "Content-Type": "application/json" } },
            );
        }

        const valid = await bcrypt.compare(password, passwordHash);
        if (!valid) {
            return new Response(JSON.stringify({ error: "Невірний email або пароль" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // NEVER send the bcrypt hash (or any secret column) to the client —
        // auth.ts persists this object into sessionStorage, so the hash would be
        // readable in DevTools and exfiltratable for offline cracking.
        const { passwordHash: _omitHash, ...safeCustomer } = customer;
        return new Response(JSON.stringify(safeCustomer), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        logger.error({ err: e }, "[auth] login failed");
        return new Response(JSON.stringify({ error: "Помилка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
