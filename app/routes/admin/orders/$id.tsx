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
        order,
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
                return { error: "Невідомий статус замовлення" };
            }
            // Optional operator note — for "shipped" this is the Nova Poshta ТТН,
            // which goes into the history AND the customer status email.
            const note = ((formData.get("note") as string) || "").trim() || null;
            const cur = await prisma.order.findUnique({ where: { id }, select: { status: true } });
            if (!cur) return { error: "Замовлення не знайдено" };
            if (cur.status === status) return { success: true };
            // Enforce the lifecycle: reject illegal jumps (e.g. delivered → pending).
            if (!canTransition(cur.status, status)) {
                const from =
                    ORDER_STATUS_LABELS[cur.status as keyof typeof ORDER_STATUS_LABELS] ??
                    cur.status;
                return {
                    error: `Неможливий перехід статусу: ${from} → ${ORDER_STATUS_LABELS[status]}`,
                };
            }
            // Moving to "cancelled" restores stock (same path as the Cancel button)
            // so selecting it from the dropdown can't silently lose inventory.
            if (status === "cancelled") {
                await cancelOrder(id, cur.status, note || "Скасовано (зміна статусу)");
                await notifyOrderStatus(id, "cancelled", note);
                return { success: true };
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
            return { success: true };
        }

        if (intent === "update_payment") {
            const paymentStatus = formData.get("paymentStatus") as string;
            if (!isPaymentStatus(paymentStatus)) {
                return { error: "Невідомий статус оплати" };
            }
            const cur = await prisma.order.findUnique({
                where: { id },
                select: { paymentStatus: true },
            });
            if (!cur) return { error: "Замовлення не знайдено" };
            if (cur.paymentStatus === paymentStatus) return { success: true };
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
            return { success: true };
        }

        if (intent === "cancel") {
            const cur = await prisma.order.findUnique({ where: { id }, select: { status: true } });
            if (!cur) return { error: "Замовлення не знайдено" };
            if (cur.status === "cancelled") return { success: true };
            await cancelOrder(id, cur.status, "Скасовано адміністратором");
            await notifyOrderStatus(id, "cancelled");
            return { success: true };
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
                return {
                    error: "Оплачене або доставлене замовлення не можна видалити. Спочатку скасуйте його.",
                };
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

        return null;
    } catch (e) {
        console.error("Order action error:", e);
        const message = e instanceof Error ? e.message : "Сталася серверна помилка";
        return { error: message };
    }
}

