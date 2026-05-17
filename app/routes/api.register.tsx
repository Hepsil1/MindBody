import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger.server";
import { RegisterSchema, formatZodErrors } from "../utils/validation";

/**
 * Registration API — Creates a new customer with hashed password.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Not allowed", { status: 405 });
    }

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
        const existing = await prisma.customer.findUnique({
            where: { email },
        });

        if (existing) {
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

        return new Response(JSON.stringify(customer), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        logger.error({ err: e }, "[auth] registration failed");
        return new Response(JSON.stringify({ error: "Помилка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
