import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import bcrypt from "bcryptjs";

/**
 * Registration API — Creates a new customer with hashed password.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Not allowed", { status: 405 });
    }

    try {
        const body = await request.json();
        const { name, email, password, phone } = body;

        if (!name || !email || !password) {
            return new Response(JSON.stringify({ error: "Всі поля обов'язкові" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Check if email already exists
        const existing = await prisma.customer.findUnique({
            where: { email: email.toLowerCase() },
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

        // Create customer
        const customer = await prisma.customer.create({
            data: {
                firstName,
                lastName,
                email: email.toLowerCase(),
                phone: phone || null,
                avatar: null,
                passwordHash: hashedPassword,
            },
        });

        return new Response(JSON.stringify(customer), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        console.error("Registration error:", e);
        return new Response(JSON.stringify({ error: "Помилка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
