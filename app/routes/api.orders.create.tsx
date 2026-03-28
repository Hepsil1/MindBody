import type { ActionFunctionArgs } from "react-router";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.server";
import { OrderCreateSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";

// Telegram Configuration — from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        // Rate limit: 3 order creations per minute
        const rateLimited = checkRateLimit(request, "orders", 3, 60_000);
        if (rateLimited) return rateLimited;

        const data = await request.json();

        // Zod validation
        const parsed = OrderCreateSchema.safeParse(data);
        if (!parsed.success) {
            return new Response(JSON.stringify({ success: false, error: formatZodErrors(parsed.error) }), {
                status: 400, headers: { "Content-Type": "application/json" }
            });
        }

        const { customer, items, total, shippingCost, paymentMethod, deliveryMethod, comment, promoCode } = parsed.data;

        // --- NEW: Server-Side Price & Stock Validation ---
        let calculatedSubtotal = 0;
        const validItems = [];

        for (const item of items) {
            const products: any[] = await prisma.$queryRawUnsafe(
                 `SELECT name, price, inventory FROM "Product" WHERE id = $1`,
                 String(item.id)
            );
            
            if (products.length === 0) {
                 return new Response(JSON.stringify({ success: false, error: `Товар не знайдено: ${item.name}` }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            
            const product = products[0];
            const realPrice = Number(product.price) || 0;
            const qty = Number(item.quantity) || 1;
            
            let inventoryArr: any[] = [];
            try { inventoryArr = JSON.parse(product.inventory || "[]"); } catch {}
            
            // Validate Stock
            if (inventoryArr.length > 0) {
                 let variantMatched = false;
                 let stockAvailable = 0;
                 for (const variant of inventoryArr) {
                     // Check using loose equality or correct property existence 
                     // since sometimes colors/sizes might not be defined for single variants
                     if (variant.size === item.size && variant.color === item.color) {
                         stockAvailable = variant.stock || 0;
                         variantMatched = true;
                         break;
                     }
                 }
                 if (!variantMatched) {
                      return new Response(JSON.stringify({ success: false, error: `Невірний розмір або колір для товару: ${product.name}` }), { status: 400, headers: { "Content-Type": "application/json" } });
                 }
                 if (stockAvailable < qty) {
                      return new Response(JSON.stringify({ success: false, error: `Товару "${product.name}" (${item.size || 'стандарт'}, ${item.color || 'стандарт'}) немає в достатній кількості. Доступно: ${stockAvailable}` }), { status: 400, headers: { "Content-Type": "application/json" } });
                 }
            }
            
            calculatedSubtotal += (realPrice * qty);
            validItems.push({
                 id: String(item.id),
                 name: product.name,
                 price: realPrice,
                 quantity: qty,
                 size: item.size || null,
                 color: item.color || null
            });
        }
        
        let finalTotal = calculatedSubtotal;
        
        // --- Promo Code Validation (direct DB, no self-fetch) ---
        if (promoCode) {
            const promoResults = await prisma.$queryRawUnsafe(
                `SELECT * FROM "PromoCode" WHERE code = $1 LIMIT 1`,
                promoCode.trim().toUpperCase()
            ) as any[];
            const p = promoResults[0];
            if (!p || !p.isActive) {
                return new Response(JSON.stringify({ success: false, error: `Промокод ${promoCode} недійсний або закінчився` }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            if (p.expiresAt && new Date(p.expiresAt) < new Date()) {
                return new Response(JSON.stringify({ success: false, error: `Термін дії промокоду минув` }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            if (p.maxUses && p.usedCount >= p.maxUses) {
                return new Response(JSON.stringify({ success: false, error: `Промокод вичерпано` }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            if (p.minOrder > 0 && calculatedSubtotal < p.minOrder) {
                return new Response(JSON.stringify({ success: false, error: `Для промокоду ${promoCode} мінімальне замовлення складає ${p.minOrder} ₴` }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            const discount = p.discountType === 'percent'
                ? Math.round(calculatedSubtotal * p.discountValue / 100)
                : Math.min(p.discountValue, calculatedSubtotal);
            finalTotal = calculatedSubtotal - discount;
        }
        
        // Check final total vs payload total (anti-fraud) to ensure cart totals mach server real totals
        if (Math.abs(finalTotal - Number(total)) > 5) {
             return new Response(JSON.stringify({ success: false, error: `Помилка сум замовлення. Сервер: ${finalTotal}, Клієнт: ${total}` }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // 1. Create or Update Customer
        const nameParts = customer.name?.trim().split(" ") || ["Customer"];
        const firstName = nameParts[0] || "Customer";
        const lastName = nameParts.slice(1).join(" ") || "";

        // If email is empty (optional), generate a placeholder so upsert works
        const customerEmail = customer.email || `guest_${Date.now()}@mindbody.local`;
        const dbCustomer = await prisma.customer.upsert({
            where: { email: customerEmail },
            update: { firstName, lastName, phone: customer.phone || "" },
            create: { email: customerEmail, firstName, lastName, phone: customer.phone || "" },
        });

        // 2. Generate Order Number (YYMMDD + 4 random digits for readability + uniqueness)
        const now = new Date();
        const datePart = (now.getFullYear() % 100) * 10000 + (now.getMonth() + 1) * 100 + now.getDate(); // YYMMDD
        const randomSuffix = (randomBytes(2).readUInt16LE(0) % 9000) + 1000; // 1000-9999
        const orderNumberInt = datePart * 10000 + randomSuffix;


        // 3. Create Order (retry once if collision on orderNumber)
        let newOrder;
        try {
            newOrder = await prisma.order.create({
                data: {
                    orderNumber: orderNumberInt,
                    customerId: dbCustomer.id,
                    status: "pending",
                    paymentStatus: "pending",
                    total: finalTotal,
                    items: {
                        create: validItems.map((item: any) => ({
                            productId: item.id,
                            quantity: item.quantity,
                            price: item.price,
                            size: item.size,
                            color: item.color
                        }))
                    }
                },
                include: { items: true, customer: true }
            });
        } catch (e: any) {
            // Retry with different random suffix if unique constraint violation
            if (e?.code === 'P2002') {
                const retrySuffix = (randomBytes(2).readUInt16LE(0) % 9000) + 1000;
                const retryOrderNumber = datePart * 10000 + retrySuffix;
                newOrder = await prisma.order.create({
                    data: {
                        orderNumber: retryOrderNumber,
                        customerId: dbCustomer.id,
                        status: "pending",
                        paymentStatus: "pending",
                        total: finalTotal,
                        items: {
                            create: validItems.map((item: any) => ({
                                productId: item.id,
                                quantity: item.quantity,
                                price: item.price,
                                size: item.size,
                                color: item.color
                            }))
                        }
                    },
                    include: { items: true, customer: true }
                });
            } else {
                throw e;
            }
        }

        // 4. Atomic Stock Update (transaction with row-level locking to prevent race conditions)
        for (const item of validItems) {
            try {
                await prisma.$transaction(async (tx) => {
                    // Lock the product row to prevent concurrent updates
                    const lockedProducts: any[] = await tx.$queryRawUnsafe(
                        `SELECT stock, inventory FROM "Product" WHERE id = $1 FOR UPDATE`,
                        item.id
                    );

                    if (lockedProducts.length > 0) {
                        const product = lockedProducts[0];
                        let inventoryArr: any[] = [];
                        try { inventoryArr = JSON.parse(product.inventory || "[]"); } catch {}

                        let totalStock = 0;
                        for (const variant of inventoryArr) {
                            if (variant.size === item.size && variant.color === item.color) {
                                variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                            }
                            totalStock += (variant.stock || 0);
                        }

                        await tx.$executeRawUnsafe(
                            `UPDATE "Product" SET stock = $1, inventory = $2 WHERE id = $3`,
                            totalStock,
                            JSON.stringify(inventoryArr),
                            item.id
                        );
                    }
                });
            } catch (e) {
                console.error(`Atomic stock update failed for ${item.id}:`, e);
            }
        }

        // 5. Increment promo code usage if used
        if (promoCode) {
            try {
                await prisma.$executeRawUnsafe(
                    `UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1 WHERE code = $1`,
                    promoCode.trim().toUpperCase()
                );
            } catch (e) {
                console.error("Promo increment failed:", e);
            }
        }

        // 6. Send Telegram Notification
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            try {
                const itemsList = validItems.map((item: any) =>
                    `📦 ${item.name} (${item.size || '-'}/${item.color || '-'}) × ${item.quantity}`
                ).join('\n');

                const message = `🛍 НОВЕ ЗАМОВЛЕННЯ #${orderNumberInt}\n👤 ${customer.name}\n📧 ${customer.email}\n📱 ${customer.phone}\n🏙 ${customer.city} / ${customer.warehouse}\n\n${itemsList}\n\n💰 ${finalTotal} ₴`;

                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
                });
            } catch (e) {
                console.error("Telegram failed:", e);
            }
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
