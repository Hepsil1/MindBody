import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import { RegisterSchema, formatZodErrors } from "../utils/validation";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const data = await request.json();

        // Zod validation
        const parsed = RegisterSchema.safeParse(data);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: formatZodErrors(parsed.error) }), {
                status: 400, headers: { "Content-Type": "application/json" }
            });
        }

        const { name, email, phone } = parsed.data;

        // Split name into first and last
        const parts = name.trim().split(" ");
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ") || "";

        // Check if customer exists
        const existing = await prisma.customer.findUnique({
            where: { email },
        });

        if (existing) {
            if (phone) {
                await prisma.customer.update({
                    where: { id: existing.id },
                    data: { phone },
                });
            }
            return new Response(JSON.stringify(existing), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // Create new customer
        const newCustomer = await prisma.customer.create({
            data: {
                firstName,
                lastName,
                email,
                phone: phone || null,
            },
        });

        return new Response(JSON.stringify(newCustomer), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Failed to sync customer:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
