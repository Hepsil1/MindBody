import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useSubmit, useNavigate, Link } from "react-router";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { restoreForCancelTx } from "../../../services/inventory.server";
import { cancelOrder, writeOrderHistory } from "../../../services/order.server";
import { notifyOrderStatus } from "../../../utils/email.server";
import {
    ORDER_STATUS_LABELS,
    ORDER_STATUS_COLORS,
    PAYMENT_STATUSES,
    PAYMENT_LABELS,
    PAYMENT_COLORS,
    isOrderStatus,
    isPaymentStatus,
    canTransition,
    allowedNext,
} from "../../../utils/statuses";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/admin/ConfirmDialog";
import { actionOk, actionError as actionErr } from "../../../utils/action-result.server";
import { useActionToast } from "../../../components/admin/useActionToast";

export async function loader({ request, params }: LoaderFunctionArgs) {
    // Defense-in-depth: this endpoint returns full customer PII, so guard it in
    // its own loader rather than relying solely on the parent _layout loader
    // (mirrors customers/$id.tsx). requireAdmin skips CSRF for GET.
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const order = await prisma.order.findUnique({
        where: { id: params.id },
        include: {
            customer: true,
            items: {
                include: {
                    product: true,
                },
            },
        },
    });

    if (!order) {
        throw new Response("Order not found", { status: 404 });
    }

    const historyRows = await prisma.orderStatusHistory.findMany({
        where: { orderId: params.id },
        orderBy: { createdAt: "asc" },
        select: {
            field: true,
            fromValue: true,
            toValue: true,
            actor: true,
            note: true,
            createdAt: true,
        },
    });

    return {
        // Prisma Decimal fields (order.total, items[].price, product.price) are
        // class instances the single-fetch serializer turns into plain objects —
        // Number(<that object>) is NaN ("Разом до сплати: NaN ₴" bug). Normalize
        // every money field to a plain number at the loader boundary.
        order: {
            ...order,
            total: Number(order.total),
            items: order.items.map((item) => ({
                ...item,
                price: Number(item.price),
                product: item.product
                    ? {
                          ...item.product,
                          price: Number(item.product.price),
                          comparePrice:
                              item.product.comparePrice !== null
                                  ? Number(item.product.comparePrice)
                                  : null,
                      }
                    : item.product,
            })),
        },
        emailStatus: order.emailStatus ?? null,
        appliedPromoCode: order.appliedPromoCode ?? null,
        discountAmount: order.discountAmount ? Number(order.discountAmount) : 0,
        history: historyRows.map((h) => ({
            field: h.field,
            fromValue: h.fromValue,
            toValue: h.toValue,
            actor: h.actor,
            note: h.note,
            createdAt: new Date(h.createdAt).toISOString(),
        })),
    };
}

