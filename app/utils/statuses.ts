// Single source of truth for entity statuses + the order lifecycle state-machine.
//
// Status columns are plain `String` in the DB. A real Prisma enum needs a client
// regen, which is blocked while PM2 holds the engine DLL (see
// docs/deploy-p0-order-stock-integrity.md), so the "enum" lives here in TS and is
// enforced in admin actions. Labels/colors are centralized so the list, the
// detail page, and any badge render identically.

export const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    pending: "Очікує",
    confirmed: "Підтверджено",
    processing: "Обробляється",
    shipped: "Відправлено",
    delivered: "Доставлено",
    cancelled: "Скасовано",
    returned: "Повернено",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
    pending: "#f59e0b",
    confirmed: "#06b6d4",
    processing: "#3b82f6",
    shipped: "#8b5cf6",
    delivered: "#10b981",
    cancelled: "#ef4444",
    returned: "#a855f7",
};

export const PAYMENT_STATUSES = ["pending", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
    pending: "Очікує оплати",
    paid: "Оплачено",
    refunded: "Повернуто",
};

export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
    pending: "#f59e0b",
    paid: "#10b981",
    refunded: "#ef4444",
};

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
    active: "Активний",
    draft: "Чернетка",
    archived: "Архів",
};

// Order lifecycle. Forward flow + cancel from any open state + return from
// delivered. Terminal states (cancelled, returned) have no outgoing transitions.
// A no-op (same → same) is always allowed and treated as a success no-op upstream.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ["confirmed", "processing", "cancelled"],
    confirmed: ["processing", "shipped", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: ["returned"],
    cancelled: [],
    returned: [],
};

export function isOrderStatus(v: string): v is OrderStatus {
    return (ORDER_STATUSES as readonly string[]).includes(v);
}

export function isPaymentStatus(v: string): v is PaymentStatus {
    return (PAYMENT_STATUSES as readonly string[]).includes(v);
}

/** Whether `from → to` is a legal order transition (same → same is allowed). */
export function canTransition(from: string, to: string): boolean {
    if (from === to) return true;
    if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
    return ORDER_TRANSITIONS[from].includes(to);
}

/** Legal payment-status transitions — payment only moves forward (pending → paid
    → refunded), never backward, so a paid→pending→delete audit-trail bypass is
    blocked. Mirrors ORDER_TRANSITIONS/canTransition for order status. */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    pending: ["paid", "refunded"],
    paid: ["refunded"],
    refunded: [],
};

/** Whether `from → to` is a legal payment transition (same → same is allowed). */
export function canTransitionPayment(from: string, to: string): boolean {
    if (from === to) return true;
    if (!isPaymentStatus(from) || !isPaymentStatus(to)) return false;
    return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Current status followed by its legal next states — for a constrained dropdown. */
export function allowedNext(from: string): OrderStatus[] {
    if (!isOrderStatus(from)) return [...ORDER_STATUSES];
    return [from, ...ORDER_TRANSITIONS[from]];
}
