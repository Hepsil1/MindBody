// Order service — the single atomic order-creation business operation.
//
// Everything that must succeed-or-fail together runs in ONE interactive
// transaction: idempotency guard, customer upsert, Order + OrderItems, stock
// decrement (+ InventoryMovement), promo usage increment, and the initial
// OrderStatusHistory row. If stock can't be decremented (out of stock / product
// not active) the transaction throws and the order is NOT created.
//
// The server never trusts the client for price, total, product status, or
// stock — all are recomputed/locked here.
//
// All Order columns and audit tables go through the typed Prisma client. The
// only raw SQL left in the order/stock path is the FOR UPDATE row-lock in
// inventory.server.ts (Prisma has no row-locking API).

import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.server";
import {
    decrementForOrderTx,
    restoreForCancelTx,
    InsufficientStockError,
    ProductUnavailableError,
} from "./inventory.server";
import { incrementPromoUsageTx, PromoError, validateAndApplyPromo } from "./promo.server";

const GUEST_EMAIL_DOMAIN = "@mindbody.local";

export interface CreateOrderCustomer {
    name: string;
    email?: string;
    phone: string;
    city: string;
    warehouse: string;
}

export interface CreateOrderItemInput {
    id: string;
    name: string;
    quantity: number;
    size?: string | null;
    color?: string | null;
}

export interface CreateOrderInput {
    customer: CreateOrderCustomer;
    items: CreateOrderItemInput[];
    total: number; // client-claimed total (anti-fraud cross-check only)
    promoCode?: string | null;
    idempotencyKey?: string | null;
}

export interface ValidOrderLine {
    id: string;
    name: string;
    price: number;
    quantity: number;
    size: string | null;
    color: string | null;
}

export interface OrderEmailPayload {
    validItems: ValidOrderLine[];
    customer: CreateOrderCustomer;
    customerEmail: string;
    customerHasRealEmail: boolean;
    appliedPromoCode: string | null;
    discountAmount: number;
    finalTotal: number;
}

export type CreateOrderResult =
    | {
          ok: true;
          /** true when an existing order was returned for a repeated idempotencyKey. */
          deduped: boolean;
          orderId: string;
          orderNumber: number;
          finalTotal: number;
          /** Present only when a NEW order was created (drives email/telegram + emailStatus). */
          email?: OrderEmailPayload;
      }
    | { ok: false; status: number; error: string; code?: string };

function genOrderNumber(): number {
    // YYDDD + 4 random digits. Caps at 99366*10000+9999 — fits INT4 cleanly.
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
    const datePart = (now.getFullYear() % 100) * 1000 + dayOfYear;
    const randomSuffix = (randomBytes(2).readUInt16LE(0) % 9000) + 1000;
    return datePart * 10000 + randomSuffix;
}

interface ExistingOrder {
    id: string;
    orderNumber: number;
    finalTotal: number;
}

async function findOrderByKey(key: string): Promise<ExistingOrder | null> {
    const r = await prisma.order.findUnique({
        where: { idempotencyKey: key },
        select: { id: true, orderNumber: true, total: true },
    });
    if (!r) return null;
    return { id: r.id, orderNumber: Number(r.orderNumber), finalTotal: Number(r.total) };
}

function metaString(e: Prisma.PrismaClientKnownRequestError): string {
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    return `${String(meta.message ?? "")} ${String(meta.target ?? "")} ${e.message}`;
}

function isOrderNumberConflict(e: unknown): boolean {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (e.code !== "P2002") return false;
    return metaString(e).includes("orderNumber");
}

function isIdempotencyConflict(e: unknown): boolean {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
    // Typed create → P2002 on the idempotencyKey unique index. (P2010 kept for
    // safety in case a raw path elsewhere surfaces the same PG 23505.)
    const s = metaString(e);
    if (e.code === "P2002" || e.code === "P2010")
        return s.includes("idempotencyKey") || s.includes("Order_idempotencyKey_key");
    return false;
}

