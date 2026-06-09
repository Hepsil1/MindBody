// Inventory service — the single place stock changes happen.
//
// Every mutation runs inside a caller-supplied interactive transaction and:
//   1. locks the Product row with SELECT … FOR UPDATE (so two concurrent orders
//      on the last unit can't both pass the stock check — closes the oversell race),
//   2. re-validates product status + availability under the lock,
//   3. writes an append-only InventoryMovement row (who/when/why/before/after).
//
// The only raw SQL here is the `SELECT … FOR UPDATE` row-lock in lockProduct —
// Prisma has no row-locking API, and the lock is what closes the oversell race.
// Everything else (incl. the InventoryMovement write) uses the typed client.

import type { Prisma } from "@prisma/client";
import type { InventoryVariant } from "../types/product";

/** A product can't be ordered (missing, draft, or archived). */
export class ProductUnavailableError extends Error {
    constructor(
        public productName: string,
        public reason: "not_found" | "inactive",
    ) {
        super(
            reason === "not_found"
                ? `Товар не знайдено: ${productName}`
                : `Товар "${productName}" зараз недоступний для замовлення`,
        );
        this.name = "ProductUnavailableError";
    }
}

/** Not enough stock for the requested variant/quantity. */
export class InsufficientStockError extends Error {
    constructor(
        public productName: string,
        public size: string | null,
        public color: string | null,
        public available: number,
    ) {
        super(
            `Товару "${productName}" (${size || "стандарт"}, ${color || "стандарт"}) ` +
                `немає в достатній кількості. Доступно: ${available}`,
        );
        this.name = "InsufficientStockError";
    }
}

export interface OrderLineForStock {
    id: string; // productId
    name: string;
    quantity: number;
    size: string | null;
    color: string | null;
}

export interface MovementCtx {
    orderId: string | null;
    actor: string; // "system" | "customer" | admin username
}

interface LockedProduct {
    stock: number;
    inventory: string | null;
    status: string;
    name: string;
}

const variantKeyOf = (size: string | null, color: string | null) =>
    `${size ?? "—"}/${color ?? "—"}`;

async function lockProduct(
    tx: Prisma.TransactionClient,
    productId: string,
): Promise<LockedProduct | null> {
    const rows = await tx.$queryRaw<LockedProduct[]>`
        SELECT stock, inventory, status, name
        FROM "Product"
        WHERE id = ${productId}
        FOR UPDATE`;
    return rows[0] ?? null;
}

async function writeMovement(
    tx: Prisma.TransactionClient,
    m: {
        productId: string;
        variantKey: string | null;
        delta: number;
        before: number;
        after: number;
        reason: string;
        ctx: MovementCtx;
    },
): Promise<void> {
    await tx.inventoryMovement.create({
        data: {
            productId: m.productId,
            variantKey: m.variantKey,
            delta: m.delta,
            before: m.before,
            after: m.after,
            reason: m.reason,
            actor: m.ctx.actor,
            orderId: m.ctx.orderId,
        },
    });
}

function parseInventory(raw: string | null): InventoryVariant[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

const sumStock = (inv: InventoryVariant[]) => inv.reduce((s, v) => s + (v.stock || 0), 0);

export interface DecrementPlan {
    /** New inventory JSON to persist, or null when only the aggregate changed. */
    newInventoryJson: string | null;
    newStock: number;
    variantKey: string | null;
    before: number;
    after: number;
}

/**
 * Pure decrement math (no DB) — exported for unit tests. Mutates the passed
 * inventory array's matched variant. Throws InsufficientStockError when the
 * requested quantity isn't available (which, in the tx, aborts order creation).
 */
export function planOrderDecrement(
    name: string,
    stock: number,
    inventory: InventoryVariant[],
    item: { size: string | null; color: string | null; quantity: number },
): DecrementPlan {
    if (inventory.length > 0) {
        const v = inventory.find(
            (x) => (x.size ?? null) === item.size && (x.color ?? null) === item.color,
        );
        const available = v?.stock ?? 0;
        if (!v || available < item.quantity) {
            throw new InsufficientStockError(name, item.size, item.color, available);
        }
        const before = available;
        v.stock = before - item.quantity;
        return {
            newInventoryJson: JSON.stringify(inventory),
            newStock: sumStock(inventory),
            variantKey: variantKeyOf(item.size, item.color),
            before,
            after: v.stock,
        };
    }
    if (stock < item.quantity) {
        throw new InsufficientStockError(name, item.size, item.color, stock);
    }
    const after = stock - item.quantity;
    return { newInventoryJson: null, newStock: after, variantKey: null, before: stock, after };
}

/**
 * Decrement stock for one ordered line under a row lock. Throws
 * ProductUnavailableError (missing/inactive) or InsufficientStockError, which
 * aborts the surrounding transaction so the order is NOT created.
 */
export async function decrementForOrderTx(
    tx: Prisma.TransactionClient,
    item: OrderLineForStock,
    ctx: MovementCtx,
): Promise<void> {
    const p = await lockProduct(tx, item.id);
    if (!p) throw new ProductUnavailableError(item.name, "not_found");
    if (p.status !== "active") throw new ProductUnavailableError(p.name, "inactive");

    const plan = planOrderDecrement(p.name, p.stock, parseInventory(p.inventory), item);

    await tx.product.update({
        where: { id: item.id },
        data:
            plan.newInventoryJson !== null
                ? { inventory: plan.newInventoryJson, stock: plan.newStock }
                : { stock: plan.newStock },
    });
    await writeMovement(tx, {
        productId: item.id,
        variantKey: plan.variantKey,
        delta: -item.quantity,
        before: plan.before,
        after: plan.after,
        reason: "order_created",
        ctx,
    });
}

export interface OrderItemForRestore {
    productId: string;
    quantity: number;
    size: string | null;
    color: string | null;
}

/**
 * Restore stock for one line when an order is cancelled/deleted. Best-effort:
 * if the product no longer exists it's skipped (nothing to restore). Writes an
 * `order_cancelled` movement so the increase is auditable.
 */
export async function restoreForCancelTx(
    tx: Prisma.TransactionClient,
    line: OrderItemForRestore,
    ctx: MovementCtx,
): Promise<void> {
    const p = await lockProduct(tx, line.productId);
    if (!p) return; // product gone — nothing to restore

    const inv = parseInventory(p.inventory);
    if (inv.length > 0) {
        const v = inv.find(
            (x) => (x.size ?? null) === line.size && (x.color ?? null) === line.color,
        );
        if (v) {
            const before = v.stock || 0;
            v.stock = before + line.quantity;
            await tx.product.update({
                where: { id: line.productId },
                data: { inventory: JSON.stringify(inv), stock: sumStock(inv) },
            });
            await writeMovement(tx, {
                productId: line.productId,
                variantKey: variantKeyOf(line.size, line.color),
                delta: line.quantity,
                before,
                after: v.stock,
                reason: "order_cancelled",
                ctx,
            });
            return;
        }
        // Variant disappeared from the config — fall through to aggregate restore.
    }
    const after = p.stock + line.quantity;
    await tx.product.update({ where: { id: line.productId }, data: { stock: after } });
    await writeMovement(tx, {
        productId: line.productId,
        variantKey: null,
        delta: line.quantity,
        before: p.stock,
        after,
        reason: "order_cancelled",
        ctx,
    });
}
