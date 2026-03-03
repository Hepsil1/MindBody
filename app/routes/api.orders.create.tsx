import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = "7516303735:AAFZtMq37IfEFmDzNTkNrZiKh8OOBjpiTQ0";
const TELEGRAM_CHAT_ID = "5429418837";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const data = await request.json();
        const { customer, items, total, shippingCost, paymentMethod, deliveryMethod, comment } = data;

        // Validation
        if (!customer || !customer.email || !items || items.length === 0) {
            return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
                status: 400, headers: { "Content-Type": "application/json" }
            });
        }

        // 1. Create or Update Customer
        const nameParts = customer.name?.trim().split(" ") || ["Customer"];
        const firstName = nameParts[0] || "Customer";
        const lastName = nameParts.slice(1).join(" ") || "";

        const dbCustomer = await prisma.customer.upsert({
            where: { email: customer.email },
            update: { firstName, lastName, phone: customer.phone || "" },
            create: { email: customer.email, firstName, lastName, phone: customer.phone || "" },
        });

        // 2. Generate Order Number (fits in INT: max ~2.1 billion)
        // Format: MMDDHHMMSS + random 2 digits = 12 digits max, but we use shorter
        const now = Date.now();
        const orderNumberInt = Math.floor(now / 1000) % 1000000000; // Last 9 digits of unix timestamp


        // 3. Create Order with Items
        const newOrder = await prisma.order.create({
            data: {
                orderNumber: orderNumberInt,
                customerId: dbCustomer.id,
                status: "pending",
                paymentStatus: "pending",
                total: total,
                items: {
                    create: items.map((item: any) => ({
                        productId: String(item.id),
                        quantity: Number(item.quantity) || 1,
                        price: Number(item.price) || 0,
                        size: item.size || null,
                        color: item.color || null
                    }))
                }
            },
            include: { items: true, customer: true }
        });

        // 4. Update Stock - handle ARRAY format: [{color, size, stock}, ...]
        for (const item of items) {
            try {
                const products: any[] = await prisma.$queryRawUnsafe(
                    `SELECT stock, inventory FROM Product WHERE id = ?`,
                    String(item.id)
                );

                if (products.length > 0) {
                    const product = products[0];
                    let inventoryArr: any[] = [];

                    try {
                        inventoryArr = JSON.parse(product.inventory || "[]");
                    } catch { inventoryArr = []; }

                    // Find matching variant and decrement
                    let totalStock = 0;
                    for (const variant of inventoryArr) {
                        if (variant.size === item.size && variant.color === item.color) {
                            variant.stock = Math.max(0, (variant.stock || 0) - (item.quantity || 1));
                        }
                        totalStock += (variant.stock || 0);
                    }

                    await prisma.$executeRawUnsafe(
                        `UPDATE Product SET stock = ?, inventory = ? WHERE id = ?`,
                        totalStock,
                        JSON.stringify(inventoryArr),
                        String(item.id)
                    );
                }
            } catch (e) {
                console.error(`Stock update failed for ${item.id}:`, e);
            }
        }

        // 5. Send Telegram Notification
        try {
            const itemsList = items.map((item: any) =>
                `📦 ${item.name || 'Товар'} (${item.size || '-'}/${item.color || '-'}) × ${item.quantity || 1}`
            ).join('\n');

            const message = `🛍 НОВЕ ЗАМОВЛЕННЯ #${orderNumberInt}\n👤 ${customer.name}\n📧 ${customer.email}\n📱 ${customer.phone}\n🏙 ${customer.city} / ${customer.warehouse}\n\n${itemsList}\n\n💰 ${total} ₴`;

            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
            });
        } catch (e) {
            console.error("Telegram failed:", e);
        }

        return new Response(JSON.stringify({ success: true, orderId: newOrder.orderNumber }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Order creation error:", error);
        return new Response(JSON.stringify({ success: false, error: error?.message || "Order creation failed" }), {
            status: 500, headers: { "Content-Type": "application/json" },
        });
    }
}
