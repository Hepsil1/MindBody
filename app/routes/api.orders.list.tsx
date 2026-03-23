import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    if (!email) {
        return new Response("Email required", { status: 400 });
    }

    try {
        const { getSession } = await import("../utils/userSession.server");
        const session = await getSession(request.headers.get("Cookie"));
        const sessionEmail = session.get("email");

        // Protect from IDOR (only allow fetching own orders)
        if (!sessionEmail || sessionEmail !== email.toLowerCase().trim()) {
            return new Response(JSON.stringify({ error: "Unauthorized access to orders" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }
        // Use case-insensitive email matching 
        const emailLower = email.toLowerCase().trim();

        // First find customer by email (case-insensitive)
        const customers = await prisma.$queryRaw<any[]>`
            SELECT * FROM "Customer" WHERE LOWER(email) = ${emailLower}
        `;

        if (customers.length === 0) {
            console.log(`No customer found for email: ${emailLower}`);
            return new Response(JSON.stringify([]), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const customer = customers[0];
        console.log(`Found customer: ${customer.id}, email: ${customer.email}`);

        // Now get orders for this customer
        const orders = await prisma.order.findMany({
            where: { customerId: customer.id },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                customer: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log(`Found ${orders.length} orders for customer ${customer.id}`);

        // Format orders for frontend
        const formattedOrders = orders.map((order: any) => ({
            id: String(order.orderNumber),
            date: new Date(order.createdAt).toLocaleDateString('uk-UA'),
            status: order.status,
            total: Number(order.total),
            items: order.items.map((item: any) => ({
                name: item.product?.name || 'Товар',
                image: item.product?.images ? JSON.parse(item.product.images)[0] : '/brand-sun.png',
                quantity: item.quantity,
                price: Number(item.price),
                size: item.size,
                color: item.color
            }))
        }));

        return new Response(JSON.stringify(formattedOrders), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
