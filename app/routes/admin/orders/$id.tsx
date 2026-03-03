import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useSubmit, useNavigate, Link } from "react-router";
import { prisma } from "../../../db.server";
import { useState } from "react";

export async function loader({ params }: LoaderFunctionArgs) {
    const order = await prisma.order.findUnique({
        where: { id: params.id },
        include: {
            customer: true,
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    if (!order) {
        throw new Response("Order not found", { status: 404 });
    }

    return { order };
}

export async function action({ request, params }: ActionFunctionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "update_status") {
        const status = formData.get("status") as string;
        await prisma.order.update({
            where: { id: params.id },
            data: { status }
        });
    }

    if (intent === "update_payment") {
        const paymentStatus = formData.get("paymentStatus") as string;
        await prisma.order.update({
            where: { id: params.id },
            data: { paymentStatus }
        });
    }

    if (intent === "delete") {
        // First delete order items, then the order
        await prisma.orderItem.deleteMany({
            where: { orderId: params.id }
        });
        await prisma.order.delete({
            where: { id: params.id }
        });
        return redirect("/admin/orders");
    }

    return null;
}

const statusLabels: Record<string, { text: string; color: string }> = {
    pending: { text: 'Очікує', color: '#f59e0b' },
    processing: { text: 'Обробляється', color: '#3b82f6' },
    shipped: { text: 'Відправлено', color: '#8b5cf6' },
    delivered: { text: 'Доставлено', color: '#10b981' },
    cancelled: { text: 'Скасовано', color: '#ef4444' }
};

const paymentLabels: Record<string, { text: string; color: string }> = {
    pending: { text: 'Очікує оплати', color: '#f59e0b' },
    paid: { text: 'Оплачено', color: '#10b981' },
    refunded: { text: 'Повернуто', color: '#ef4444' }
};

export default function AdminOrderDetails() {
    const { order } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const navigate = useNavigate();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const formData = new FormData();
        formData.append("intent", "update_status");
        formData.append("status", e.target.value);
        submit(formData, { method: "post" });
    };

    const handlePaymentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const formData = new FormData();
        formData.append("intent", "update_payment");
        formData.append("paymentStatus", e.target.value);
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
    const statusInfo = statusLabels[order.status] || statusLabels.pending;
    const paymentInfo = paymentLabels[order.paymentStatus] || paymentLabels.pending;

    return (
        <div className="admin-wrapper" style={{ maxWidth: '1200px', margin: '0 auto', color: '#e2e8f0' }}>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Назад до замовлень
            </Link>

            {/* Header */}
            <div className="order-detail-header">
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0', color: '#f8fafc' }}>
                        Замовлення #{order.orderNumber}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#94a3b8', fontSize: '14px' }}>
                        <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: 'middle' }}>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {new Date(order.createdAt).toLocaleString('uk-UA', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </span>
                        <span
                            className="status-badge"
                            style={{ background: `${statusInfo.color}20`, color: statusInfo.color }}
                        >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
                            {statusInfo.text}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select
                        value={order.status}
                        onChange={handleStatusChange}
                        className="status-select"
                    >
                        <option value="pending">🕐 Очікує</option>
                        <option value="processing">⚙️ Обробляється</option>
                        <option value="shipped">📦 Відправлено</option>
                        <option value="delivered">✅ Доставлено</option>
                        <option value="cancelled">❌ Скасовано</option>
                    </select>
                    <button
                        className="btn-delete"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: 'middle' }}>
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
                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 20px 0', color: '#f8fafc' }}>
                            📦 Товари ({order.items.length})
                        </h3>
                        <div>
                            {order.items.map((item) => {
                                const price = Number(item.price) || 0;
                                const total = price * item.quantity;
                                let imageUrl = '/brand-sun.png';
                                try {
                                    if (item.product?.images) {
                                        const parsed = JSON.parse(item.product.images);
                                        imageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
                                    }
                                } catch (e) { }

                                return (
                                    <div key={item.id} className="item-card">
                                        <img
                                            src={imageUrl}
                                            alt={item.product?.name || 'Товар'}
                                            className="item-image"
                                        />
                                        <div className="item-details">
                                            <div className="item-name">{item.product?.name || 'Товар'}</div>
                                            <div className="item-meta">
                                                {(item as any).size && (
                                                    <span>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        </svg>
                                                        Розмір: {(item as any).size}
                                                    </span>
                                                )}
                                                {(item as any).color && (
                                                    <span>
                                                        <span style={{
                                                            width: 12, height: 12, borderRadius: '50%',
                                                            background: (item as any).color,
                                                            border: '1px solid rgba(255,255,255,0.2)',
                                                            display: 'inline-block'
                                                        }}></span>
                                                        Колір: {(item as any).color}
                                                    </span>
                                                )}
                                                <span>× {item.quantity} шт</span>
                                            </div>
                                        </div>
                                        <div className="item-pricing">
                                            <div className="item-price">{price.toLocaleString()} ₴</div>
                                            <div className="item-total">{total.toLocaleString()} ₴</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Order Summary */}
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
                            <div className="summary-row">
                                <span style={{ color: '#94a3b8' }}>Підсумок товарів</span>
                                <span>{itemsSubtotal.toLocaleString()} ₴</span>
                            </div>
                            <div className="summary-row">
                                <span style={{ color: '#94a3b8' }}>Доставка (Нова Пошта)</span>
                                <span style={{ color: '#94a3b8' }}>За тарифами перевізника</span>
                            </div>
                            <div className="summary-row total">
                                <span>Разом до сплати</span>
                                <span style={{ color: '#5eead4' }}>{Number(order.total).toLocaleString()} ₴</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div>
                    {/* Customer Card */}
                    <div className="order-detail-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#f8fafc' }}>
                            👤 Клієнт
                        </h3>
                        <div className="info-row">
                            <span className="info-label">Ім'я</span>
                            <span className="info-value">{order.customer?.firstName} {order.customer?.lastName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email</span>
                            <span className="info-value" style={{ color: '#5eead4' }}>{order.customer?.email}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Телефон</span>
                            <span className="info-value">{order.customer?.phone || '—'}</span>
                        </div>
                    </div>

                    {/* Payment Card */}
                    <div className="order-detail-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#f8fafc' }}>
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
                                style={{ background: `${paymentInfo.color}20`, color: paymentInfo.color }}
                            >
                                {paymentInfo.text}
                            </span>
                        </div>
                        <div style={{ marginTop: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                                Змінити статус оплати
                            </label>
                            <select
                                value={order.paymentStatus}
                                onChange={handlePaymentChange}
                                className="status-select"
                                style={{ width: '100%' }}
                            >
                                <option value="pending">🕐 Очікує оплати</option>
                                <option value="paid">✅ Оплачено</option>
                                <option value="refunded">↩️ Повернуто</option>
                            </select>
                        </div>
                    </div>

                    {/* Delivery Card */}
                    <div className="order-detail-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#f8fafc' }}>
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

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="delete-modal" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="delete-modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Видалити замовлення?</h3>
                        <p>
                            Замовлення <strong>#{order.orderNumber}</strong> буде назавжди видалено.
                            Цю дію неможливо скасувати.
                        </p>
                        <div className="delete-modal-actions">
                            <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>
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
