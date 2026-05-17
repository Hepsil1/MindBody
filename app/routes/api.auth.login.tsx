import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import bcrypt from "bcryptjs";

/**
 * Login API — Authenticates customer with email/password.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Not allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email та пароль обов'язкові" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Find customer by email
        const customer = await prisma.customer.findUnique({
            where: { email: email.toLowerCase() },
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

        return new Response(JSON.stringify(customer), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        console.error("Login error:", e);
        return new Response(JSON.stringify({ error: "Помилка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