export async function action({ request, params }: ActionFunctionArgs) {
    // requireAdmin adds the same-origin (CSRF) check the bare isAuthenticated
    // gate was missing — these are state-changing mutations.
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const id = params.id as string;
    try {
        const formData = await request.formData();
        const intent = formData.get("intent");

        if (intent === "update_status") {
            const status = formData.get("status") as string;
            // Whitelist against the single source of truth.
            if (!isOrderStatus(status)) {
                return actionErr("Невідомий статус замовлення");
            }
            // Optional operator note — for "shipped" this is the Nova Poshta ТТН,
            // which goes into the history AND the customer status email.
            const note = ((formData.get("note") as string) || "").trim() || null;
            const cur = await prisma.order.findUnique({ where: { id }, select: { status: true } });
            if (!cur) return actionErr("Замовлення не знайдено");
            if (cur.status === status) return actionOk();
            // Enforce the lifecycle: reject illegal jumps (e.g. delivered → pending).
            if (!canTransition(cur.status, status)) {
                const from =
                    ORDER_STATUS_LABELS[cur.status as keyof typeof ORDER_STATUS_LABELS] ??
                    cur.status;
                return actionErr(
                    `Неможливий перехід статусу: ${from} → ${ORDER_STATUS_LABELS[status]}`,
                );
            }
            // Moving to "cancelled" restores stock (same path as the Cancel button)
            // so selecting it from the dropdown can't silently lose inventory.
            if (status === "cancelled") {
                await cancelOrder(id, cur.status, note || "Скасовано (зміна статусу)");
                await notifyOrderStatus(id, "cancelled", note);
                return actionOk(undefined, {
                    type: "success",
                    message: "Замовлення скасовано, залишки повернено на склад",
                });
            }
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id }, data: { status } });
                await writeOrderHistory(
                    tx,
                    id,
                    "status",
                    cur.status,
                    status,
                    note ? `Зміна статусу · ${note}` : "Зміна статусу",
                );
            });
            // Best-effort customer notification (shipped/delivered) — never blocks.
            await notifyOrderStatus(id, status, note);
            return actionOk(undefined, { type: "success", message: "Статус оновлено" });
        }

        if (intent === "update_payment") {
            const paymentStatus = formData.get("paymentStatus") as string;
            if (!isPaymentStatus(paymentStatus)) {
                return actionErr("Невідомий статус оплати");
            }
            const cur = await prisma.order.findUnique({
                where: { id },
                select: { paymentStatus: true },
            });
            if (!cur) return actionErr("Замовлення не знайдено");
            if (cur.paymentStatus === paymentStatus) return actionOk();
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id }, data: { paymentStatus } });
                await writeOrderHistory(
                    tx,
                    id,
                    "paymentStatus",
                    cur.paymentStatus,
                    paymentStatus,
                    "Зміна статусу оплати",
                );
            });
            return actionOk(undefined, { type: "success", message: "Статус оплати оновлено" });
        }

        if (intent === "cancel") {
            const cur = await prisma.order.findUnique({ where: { id }, select: { status: true } });
            if (!cur) return actionErr("Замовлення не знайдено");
            if (cur.status === "cancelled") return actionOk();
            await cancelOrder(id, cur.status, "Скасовано адміністратором");
            await notifyOrderStatus(id, "cancelled");
            return actionOk(undefined, {
                type: "success",
                message: "Замовлення скасовано, залишки повернено на склад",
            });
        }

        if (intent === "delete") {
            const ord = await prisma.order.findUnique({
                where: { id },
                select: { status: true, paymentStatus: true },
            });
            if (!ord) return { error: "Замовлення не знайдено" };
            // Never hard-delete an order that represents money taken or goods
            // shipped — it must be cancelled (auditable) instead.
            if (ord.paymentStatus === "paid" || ord.status === "delivered") {
                return actionErr(
                    "Оплачене або доставлене замовлення не можна видалити. Спочатку скасуйте його.",
                );
            }
            await prisma.$transaction(async (tx) => {
                // Return stock unless it was already restored by a prior cancel.
                if (ord.status !== "cancelled") {
                    const items = await tx.orderItem.findMany({
                        where: { orderId: id },
                        select: { productId: true, quantity: true, size: true, color: true },
                    });
                    for (const it of items) {
                        await restoreForCancelTx(
                            tx,
                            {
                                productId: it.productId,
                                quantity: it.quantity,
                                size: it.size,
                                color: it.color,
                            },
                            { orderId: id, actor: "admin" },
                        );
                    }
                }
                await tx.orderItem.deleteMany({ where: { orderId: id } });
                await tx.order.delete({ where: { id } }); // OrderStatusHistory cascades
            });
            return redirect("/admin/orders");
        }

        return actionErr("Невідома дія");
    } catch (e) {
        console.error("Order action error:", e);
        const message = e instanceof Error ? e.message : "Сталася серверна помилка";
        return actionErr(message);
    }
}

