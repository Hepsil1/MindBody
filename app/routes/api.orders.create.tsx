import type { ActionFunctionArgs } from "react-router";
import { OrderCreateSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";
import { sendEmail, renderOrderConfirmation } from "../utils/email.server";
import { env } from "../utils/env.server";
import { logger } from "../utils/logger.server";
import { createOrder, recordEmailStatus } from "../services/order.server";
import { prisma } from "../db.server";

// Telegram Configuration — from environment variables
const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID ?? "";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        // Rate limit: 3 order creations per minute
        const rateLimited = checkRateLimit(request, "orders", 3, 60_000);
        if (rateLimited) return rateLimited;

        const data = await request.json();

        const parsed = OrderCreateSchema.safeParse(data);
        if (!parsed.success) {
            return json({ success: false, error: formatZodErrors(parsed.error) }, 400);
        }

        const {
            customer,
            items,
            total,
            paymentMethod,
            deliveryMethod,
            promoCode,
            idempotencyKey,
            locale,
        } = parsed.data;

        // All the integrity-critical work (price/status/stock recompute, atomic
        // create, idempotency, oversell-safe decrement, promo snapshot) lives in
        // the order service. The route only handles transport + notifications.
        const result = await createOrder({
            customer,
            items,
            total,
            promoCode,
            idempotencyKey,
        });

        if (!result.ok) {
            return json({ success: false, error: result.error }, result.status);
        }

        // A repeated idempotencyKey returns the existing order: no second order,
        // no second stock decrement, no second email/telegram.
        if (result.deduped) {
            logger.info(
                { orderNumber: result.orderNumber },
                "[orders] idempotent retry — returning existing order",
            );
            return json({ success: true, orderId: result.orderNumber, deduped: true });
        }

        const email = result.email!;
        const orderNumberInt = result.orderNumber;

        // Remember the storefront language on the order (raw SQL — the column
        // is outside the generated client until a clean prisma generate).
        // Best-effort: a pre-migration DB must not fail the placed order.
        if (locale !== "uk") {
            try {
                await prisma.$executeRaw`
                    UPDATE "Order" SET "locale" = ${locale} WHERE "id" = ${result.orderId}
                `;
            } catch (e) {
                logger.error(
                    { err: e, orderNumber: orderNumberInt },
                    "[orders] locale save failed",
                );
            }
        }

        // Telegram notification (admin) — best-effort.
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            try {
                const itemsList = email.validItems
                    .map(
                        (item) =>
                            `📦 ${item.name} (${item.size || "-"}/${item.color || "-"}) × ${item.quantity}`,
                    )
                    .join("\n");
                const message = `🛍 НОВЕ ЗАМОВЛЕННЯ #${orderNumberInt}\n👤 ${customer.name}\n📧 ${customer.email}\n📱 ${customer.phone}\n🏙 ${customer.city} / ${customer.warehouse}\n\n${itemsList}\n\n💰 ${email.finalTotal} ₴`;
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
                });
            } catch (e) {
                logger.error({ err: e, orderNumber: orderNumberInt }, "[orders] telegram failed");
            }
        }

        // Order confirmation email — best-effort, never blocks/rolls back the
        // already-created order. The outcome is recorded on Order.emailStatus so
        // a failure is visible in the admin order page and logs.
        if (email.customerHasRealEmail) {
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
                      : paymentMethod || "Накладений платіж";
            const deliveryAddress = [customer.city, customer.warehouse].filter(Boolean).join(", ");

            sendEmail({
                to: email.customerEmail,
                subject: `Замовлення №${orderNumberInt} прийнято · MIND BODY`,
                html: renderOrderConfirmation({
                    orderNumber: orderNumberInt,
                    customerName: customer.name || "",
                    customerEmail: email.customerEmail,
                    items: email.validItems.map((it) => ({
                        name: it.name,
                        quantity: it.quantity,
                        price: it.price,
                        size: it.size || undefined,
                        color: it.color || undefined,
                    })),
                    total: email.finalTotal,
                    deliveryMethod: deliveryLabel,
                    deliveryAddress,
                    paymentMethod: paymentLabel,
                }),
                tags: [
                    { name: "type", value: "order-confirmation" },
                    { name: "order", value: String(orderNumberInt) },
                ],
            })
                .then(() => recordEmailStatus(result.orderId, "sent"))
                .catch((e) => {
                    logger.error(
                        { err: e, orderNumber: orderNumberInt, to: email.customerEmail },
                        "[orders] confirmation email failed",
                    );
                    return recordEmailStatus(result.orderId, "failed");
                });
        }

        return json({ success: true, orderId: orderNumberInt });
    } catch (error) {
        logger.error({ err: error }, "[orders] creation failed");
        const message = error instanceof Error ? error.message : "Order creation failed";
        return json({ success: false, error: message }, 500);
    }
}