/**
 * Create an order atomically. Returns a structured result; never throws for
 * expected business failures (out of stock, bad promo, inactive product).
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { customer, items, total, promoCode } = input;
    const idempotencyKey = input.idempotencyKey?.trim() || null;

    // 1. Server-side product validation: recompute price, GATE status, sum subtotal.
    let subtotal = 0;
    const validItems: ValidOrderLine[] = [];
    for (const item of items) {
        const product = await prisma.product.findUnique({
            where: { id: String(item.id) },
            select: { name: true, price: true, status: true },
        });
        if (!product) {
            return { ok: false, status: 400, error: `Товар не знайдено: ${item.name}` };
        }
        if (product.status !== "active") {
            return {
                ok: false,
                status: 400,
                error: `Товар "${product.name}" зараз недоступний для замовлення`,
            };
        }
        const price = Number(product.price) || 0;
        const qty = Number(item.quantity) || 1;
        subtotal += price * qty;
        validItems.push({
            id: String(item.id),
            name: product.name,
            price,
            quantity: qty,
            size: item.size ?? null,
            color: item.color ?? null,
        });
    }

    // 2. Promo (server authoritative).
    let finalTotal = subtotal;
    let appliedPromoCode: string | null = null;
    let discountAmount = 0;
    if (promoCode) {
        try {
            const applied = await validateAndApplyPromo(prisma, promoCode, subtotal);
            finalTotal = applied.finalTotal;
            discountAmount = applied.discount;
            appliedPromoCode = applied.code;
        } catch (e) {
            if (e instanceof PromoError) return { ok: false, status: 400, error: e.message };
            throw e;
        }
    }

    // 3. Anti-fraud: server total must match client total within tolerance.
    // PRICE_MISMATCH lets the client distinguish "your cart prices went stale"
    // (recoverable by re-reconciling) from a generic failure.
    if (Math.abs(finalTotal - Number(total)) > 5) {
        return {
            ok: false,
            status: 400,
            code: "PRICE_MISMATCH",
            error: `Помилка сум замовлення. Сервер: ${finalTotal}, Клієнт: ${total}`,
        };
    }

    // 4. Idempotency fast-path: a retry with a known key returns the existing order.
    if (idempotencyKey) {
        const existing = await findOrderByKey(idempotencyKey);
        if (existing) {
            return {
                ok: true,
                deduped: true,
                orderId: existing.id,
                orderNumber: existing.orderNumber,
                finalTotal: existing.finalTotal,
            };
        }
    }

    // Customer identity (dedupe by email; guests get a placeholder address).
    const customerEmail = customer.email || `guest_${Date.now()}${GUEST_EMAIL_DOMAIN}`;
    const customerHasRealEmail =
        Boolean(customer.email) && !customerEmail.endsWith(GUEST_EMAIL_DOMAIN);
    const nameParts = customer.name?.trim().split(" ").filter(Boolean) || ["Customer"];
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 5. Transactional create — retry the whole tx if the random orderNumber collides.
    for (let attempt = 0; attempt < 4; attempt++) {
        const orderNumber = genOrderNumber();
        try {
            const result = await prisma.$transaction(async (tx) => {
                // Re-check inside the tx (near-concurrent first request).
                if (idempotencyKey) {
                    const dup = await tx.order.findUnique({
                        where: { idempotencyKey },
                        select: { id: true, orderNumber: true, total: true },
                    });
                    if (dup) {
                        return {
                            deduped: true as const,
                            id: dup.id,
                            orderNumber: Number(dup.orderNumber),
                            finalTotal: Number(dup.total),
                        };
                    }
                }

                const dbCustomer = await tx.customer.upsert({
                    where: { email: customerEmail },
                    update: { firstName, lastName, phone: customer.phone || "" },
                    create: {
                        email: customerEmail,
                        firstName,
                        lastName,
                        phone: customer.phone || "",
                    },
                });

                // idempotencyKey is @unique → a truly concurrent duplicate fails
                // at INSERT here (P2002) and is caught + deduped below.
                const created = await tx.order.create({
                    data: {
                        orderNumber,
                        customerId: dbCustomer.id,
                        status: "pending",
                        paymentStatus: "pending",
                        total: finalTotal,
                        idempotencyKey,
                        appliedPromoCode,
                        discountAmount,
                        items: {
                            create: validItems.map((i) => ({
                                productId: i.id,
                                quantity: i.quantity,
                                price: i.price,
                                size: i.size,
                                color: i.color,
                            })),
                        },
                    },
                    select: { id: true },
                });

                // Stock decrement + movement, under FOR UPDATE — throws on oversell.
                for (const i of validItems) {
                    await decrementForOrderTx(tx, i, { orderId: created.id, actor: "customer" });
                }

                if (appliedPromoCode) await incrementPromoUsageTx(tx, appliedPromoCode);

                await tx.orderStatusHistory.create({
                    data: {
                        orderId: created.id,
                        field: "status",
                        fromValue: null,
                        toValue: "pending",
                        actor: "system",
                        note: "Замовлення створено",
                    },
                });

                return {
                    deduped: false as const,
                    id: created.id,
                    orderNumber,
                    finalTotal,
                };
            });

            if (result.deduped) {
                return {
                    ok: true,
                    deduped: true,
                    orderId: result.id,
                    orderNumber: result.orderNumber,
                    finalTotal: result.finalTotal,
                };
            }

            return {
                ok: true,
                deduped: false,
                orderId: result.id,
                orderNumber: result.orderNumber,
                finalTotal,
                email: {
                    validItems,
                    customer,
                    customerEmail,
                    customerHasRealEmail,
                    appliedPromoCode,
                    discountAmount,
                    finalTotal,
                },
            };
        } catch (e) {
            // Expected business failures — surface, never retry.
            if (e instanceof InsufficientStockError || e instanceof ProductUnavailableError) {
                return { ok: false, status: 400, error: e.message };
            }
            // Promo exhausted under concurrency: the atomic guard in
            // incrementPromoUsageTx returned 0 rows and rolled back the tx.
            if (e instanceof PromoError) {
                return { ok: false, status: 409, error: e.message };
            }
            // Near-concurrent duplicate landed first — return the winner.
            if (idempotencyKey && isIdempotencyConflict(e)) {
                const existing = await findOrderByKey(idempotencyKey);
                if (existing) {
                    return {
                        ok: true,
                        deduped: true,
                        orderId: existing.id,
                        orderNumber: existing.orderNumber,
                        finalTotal: existing.finalTotal,
                    };
                }
            }
            // Random orderNumber collided — regenerate and retry.
            if (isOrderNumberConflict(e) && attempt < 3) continue;
            throw e;
        }
    }

    return {
        ok: false,
        status: 500,
        error: "Не вдалося створити замовлення. Спробуйте ще раз.",
    };
}

/** Mark the confirmation-email outcome on an order (best-effort). */
export async function recordEmailStatus(orderId: string, status: "sent" | "failed"): Promise<void> {
    try {
        await prisma.order.update({ where: { id: orderId }, data: { emailStatus: status } });
    } catch {
        // Non-critical: never let email bookkeeping break the request.
    }
}

/** Append an order status / payment transition to the audit trail. */
export async function writeOrderHistory(
    tx: Prisma.TransactionClient,
    orderId: string,
    field: "status" | "paymentStatus",
    fromValue: string | null,
    toValue: string,
    note: string,
): Promise<void> {
    await tx.orderStatusHistory.create({
        data: { orderId, field, fromValue, toValue, actor: "admin", note },
    });
}

/**
 * Cancel an order from the admin: restore every line's stock (+ an
 * `order_cancelled` movement), set status=cancelled, and record history — all in
 * one transaction. Shared by the order list and the order detail page so cancel
 * always returns stock, wherever it's triggered.
 */
export async function cancelOrder(
    orderId: string,
    fromStatus: string,
    note: string,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const items = await tx.orderItem.findMany({
            where: { orderId },
            select: { productId: true, quantity: true, size: true, color: true },
        });
        for (const it of items) {
            await restoreForCancelTx(
                tx,
                { productId: it.productId, quantity: it.quantity, size: it.size, color: it.color },
                { orderId, actor: "admin" },
            );
        }
        await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
        await writeOrderHistory(tx, orderId, "status", fromStatus, "cancelled", note);
    });
}
