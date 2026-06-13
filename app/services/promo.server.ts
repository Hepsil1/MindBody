// Promo service — server-authoritative validation + discount math.
//
// The discount is computed from the DB, never trusted from the client. The
// pure `computeDiscount` is exported separately so it can be unit-tested without
// a database.

import type { Prisma, PrismaClient } from "@prisma/client";

export class PromoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PromoError";
    }
}

export interface AppliedPromo {
    /** Normalized (trimmed, upper-cased) code as stored. */
    code: string;
    /** Discount amount in UAH, clamped to [0, subtotal]. */
    discount: number;
    /** subtotal − discount, never negative. */
    finalTotal: number;
}

/**
 * Pure discount computation. Percent codes round to whole UAH; fixed codes use
 * the value as-is. Always clamped to [0, subtotal] so a bad/legacy >100% or
 * oversized fixed code can't drive the total negative.
 */
export function computeDiscount(
    discountType: string,
    discountValue: number,
    subtotal: number,
): number {
    const raw =
        discountType === "percent" ? Math.round((subtotal * discountValue) / 100) : discountValue;
    return Math.max(0, Math.min(raw, subtotal));
}

type PromoReader = Pick<PrismaClient, "promoCode"> | Prisma.TransactionClient;

/**
 * Validate a code against the DB (active, not expired, not exhausted, min-order
 * met) and compute the discount. Throws PromoError on any failure so the caller
 * can reject the order with a user-facing message.
 */
export async function validateAndApplyPromo(
    db: PromoReader,
    rawCode: string,
    subtotal: number,
): Promise<AppliedPromo> {
    const code = rawCode.trim().toUpperCase();
    const p = await db.promoCode.findUnique({ where: { code } });
    if (!p || !p.isActive) throw new PromoError(`Промокод ${rawCode} недійсний або закінчився`);
    if (p.expiresAt && new Date(p.expiresAt) < new Date())
        throw new PromoError("Термін дії промокоду минув");
    if (p.maxUses && p.usedCount >= p.maxUses) throw new PromoError("Промокод вичерпано");
    if (p.minOrder > 0 && subtotal < p.minOrder)
        throw new PromoError(`Для промокоду ${code} мінімальне замовлення складає ${p.minOrder} ₴`);
    const discount = computeDiscount(p.discountType, p.discountValue, subtotal);
    return { code, discount, finalTotal: Math.max(0, subtotal - discount) };
}

/**
 * Atomically increment usage AND enforce the maxUses limit inside the order
 * transaction. Raw SQL is required because Prisma can't express a
 * column-to-column guard (`usedCount < maxUses`) in a where clause. If 0 rows
 * are affected the code is exhausted (or vanished) under concurrency — we throw
 * PromoError to abort the whole order transaction. This is what closes the
 * "first N customers" overuse race: the pre-tx check in validateAndApplyPromo
 * reads usedCount without a lock, so concurrent orders could all pass it; the
 * conditional UPDATE here serializes the increment and rejects the overflow.
 */
export async function incrementPromoUsageTx(
    tx: Prisma.TransactionClient,
    code: string,
): Promise<void> {
    const norm = code.trim().toUpperCase();
    const affected = await tx.$executeRaw`
        UPDATE "PromoCode"
        SET "usedCount" = "usedCount" + 1
        WHERE "code" = ${norm}
          AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;
    if (affected === 0) {
        throw new PromoError("Промокод вичерпано");
    }
}
