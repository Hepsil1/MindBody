import type { ActionFunctionArgs } from "react-router";
import { OrderCreateSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import {
    sendEmail,
    renderOrderConfirmation,
    orderConfirmationSubject,
} from "../utils/email.server";
import { logger } from "../utils/logger.server";
import { createOrder, recordEmailStatus } from "../services/order.server";
import { sendTelegramMessage } from "../utils/telegram.server";
import { prisma } from "../db.server";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    // CSRF: reject demonstrably cross-origin POSTs — this places real COD orders
    // and decrements stock, so it's the highest-value forgery target.
    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;

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
            comment,
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
            return json({ success: false, error: result.error, code: result.code }, result.status);
        }

        // A repeated idempotencyKey returns the existing order: no second order,
        // no second stock decrement, no second email/telegram.
        if (result.deduped) {
            logger.info(
                { orderNumber: result.orderNumber },
                "[orders] idempotent retry — returning existing order",
            );
            return json({
                success: true,
                orderId: result.orderNumber,
                finalTotal: result.finalTotal,
                deduped: true,
            });
        }

        const email = result.email!;
        const orderNumberInt = result.orderNumber;

        // Persist fulfillment fields (shipping destination + delivery/payment
        // method + customer comment) AND the storefront locale onto the order.
        // Raw SQL — these columns live outside the generated Prisma client until
        // a clean `prisma generate` (same pattern as locale/colorImages). The
        // admin order page reads them back the same way so the operator can ship
        // the order. Best-effort: a pre-migration DB must not fail a placed order.
        try {
            await prisma.$executeRaw`
                UPDATE "Order" SET
                    "shippingCity" = ${customer.city},
                    "shippingWarehouse" = ${customer.warehouse},
                    "deliveryMethod" = ${deliveryMethod},
                    "paymentMethod" = ${paymentMethod},
                    "comment" = ${comment || null},
                    "locale" = ${locale}
                WHERE "id" = ${result.orderId}
            `;
        } catch (e) {
            logger.error(
                { err: e, orderNumber: orderNumberInt },
                "[orders] fulfillment/locale save failed",
            );
        }

        // Telegram notification (admin) — fire-and-forget. The shared sender has a
        // hard 3s timeout and never throws, so a slow/hanging Telegram API can no
        // longer block this response (the order is already committed). We do NOT
        // await it — the customer gets their confirmation immediately.
        {
            const itemsList = email.validItems
                .map(
                    (item) =>
                        `📦 ${item.name} (${item.size || "-"}/${item.color || "-"}) × ${item.quantity}`,
                )
                .join("\n");
            const message = `🛍 НОВЕ ЗАМОВЛЕННЯ #${orderNumberInt}\n👤 ${customer.name}\n📧 ${customer.email}\n📱 ${customer.phone}\n🏙 ${customer.city} / ${customer.warehouse}\n\n${itemsList}\n\n💰 ${email.finalTotal} ₴`;
            void sendTelegramMessage(message);
        }

        // Order confirmation email — best-effort, never blocks/rolls back the
        // already-created order. The outcome is recorded on Order.emailStatus so
        // a failure is visible in the admin order page and logs.
        if (email.customerHasRealEmail) {
            // Delivery/payment labels in the language of the order.
            const L: Record<string, Record<string, string>> = {
                uk: {
                    nova_poshta: "Нова Пошта",
                    ukrposhta: "Укрпошта",
                    delivery: "Доставка",
                    cash: "Накладений платіж",
                    card: "Картка онлайн",
                },
                en: {
                    nova_poshta: "Nova Poshta",
                    ukrposhta: "Ukrposhta",
                    delivery: "Delivery",
                    cash: "Cash on delivery",
                    card: "Card online",
                },
                ru: {
                    nova_poshta: "Новая Почта",
                    ukrposhta: "Укрпочта",
                    delivery: "Доставка",
                    cash: "Наложенный платёж",
                    card: "Карта онлайн",
                },
            };
            const lbl = L[locale] ?? L.uk;
            const deliveryLabel =
                deliveryMethod === "nova_poshta"
                    ? lbl.nova_poshta
                    : deliveryMethod === "ukrposhta"
                      ? lbl.ukrposhta
                      : deliveryMethod || lbl.delivery;
            const paymentLabel =
                paymentMethod === "cash"
                    ? lbl.cash
                    : paymentMethod === "card"
                      ? lbl.card
                      : paymentMethod || lbl.cash;
            const deliveryAddress = [customer.city, customer.warehouse].filter(Boolean).join(", ");

            sendEmail({
                to: email.customerEmail,
                subject: orderConfirmationSubject(orderNumberInt, locale),
                html: renderOrderConfirmation({
                    locale,
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

        return json({ success: true, orderId: orderNumberInt, finalTotal: email.finalTotal });
    } catch (error) {
        // Log the real error server-side; return a generic message so internal
        // detail (DB constraint text, third-party errors) never reaches the client.
        logger.error({ err: error }, "[orders] creation failed");
        return json(
            { success: false, error: "Не вдалося оформити замовлення. Спробуйте ще раз." },
            500,
        );
    }
}
