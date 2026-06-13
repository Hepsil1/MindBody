import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
    // Identity comes from the signed HttpOnly session cookie set at login — never
    // from a query param. This fixes the previously-broken order history (the
    // session email was never populated, so this endpoint always 403'd) AND closes
    // the latent IDOR where an attacker could read any customer's orders via ?email=.
    const { getSession } = await import("../utils/userSession.server");
    const session = await getSession(request.headers.get("Cookie"));
    const sessionEmail = session.get("email");

    if (!sessionEmail) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const emailLower = String(sessionEmail).toLowerCase().trim();

    try {
        // Find customer by email, case-insensitively.
        const customer = await prisma.customer.findFirst({
            where: { email: { equals: emailLower, mode: "insensitive" } },
            select: { id: true, email: true },
        });

        if (!customer) {
            console.log(`No customer found for email: ${emailLower}`);
            return new Response(JSON.stringify([]), {
                headers: { "Content-Type": "application/json" },
            });
        }

        console.log(`Found customer: ${customer.id}, email: ${customer.email}`);

        // Now get orders for this customer
        const orders = await prisma.order.findMany({
            where: { customerId: customer.id },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                customer: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        console.log(`Found ${orders.length} orders for customer ${customer.id}`);

        // Format orders for frontend (typed via the findMany return shape)
        const formattedOrders = orders.map((order) => ({
            id: String(order.orderNumber),
            date: new Date(order.createdAt).toLocaleDateString("uk-UA"),
            status: order.status,
            total: Number(order.total),
            items: order.items.map((item) => ({
                name: item.product?.name || "Товар",
                image: item.product?.images ? JSON.parse(item.product.images)[0] : "/brand-sun.png",
                quantity: item.quantity,
                price: Number(item.price),
                size: item.size,
                color: item.color,
            })),
        }));

        return new Response(JSON.stringify(formattedOrders), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