export default function AdminOrderDetails() {
    const { order, emailStatus, history } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    // Toast on every action result (success + error); the inline banner below
    // additionally keeps errors visible on this money-critical page.
    useActionToast(actionData as Parameters<typeof useActionToast>[0]);
    const actionError = actionData && "error" in actionData ? (actionData.error as string) : null;
    const submit = useSubmit();
    const navigate = useNavigate();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    // Optional ТТН / note sent with a status change → into the history + the
    // customer email (shows as the tracking number on "Відправлено").
    const [note, setNote] = useState("");

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const formData = new FormData();
        formData.append("intent", "update_status");
        formData.append("status", e.target.value);
        if (note.trim()) formData.append("note", note.trim());
        submit(formData, { method: "post" });
    };

    const handlePaymentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const formData = new FormData();
        formData.append("intent", "update_payment");
        formData.append("paymentStatus", e.target.value);
        submit(formData, { method: "post" });
    };

    // Cancel-order confirmation lives in a branded ConfirmDialog (window.confirm
    // was unstyled, non-accessible, and easy to mistake for "discard edits").
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const doCancelOrder = () => {
        setShowCancelConfirm(false);
        const formData = new FormData();
        formData.append("intent", "cancel");
        submit(formData, { method: "post" });
    };

    const handleDelete = () => {
        const formData = new FormData();
        formData.append("intent", "delete");
        submit(formData, { method: "post" });
    };

    // Calculate items subtotal
    const itemsSubtotal = order.items.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * item.quantity;
    }, 0);

    const deliveryFee = 0; // Delivery is at carrier rates
    const statusInfo = {
        text: ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status,
        color: ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] ?? "#6b7280",
    };
    const paymentInfo = {
        text:
            PAYMENT_LABELS[order.paymentStatus as keyof typeof PAYMENT_LABELS] ??
            order.paymentStatus,
        color: PAYMENT_COLORS[order.paymentStatus as keyof typeof PAYMENT_COLORS] ?? "#6b7280",
    };

    return (
        <div
            className="admin-wrapper"
            style={{ maxWidth: "1200px", margin: "0 auto", color: "var(--text-secondary)" }}
        >
            <style>{`
                .order-detail-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    padding: 22px 24px;
                    margin-bottom: 18px;
                    backdrop-filter: blur(var(--glass-blur));
                    -webkit-backdrop-filter: blur(var(--glass-blur));
                }
                .order-detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 20px;
                    flex-wrap: wrap;
                    margin-bottom: 26px;
                    padding-bottom: 22px;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .order-detail-grid {
                    display: grid;
                    grid-template-columns: 1.6fr 1fr;
                    gap: 18px;
                }
                @media (max-width: 900px) {
                    .order-detail-grid { grid-template-columns: 1fr; }
                }
                /* Card title with tinted icon chip — same language as the dashboard tiles. */
                .ocard-title {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text-main);
                    margin: 0 0 18px 0;
                }
                .ocard-title__ico {
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .ocard-title__ico svg { width: 17px; height: 17px; }
                .ocard-title__spacer { margin-left: auto; }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 11px 0;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .info-row:last-child { border-bottom: none; }
                .info-label { color: var(--text-secondary); font-size: 14px; }
                .info-value { font-weight: 500; color: var(--text-main); font-size: 14px; text-align: right; }
                .item-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 14px;
                    background: rgba(0,0,0,0.18);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-sm);
                    margin-bottom: 10px;
                }
                .item-card:last-child { margin-bottom: 0; }
                .item-image {
                    width: 64px;
                    height: 82px;
                    object-fit: cover;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.06);
                    flex-shrink: 0;
                }
                .item-details { flex: 1; min-width: 0; }
                .item-name { font-weight: 600; font-size: 15px; margin-bottom: 6px; color: var(--text-main); }
                .item-meta { font-size: 13px; color: var(--text-secondary); display: flex; gap: 16px; flex-wrap: wrap; }
                .item-meta span { display: flex; align-items: center; gap: 5px; }
                .item-pricing { text-align: right; min-width: 96px; }
                .item-price { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
                .item-total { font-weight: 700; font-size: 16px; color: var(--text-main); }
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 100px;
                    font-size: 13px;
                    font-weight: 600;
                }
                .btn-back {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-secondary);
                    text-decoration: none;
                    font-size: 14px;
                    margin-bottom: 18px;
                    transition: color 0.2s;
                }
                .btn-back:hover { color: var(--accent-primary); }
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 9px 0;
                    font-size: 14px;
                }
                .summary-row.total {
                    font-size: 18px;
                    font-weight: 700;
                    border-top: 1px solid var(--border-subtle);
                    padding-top: 16px;
                    margin-top: 8px;
                }
            `}</style>

            {/* Back Link */}
            <Link to="/admin/orders" className="btn-back">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Назад до замовлень
            </Link>

            {actionError && (
                <div
                    style={{
                        margin: "0 0 16px",
                        padding: "12px 16px",
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.35)",
                        borderRadius: "10px",
                        color: "#fca5a5",
                        fontSize: "14px",
                    }}
                >
                    {actionError}
                </div>
            )}
            {emailStatus === "failed" && (
                <div
                    style={{
                        margin: "0 0 16px",
                        padding: "12px 16px",
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.35)",
                        borderRadius: "10px",
                        color: "#fbbf24",
                        fontSize: "14px",
                    }}
                >
                    ⚠️ Лист-підтвердження клієнту не було надіслано (помилка відправки email).
                </div>
            )}

            {/* Header */}
            <div className="order-detail-header">
                <div>
                    <h1
                        style={{
                            fontSize: "28px",
                            fontWeight: "600",
                            margin: "0 0 8px 0",
                            color: "var(--text-main)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Замовлення #{order.orderNumber}
                    </h1>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            color: "#94a3b8",
                            fontSize: "14px",
                        }}
                    >
                        <span>
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{ marginRight: 6, verticalAlign: "middle" }}
                            >
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {new Date(order.createdAt).toLocaleString("uk-UA", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                        <span
                            className="status-badge"
                            style={{ background: `${statusInfo.color}20`, color: statusInfo.color }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "currentColor",
                                }}
                            ></span>
                            {statusInfo.text}
                        </span>
                    </div>
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        alignItems: "stretch",
                        minWidth: "min(360px, 100%)",
                    }}
                >
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="ТТН Нової Пошти / примітка (увійде в лист клієнту при «Відправлено»)"
                        aria-label="ТТН або примітка до зміни статусу"
                        className="admin-input"
                    />
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <select
                            value={order.status}
                            onChange={handleStatusChange}
                            className="admin-select"
                            aria-label="Змінити статус замовлення"
                            style={{ flex: 1 }}
                        >
                            {/* Only the current status + its legal next states — the
                                action also enforces this (defence in depth). */}
                            {allowedNext(order.status).map((s) => (
                                <option key={s} value={s}>
                                    {ORDER_STATUS_LABELS[s]}
                                </option>
                            ))}
                        </select>
                        {order.status !== "cancelled" && (
                            <button
                                onClick={() => setShowCancelConfirm(true)}
                                title="Скасувати замовлення та повернути товари на склад"
                                className="admin-btn admin-btn--warning admin-btn--sm"
                            >
                                Скасувати
                            </button>
                        )}
                        <button
                            className="admin-btn admin-btn--danger admin-btn--sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            title="Видалити замовлення назавжди"
                            aria-label="Видалити замовлення"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="order-detail-grid">
                {/* Left Column - Items */}
                <div>
                    <div className="order-detail-card">
                        <h3 className="ocard-title">
                            <span
                                className="ocard-title__ico"
                                style={{ background: "rgba(94,234,212,0.14)", color: "#5eead4" }}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                            </span>
                            Товари ({order.items.length})
                            <Link
                                to={`/admin/inventory?orderId=${order.id}`}
                                className="ocard-title__spacer"
                                style={{
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: "var(--accent-primary)",
                                    textDecoration: "none",
                                }}
                            >
                                Рухи складу →
                            </Link>
                        </h3>
                        <div>
                            {order.items.map((item) => {
                                const price = Number(item.price) || 0;
                                const total = price * item.quantity;
                                let imageUrl = "/brand-sun.png";
                                try {
                                    if (item.product?.images) {
                                        const parsed = JSON.parse(item.product.images);
                                        imageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
                                    }
                                } catch (e) {}

                                return (
                                    <div key={item.id} className="item-card">
                                        <img
                                            src={imageUrl}
                                            alt={item.product?.name || "Товар"}
                                            className="item-image"
                                        />
                                        <div className="item-details">
                                            <div className="item-name">
                                                {item.product?.name || "Товар"}
                                            </div>
                                            <div className="item-meta">
                                                {item.size && (
                                                    <span>
                                                        <svg
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                        >
                                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        </svg>
                                                        Розмір: {item.size}
                                                    </span>
                                                )}
                                                {item.color && (
                                                    <span>
                                                        <span
                                                            style={{
                                                                width: 12,
                                                                height: 12,
                                                                borderRadius: "50%",
                                                                background: item.color,
                                                                border: "1px solid rgba(255,255,255,0.2)",
                                                                display: "inline-block",
                                                            }}
                                                        ></span>
                                                        Колір: {item.color}
                                                    </span>
                                                )}
                                                <span>× {item.quantity} шт</span>
                                            </div>
                                        </div>
                                        <div className="item-pricing">
                                            <div className="item-price">
                                                {price.toLocaleString("uk-UA")} ₴
                                            </div>
                                            <div className="item-total">
                                                {total.toLocaleString("uk-UA")} ₴
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Order Summary */}
                        <div
                            style={{
                                marginTop: "24px",
                                paddingTop: "20px",
                                borderTop: "1px solid #334155",
                            }}
                        >
                            <div className="summary-row">
                                <span style={{ color: "#94a3b8" }}>Підсумок товарів</span>
                                <span>{itemsSubtotal.toLocaleString("uk-UA")} ₴</span>
                            </div>
                            <div className="summary-row">
                                <span style={{ color: "#94a3b8" }}>Доставка (Нова Пошта)</span>
                                <span style={{ color: "#94a3b8" }}>За тарифами перевізника</span>
                            </div>
                            <div className="summary-row total">
                                <span>Разом до сплати</span>
                                <span style={{ color: "var(--accent-primary)" }}>
                                    {Number(order.total).toLocaleString("uk-UA")} ₴
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div>
                    {/* Customer Card */}
                    <div className="order-detail-card">
                        <h3 className="ocard-title">
                            <span
                                className="ocard-title__ico"
                                style={{ background: "rgba(167,139,250,0.16)", color: "#a78bfa" }}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </span>
                            Клієнт
                        </h3>
                        <div className="info-row">
                            <span className="info-label">Ім'я</span>
                            <span className="info-value">
                                {order.customer?.firstName} {order.customer?.lastName}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email</span>
                            <span className="info-value" style={{ color: "var(--accent-primary)" }}>
                                {order.customer?.email}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Телефон</span>
                            <span className="info-value">{order.customer?.phone || "—"}</span>
                        </div>
                    </div>

                    {/* Payment Card */}
                    <div className="order-detail-card">
                        <h3 className="ocard-title">
                            <span
                                className="ocard-title__ico"
                                style={{ background: "rgba(96,165,250,0.16)", color: "#60a5fa" }}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                    <line x1="1" y1="10" x2="23" y2="10" />
                                </svg>
                            </span>
                            Оплата
                        </h3>
                        <div className="info-row">
                            <span className="info-label">Спосіб оплати</span>
                            <span className="info-value">Накладений платіж</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Статус оплати</span>
                            <span
                                className="status-badge"
                                style={{
                                    background: `${paymentInfo.color}20`,
                                    color: paymentInfo.color,
                                }}
                            >
                                {paymentInfo.text}
                            </span>
                        </div>
                        <div style={{ marginTop: "16px" }}>
                            <label className="admin-label" htmlFor="payment-status-select">
                                Змінити статус оплати
                            </label>
                            <select
                                id="payment-status-select"
                                value={order.paymentStatus}
                                onChange={handlePaymentChange}
                                className="admin-select"
                            >
                                {PAYMENT_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {PAYMENT_LABELS[s]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Delivery Card */}
                    <div className="order-detail-card">
                        <h3 className="ocard-title">
                            <span
                                className="ocard-title__ico"
                                style={{ background: "rgba(45,212,191,0.14)", color: "#2dd4bf" }}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="1" y="3" width="15" height="13" />
                                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                    <circle cx="5.5" cy="18.5" r="2.5" />
                                    <circle cx="18.5" cy="18.5" r="2.5" />
                                </svg>
                            </span>
                            Доставка
                        </h3>
                        <div className="info-row">
                            <span className="info-label">Спосіб</span>
                            <span className="info-value">Нова Пошта</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Вартість</span>
                            <span className="info-value">За тарифами перевізника</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Order audit trail */}
            {history.length > 0 && (
                <div className="order-detail-card" style={{ marginTop: "20px" }}>
                    <h3 className="ocard-title">
                        <span
                            className="ocard-title__ico"
                            style={{ background: "rgba(148,163,184,0.16)", color: "#94a3b8" }}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </span>
                        Історія замовлення
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {history.map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    fontSize: "13px",
                                    color: "var(--text-secondary)",
                                    borderBottom: "1px solid var(--border-subtle)",
                                    paddingBottom: "8px",
                                }}
                            >
                                <span>
                                    <span style={{ color: "var(--text-main)" }}>
                                        {h.field === "paymentStatus" ? "Оплата" : "Статус"}:
                                    </span>{" "}
                                    {h.fromValue ? `${h.fromValue} → ` : ""}
                                    <strong style={{ color: "var(--accent-primary)" }}>
                                        {h.toValue}
                                    </strong>
                                    {h.note ? ` · ${h.note}` : ""}
                                </span>
                                <span style={{ whiteSpace: "nowrap" }}>
                                    {new Date(h.createdAt).toLocaleString("uk-UA")} · {h.actor}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Delete Confirmation — same branded ConfirmDialog as Cancel (was a
                bespoke, non-accessible inline modal). */}
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Видалити замовлення?"
                body={`Замовлення #${order.orderNumber} буде назавжди видалено. Цю дію неможливо скасувати.`}
                confirmLabel="Видалити"
                cancelLabel="Скасувати"
                tone="danger"
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    handleDelete();
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <ConfirmDialog
                open={showCancelConfirm}
                title="Скасувати замовлення?"
                body={`Замовлення #${order.orderNumber} буде позначено скасованим, а залишок товарів повернеться на склад. Клієнт отримає лист про скасування.`}
                confirmLabel="Скасувати замовлення"
                cancelLabel="Залишити"
                onConfirm={doCancelOrder}
                onCancel={() => setShowCancelConfirm(false)}
            />
        </div>
    );
}