export default function AdminOrderDetails() {
    const { order, emailStatus, history } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
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

    const handleCancel = () => {
        if (!window.confirm("Скасувати замовлення? Залишок товарів буде повернено на склад."))
            return;
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
            style={{ maxWidth: "1200px", margin: "0 auto", color: "#e2e8f0" }}
        >
            <style>{`
                .order-detail-card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 20px;
                }
                .order-detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 32px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #334155;
                }
                .order-detail-grid {
                    display: grid;
                    grid-template-columns: 1.5fr 1fr;
                    gap: 24px;
                }
                @media (max-width: 900px) {
                    .order-detail-grid { grid-template-columns: 1fr; }
                }
                .status-select {
                    background: #0f172a;
                    border: 1px solid #334155;
                    color: #e2e8f0;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                    min-width: 160px;
                }
                .status-select:focus { outline: none; border-color: #5eead4; }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .info-row:last-child { border-bottom: none; }
                .info-label { color: #94a3b8; font-size: 14px; }
                .info-value { font-weight: 500; color: #f8fafc; }
                .item-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 10px;
                    margin-bottom: 12px;
                }
                .item-card:last-child { margin-bottom: 0; }
                .item-image {
                    width: 70px;
                    height: 90px;
                    object-fit: cover;
                    border-radius: 8px;
                    background: #334155;
                    flex-shrink: 0;
                }
                .item-details { flex: 1; }
                .item-name { font-weight: 600; font-size: 15px; margin-bottom: 6px; color: #f8fafc; }
                .item-meta { font-size: 13px; color: #94a3b8; display: flex; gap: 16px; flex-wrap: wrap; }
                .item-meta span { display: flex; align-items: center; gap: 4px; }
                .item-pricing { text-align: right; min-width: 100px; }
                .item-price { font-size: 14px; color: #94a3b8; margin-bottom: 4px; }
                .item-total { font-weight: 700; font-size: 16px; color: #f8fafc; }
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
                    color: #94a3b8;
                    text-decoration: none;
                    font-size: 14px;
                    margin-bottom: 20px;
                    transition: color 0.2s;
                }
                .btn-back:hover { color: #5eead4; }
                .btn-delete {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-delete:hover {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: #ef4444;
                }
                .delete-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .delete-modal-content {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 400px;
                    text-align: center;
                }
                .delete-modal h3 { margin: 0 0 12px 0; font-size: 20px; color: #f8fafc; }
                .delete-modal p { margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6; }
                .delete-modal-actions { display: flex; gap: 12px; justify-content: center; }
                .btn-cancel {
                    background: transparent;
                    border: 1px solid #334155;
                    color: #e2e8f0;
                    padding: 10px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                }
                .btn-confirm-delete {
                    background: #ef4444;
                    border: none;
                    color: white;
                    padding: 10px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                }
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    font-size: 14px;
                }
                .summary-row.total {
                    font-size: 18px;
                    font-weight: 700;
                    border-top: 1px solid #334155;
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
                            fontWeight: "700",
                            margin: "0 0 8px 0",
                            color: "#f8fafc",
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
                <div style={{ marginBottom: "10px" }}>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="ТТН Нової Пошти / примітка (увійде в лист клієнту при «Відправлено»)"
                        aria-label="ТТН або примітка до зміни статусу"
                        style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "10px 12px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "var(--text-main)",
                            fontSize: "14px",
                        }}
                    />
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <select
                        value={order.status}
                        onChange={handleStatusChange}
                        className="status-select"
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
                            onClick={handleCancel}
                            style={{
                                background: "rgba(245,158,11,0.12)",
                                border: "1px solid rgba(245,158,11,0.4)",
                                color: "#f59e0b",
                                padding: "10px 20px",
                                borderRadius: "8px",
                                fontSize: "14px",
                                fontWeight: 500,
                                cursor: "pointer",
                            }}
                        >
                            Скасувати
                        </button>
                    )}
                    <button className="btn-delete" onClick={() => setShowDeleteConfirm(true)}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ marginRight: 6, verticalAlign: "middle" }}
                        >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Видалити
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="order-detail-grid">
                {/* Left Column - Items */}
                <div>
                    <div className="order-detail-card">
                        <h3
                            style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                margin: "0 0 20px 0",
                                color: "#f8fafc",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span>📦 Товари ({order.items.length})</span>
                            <Link
                                to={`/admin/inventory?orderId=${order.id}`}
                                style={{
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: "#5eead4",
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
                                <span style={{ color: "#5eead4" }}>
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
                        <h3
                            style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                margin: "0 0 16px 0",
                                color: "#f8fafc",
                            }}
                        >
                            👤 Клієнт
                        </h3>
                        <div className="info-row">
                            <span className="info-label">Ім'я</span>
                            <span className="info-value">
                                {order.customer?.firstName} {order.customer?.lastName}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email</span>
                            <span className="info-value" style={{ color: "#5eead4" }}>
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
                        <h3
                            style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                margin: "0 0 16px 0",
                                color: "#f8fafc",
                            }}
                        >
                            💳 Оплата
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
                            <label
                                style={{
                                    display: "block",
                                    fontSize: "13px",
                                    color: "#94a3b8",
                                    marginBottom: "8px",
                                }}
                            >
                                Змінити статус оплати
                            </label>
                            <select
                                value={order.paymentStatus}
                                onChange={handlePaymentChange}
                                className="status-select"
                                style={{ width: "100%" }}
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
                        <h3
                            style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                margin: "0 0 16px 0",
                                color: "#f8fafc",
                            }}
                        >
                            🚚 Доставка
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
                    <h3
                        style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            margin: "0 0 16px",
                            color: "#f8fafc",
                        }}
                    >
                        🕓 Історія замовлення
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
                                    color: "#94a3b8",
                                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    paddingBottom: "8px",
                                }}
                            >
                                <span>
                                    <span style={{ color: "#e2e8f0" }}>
                                        {h.field === "paymentStatus" ? "Оплата" : "Статус"}:
                                    </span>{" "}
                                    {h.fromValue ? `${h.fromValue} → ` : ""}
                                    <strong style={{ color: "#5eead4" }}>{h.toValue}</strong>
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

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="delete-modal" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Видалити замовлення?</h3>
                        <p>
                            Замовлення <strong>#{order.orderNumber}</strong> буде назавжди видалено.
                            Цю дію неможливо скасувати.
                        </p>
                        <div className="delete-modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Скасувати
                            </button>
                            <button className="btn-confirm-delete" onClick={handleDelete}>
                                Видалити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
