import { Link, useLoaderData } from "react-router";
import { prisma } from "../../../db.server";

export async function loader() {
    try {
        const orders = await prisma.order.findMany({
            include: {
                customer: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return {
            orders: orders.map(order => ({
                id: order.id,
                orderNumber: String(order.orderNumber), // Ensure string for UI
                customer: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : "Unknown",
                email: order.customer?.email || "No Email",
                date: new Date(order.createdAt).toLocaleDateString('uk-UA'),
                total: Number(order.total),
                paymentStatus: order.paymentStatus,
                orderStatus: order.status
            }))
        };
    } catch (e) {
        console.error("Orders loader failed:", e);
        return { orders: [] };
    }
}

export default function AdminOrdersList() {
    const { orders } = useLoaderData<typeof loader>();

    return (
        <div className="admin-wrapper">
            <style>{`
                :root {
                    --ad-bg: #0f1115;
                    --ad-bg-card: #181b21;
                    --ad-border: rgba(255, 255, 255, 0.08);
                    --ad-text-main: #f1f5f9;
                    --ad-text-muted: #94a3b8;
                    --ad-primary: #5eead4;
                    --ad-badge-bg: rgba(94, 234, 212, 0.1);
                    --ad-badge-text: #5eead4;
                }
                
                .admin-page-header { margin-bottom: 32px; }
                .admin-page-header h1 { font-size: 24px; font-weight: 500; margin: 0 0 8px 0; color: var(--ad-text-main); }
                .admin-page-header p { color: var(--ad-text-muted); margin: 0; font-size: 14px; }

                .admin-table-container {
                    background: var(--ad-bg-card);
                    border: 1px solid var(--ad-border);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .admin-table { width: 100%; border-collapse: collapse; }
                .admin-table th {
                    text-align: left;
                    padding: 16px 24px;
                    color: var(--ad-text-muted);
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                    border-bottom: 1px solid var(--ad-border);
                    background: rgba(255,255,255,0.02);
                }
                .admin-table td {
                    padding: 16px 24px;
                    color: var(--ad-text-main);
                    border-bottom: 1px solid var(--ad-border);
                    font-size: 14px;
                }
                .admin-table tr:last-child td { border-bottom: none; }
                .admin-table tr:hover td { background: rgba(255,255,255,0.02); }

                .status-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: capitalize;
                }
                .status-pending { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .status-processing { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
                .status-shipped { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
                .status-delivered { background: rgba(16, 185, 129, 0.15); color: #10b981; }
                .status-cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

                .btn-view {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 16px;
                    border-radius: 6px;
                    background: transparent;
                    border: 1px solid var(--ad-border);
                    color: var(--ad-text-main);
                    font-size: 13px;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .btn-view:hover {
                    border-color: var(--ad-primary);
                    color: var(--ad-primary);
                    background: rgba(94, 234, 212, 0.05);
                }
            `}</style>

            {/* Page Header */}
            <div className="admin-page-header">
                <div>
                    <h1>Замовлення</h1>
                    <p>Керуйте та відстежуйте замовлення клієнтів</p>
                </div>
            </div>

            {/* Orders Table or Empty State */}
            {orders.length === 0 ? (
                <div style={{
                    padding: '80px 20px',
                    textAlign: 'center',
                    background: 'var(--ad-bg-card)',
                    borderRadius: '12px',
                    border: '1px solid var(--ad-border)'
                }}>
                    <div style={{ opacity: 0.5, marginBottom: '20px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="60" height="60">
                            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 01-8 0" />
                        </svg>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 500 }}>Замовлень поки немає</h3>
                    <p style={{ margin: 0, color: 'var(--ad-text-muted)' }}>
                        Тут з'являться замовлення, коли клієнти зроблять перші покупки
                    </p>
                </div>
            ) : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Замовлення</th>
                                <th>Клієнт</th>
                                <th>Дата</th>
                                <th>Сума</th>
                                <th>Статус</th>
                                <th>Оплата</th>
                                <th style={{ width: '100px', textAlign: 'right' }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--ad-text-main)' }}>#{order.orderNumber}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{order.customer}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--ad-text-muted)' }}>{order.email}</div>
                                    </td>
                                    <td>{order.date}</td>
                                    <td style={{ fontWeight: 600 }}>{order.total.toLocaleString()} ₴</td>
                                    <td>
                                        <span className={`status-badge status-${order.orderStatus}`}>
                                            {order.orderStatus === 'pending' && 'Очікує'}
                                            {order.orderStatus === 'processing' && 'Обробляється'}
                                            {order.orderStatus === 'shipped' && 'Відправлено'}
                                            {order.orderStatus === 'delivered' && 'Доставлено'}
                                            {order.orderStatus === 'cancelled' && 'Скасовано'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>
                                                Накладений платіж
                                            </span>
                                            <span style={{
                                                fontSize: '12px',
                                                color: order.paymentStatus === 'paid' ? '#10b981' :
                                                    order.paymentStatus === 'refunded' ? '#ef4444' : '#f59e0b',
                                                display: 'flex', alignItems: 'center', gap: '5px'
                                            }}>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}></span>
                                                {order.paymentStatus === 'pending' && 'Очікує оплати'}
                                                {order.paymentStatus === 'paid' && 'Оплачено'}
                                                {order.paymentStatus === 'refunded' && 'Повернуто'}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <Link to={`/admin/orders/${order.id}`} className="btn-view">
                                            Деталі
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
