import crypto from "crypto";
import { prisma } from "../db.server";
import { backInStockSubject, renderBackInStock, sendEmail } from "../utils/email.server";
import { env } from "../utils/env.server";
import { logger } from "../utils/logger.server";
import { isLocale } from "../i18n/config";

export interface StockSubscribeInput {
    productId: string;
    /** "" = any size (shopper subscribed before picking one). */
    size: string;
    color?: string;
    email: string;
    locale?: string;
}

export async function createStockSubscription(input: StockSubscribeInput) {
    const { productId, size, color = "", email, locale = "uk" } = input;
    const cleanEmail = email.trim().toLowerCase();
    const unsubToken = crypto.randomBytes(20).toString("base64url");

    return prisma.stockSubscription.upsert({
        where: {
            productId_size_color_email: {
                productId,
                size,
                color,
                email: cleanEmail,
            },
        },
        update: {
            status: "active",
            locale,
            notifiedAt: null,
        },
        create: {
            productId,
            size,
            color,
            email: cleanEmail,
            locale,
            status: "active",
            unsubToken,
        },
    });
}

export async function unsubscribeStock(token: string): Promise<boolean> {
    if (!token || token.length > 64) return false;
    const res = await prisma.stockSubscription.updateMany({
        where: { unsubToken: token },
        data: { status: "unsubscribed" },
    });
    return res.count > 0;
}

interface InventoryEntry {
    color?: string;
    size?: string;
    stock?: number | string;
}

/** Units in stock for a subscription's (size, colour); "" matches any. */
function stockFor(
    inventory: InventoryEntry[],
    totalStock: number,
    size: string,
    color: string,
): number {
    if (inventory.length === 0) return totalStock; // variant-less product
    return inventory
        .filter((v) => (!size || v.size === size) && (!color || v.color === color))
        .reduce((n, v) => n + (Number(v.stock) || 0), 0);
}

/**
 * Email every active subscriber whose size/colour is now in stock, then mark
 * them notified. Only successfully sent emails are marked — a failed send stays
 * "active" and is retried on the next stock update. Safe to call after any
 * product save: it does nothing unless the product is live and has stock.
 */
export async function notifyBackInStock(
    productId: string,
): Promise<{ notified: number; failed: number }> {
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { name: true, slug: true, status: true, stock: true, inventory: true },
        });
        if (!product || product.status !== "active" || !product.slug)
            return { notified: 0, failed: 0 };

        let inventory: InventoryEntry[] = [];
        try {
            const parsed = JSON.parse(product.inventory || "[]");
            if (Array.isArray(parsed)) inventory = parsed;
        } catch {
            /* malformed inventory → treat as variant-less */
        }

        const subs = await prisma.stockSubscription.findMany({
            where: { productId, status: "active" },
            orderBy: { createdAt: "asc" },
            take: 200,
        });

        let notified = 0;
        let failed = 0;
        for (const sub of subs) {
            if (stockFor(inventory, product.stock, sub.size, sub.color) <= 0) continue;
            const locale = isLocale(sub.locale) ? sub.locale : "uk";
            const unsubUrl = `${env.SITE_URL}/api/stock-subscribe?unsub=${encodeURIComponent(sub.unsubToken)}`;
            const res = await sendEmail({
                to: sub.email,
                subject: backInStockSubject(product.name, locale),
                html: renderBackInStock({
                    productName: product.name,
                    productPath: `/p/${product.slug}`,
                    size: sub.size || null,
                    color: sub.color || null,
                    unsubUrl,
                    locale,
                }),
                unsubscribeUrl: unsubUrl,
                tags: [{ name: "type", value: "back_in_stock" }],
            });
            if (res.ok) {
                await prisma.stockSubscription.update({
                    where: { id: sub.id },
                    data: { status: "notified", notifiedAt: new Date() },
                });
                notified++;
            } else {
                failed++;
            }
        }
        if (notified || failed) {
            logger.info({ productId, notified, failed }, "[stockSubscription] back-in-stock run");
        }
        return { notified, failed };
    } catch (e) {
        logger.error({ err: e, productId }, "[stockSubscription] notification error");
        return { notified: 0, failed: 0 };
    }
}
