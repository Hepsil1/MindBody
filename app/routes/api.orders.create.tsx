import type { ActionFunctionArgs } from "react-router";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import { OrderCreateSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";
import { sendEmail, renderOrderConfirmation } from "../utils/email.server";
import { env } from "../utils/env.server";
import { logger } from "../utils/logger.server";
import type { InventoryVariant } from "../types/product";

// Telegram Configuration — from environment variables
const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID ?? "";

// Server-validated cart item — built from incoming items + DB price/name lookup,
// then used for order creation and downstream notifications.
interface ValidOrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    size: string | null;
    color: string | null;
}

// Subset of Product we read during validation (keeps the row narrow + typed).
const PRODUCT_VALIDATION_SELECT = {
    name: true,
    price: true,
    inventory: true,
} satisfies Prisma.ProductSelect;

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
            return new Response(
                JSON.stringify({ success: false, error: formatZodErrors(parsed.error) }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        const {
            customer,
            items,
            total,
            shippingCost,
            paymentMethod,
            deliveryMethod,
            comment,
            promoCode,
        } = parsed.data;

        // --- NEW: Server-Side Price & Stock Validation ---
        let calculatedSubtotal = 0;
        const validItems: ValidOrderItem[] = [];

        for (const item of items) {
            const product = await prisma.product.findUnique({
                where: { id: String(item.id) },
                select: PRODUCT_VALIDATION_SELECT,
            });

            if (!product) {
                return new Response(
                    JSON.stringify({ success: false, error: `Товар не знайдено: ${item.name}` }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }

            const realPrice = Number(product.price) || 0;
            const qty = Number(item.quantity) || 1;

            let inventoryArr: InventoryVariant[] = [];
            try {
                inventoryArr = JSON.parse(product.inventory || "[]");
            } catch {
                // Malformed JSON in DB — treat as no variants and let order proceed.
            }

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
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: `Невірний розмір або колір для товару: ${product.name}`,
                        }),
                        { status: 400, headers: { "Content-Type": "application/json" } },
                    );
                }
                if (stockAvailable < qty) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: `Товару "${product.name}" (${item.size || "стандарт"}, ${item.color || "стандарт"}) немає в достатній кількості. Доступно: ${stockAvailable}`,
                        }),
                        { status: 400, headers: { "Content-Type": "application/json" } },
                    );
                }
            }

            calculatedSubtotal += realPrice * qty;
            validItems.push({
                id: String(item.id),
                name: product.name,
                price: realPrice,
                quantity: qty,
                size: item.size || null,
                color: item.color || null,
            });
        }

        let finalTotal = calculatedSubtotal;

        // --- Promo Code Validation (direct DB, no self-fetch) ---
        if (promoCode) {
            const p = await prisma.promoCode.findUnique({
                where: { code: promoCode.trim().toUpperCase() },
            });
            if (!p || !p.isActive) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: `Промокод ${promoCode} недійсний або закінчився`,
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
            if (p.expiresAt && new Date(p.expiresAt) < new Date()) {
                return new Response(
                    JSON.stringify({ success: false, error: `Термін дії промокоду минув` }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
            if (p.maxUses && p.usedCount >= p.maxUses) {
                return new Response(
                    JSON.stringify({ success: false, error: `Промокод вичерпано` }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
            if (p.minOrder > 0 && calculatedSubtotal < p.minOrder) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: `Для промокоду ${promoCode} мінімальне замовлення складає ${p.minOrder} ₴`,
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
            const discount =
                p.discountType === "percent"
                    ? Math.round((calculatedSubtotal * p.discountValue) / 100)
                    : Math.min(p.discountValue, calculatedSubtotal);
            finalTotal = calculatedSubtotal - discount;
        }

        // Check final total vs payload total (anti-fraud) to ensure cart totals mach server real totals
        if (Math.abs(finalTotal - Number(total)) > 5) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Помилка сум замовлення. Сервер: ${finalTotal}, Клієнт: ${total}`,
                }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
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

        // 2. Generate Order Number — format: YYDDD + 4 random digits.
        // YY  = last two digits of the year (e.g. 26 in 2026)
        // DDD = day of year, 1-366
        // The previous format (YYMMDD * 10000 + random) overflowed
        // PostgreSQL INT4 (max 2,147,483,647) — `datePart * 10000` for any
        // date after late 2022 produced numbers > 2.1 billion, so every
        // order create failed in prod with a Prisma ConversionError.
        // This format caps at 99366 * 10000 + 9999 = 993,669,999 — fits
        // INT4 cleanly for the next century. Still 9-digit human-readable.
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
        const datePart = (now.getFullYear() % 100) * 1000 + dayOfYear; // YYDDD
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
                        create: validItems.map((item) => ({
                            productId: item.id,
                            quantity: item.quantity,
                            price: item.price,
                            size: item.size,
                            color: item.color,
                        })),
                    },
                },
                include: { items: true, customer: true },
            });
        } catch (e) {
            // Retry with different random suffix if unique constraint violation
            const isUniqueViolation =
                e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
            if (isUniqueViolation) {
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
                            create: validItems.map((item) => ({
                                productId: item.id,
                                quantity: item.quantity,
                                price: item.price,
                                size: item.size,
                                color: item.color,
                            })),
                        },
                    },
                    include: { items: true, customer: true },
                });
            } else {
                throw e;
            }
        }

        // 4. Atomic Stock Update (Single transaction with row-level locking to prevent race conditions)
        try {
            await prisma.$transaction(async (tx) => {
                for (const item of validItems) {
                    // Lock the product row to prevent concurrent updates. Prisma has
                    // no first-class FOR UPDATE helper, so we use $queryRaw with an
                    // explicit generic to keep the result typed.
                    const lockedProducts = await tx.$queryRaw<
                        Array<{ stock: number; inventory: string | null }>
                    >(
                        Prisma.sql`SELECT stock, inventory FROM "Product" WHERE id = ${item.id} FOR UPDATE`,
                    );

                    if (lockedProducts.length > 0) {
                        const product = lockedProducts[0];
                        let inventoryArr: InventoryVariant[] = [];
                        try {
                            inventoryArr = JSON.parse(product.inventory || "[]");
                        } catch {
                            // Malformed inventory JSON — bail out of decrement for this item.
                            continue;
                        }

                        let totalStock = 0;
                        for (const variant of inventoryArr) {
                            if (variant.size === item.size && variant.color === item.color) {
                                variant.stock = Math.max(0, (variant.stock || 0) - item.quantity);
                            }
                            totalStock += variant.stock || 0;
                        }

                        await tx.product.update({
                            where: { id: item.id },
                            data: {
                                stock: totalStock,
                                inventory: JSON.stringify(inventoryArr),
                            },
                        });
                    }
                }
            });
        } catch (e) {
            logger.error({ err: e, orderNumber: orderNumberInt }, "[orders] stock update failed");
        }

        // 5. Increment promo code usage if used
        if (promoCode) {
            try {
                await prisma.$executeRawUnsafe(
                    `UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1 WHERE code = $1`,
                    promoCode.trim().toUpperCase(),
                );
            } catch (e) {
                logger.error({ err: e, promoCode }, "[orders] promo increment failed");
            }
        }

        // 6. Send Telegram Notification (admin)
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            try {
                const itemsList = validItems
                    .map(
                        (item) =>
                            `📦 ${item.name} (${item.size || "-"}/${item.color || "-"}) × ${item.quantity}`,
                    )
                    .join("\n");

                const message = `🛍 НОВЕ ЗАМОВЛЕННЯ #${orderNumberInt}\n👤 ${customer.name}\n📧 ${customer.email}\n📱 ${customer.phone}\n🏙 ${customer.city} / ${customer.warehouse}\n\n${itemsList}\n\n💰 ${finalTotal} ₴`;

                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
                });
            } catch (e) {
                logger.error({ err: e, orderNumber: orderNumberInt }, "[orders] telegram failed");
            }
        }

        // 7. Send Order Confirmation Email to customer (only if real email provided)
        const customerHasEmail = customer.email && !customerEmail.endsWith("@mindbody.local");
        if (customerHasEmail) {
            const deliveryLabel =
                deliveryMethod === "nova_poshta"
                    ? "Нова Пошта"
                    : deliveryMethod === "ukrposhta"
                      ? "Укрпошта"
                      : deliveryMethod || "Доставка";
            const paymentLabel =
                paymentMethod === "cash"
                    ? "Накладений платіж"
                    : paymentMethod === "card"
                      ? "Картка онлайн"
                      : paymentMethod === "apple_pay"
                        ? "Apple Pay"
                        : paymentMethod === "google_pay"
                          ? "Google Pay"
                          : paymentMethod || "";
            const deliveryAddress = [customer.city, customer.warehouse].filter(Boolean).join(", ");

            sendEmail({
                to: customer.email!,
                subject: `Замовлення №${orderNumberInt} прийнято · MIND BODY`,
                html: renderOrderConfirmation({
                    orderNumber: orderNumberInt,
                    customerName: customer.name || "",
                    customerEmail: customer.email,
                    items: validItems.map((it) => ({
                        name: it.name,
                        quantity: it.quantity,
                        price: it.price,
                        size: it.size || undefined,
                        color: it.color || undefined,
                    })),
                    total: finalTotal,
                    deliveryMethod: deliveryLabel,
                    deliveryAddress,
                    paymentMethod: paymentLabel,
                }),
                tags: [
                    { name: "type", value: "order-confirmation" },
                    { name: "order", value: String(orderNumberInt) },
                ],
            }).catch((e) =>
                logger.error(
                    { err: e, orderNumber: orderNumberInt, to: customer.email },
                    "[orders] confirmation email failed",
                ),
            );
        }

        return new Response(JSON.stringify({ success: true, orderId: newOrder.orderNumber }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        logger.error({ err: error }, "[orders] creation failed");
        const message = error instanceof Error ? error.message : "Order creation failed";
        return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
