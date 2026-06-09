import { Link, useLoaderData } from "react-router";
import { prisma } from "../../db.server";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatus } from "../../utils/statuses";

const LOW_STOCK_THRESHOLD = 5;

export async function loader() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
        productsCount,
        customersCount,
        ordersToday,
        orders7d,
        pendingOrders,
        revenue7d,
        unapprovedReviews,
        lowStock,
        recentOrders,
    ] = await Promise.all([
        prisma.product.count(),
        prisma.customer.count(),
        prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.order.count({ where: { status: "pending" } }),
        prisma.order.aggregate({
            _sum: { total: true },
            where: { createdAt: { gte: sevenDaysAgo }, status: { not: "cancelled" } },
        }),
        prisma.review.count({ where: { isApproved: false } }),
        prisma.product.findMany({
            where: { status: "active", stock: { lte: LOW_STOCK_THRESHOLD } },
            orderBy: { stock: "asc" },
            take: 6,
            select: { id: true, name: true, stock: true },
        }),
        prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
                id: true,
                orderNumber: true,
                total: true,
                status: true,
                createdAt: true,
                customer: { select: { firstName: true, lastName: true } },
            },
        }),
    ]);

    return {
        productsCount,
        customersCount,
        ordersToday,
        orders7d,
        pendingOrders,
        revenue7d: Number(revenue7d._sum.total || 0),
        unapprovedReviews,
        lowStock,
        recentOrders: recentOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            total: Number(o.total),
            status: o.status,
            createdAt: o.createdAt.toISOString(),
            customer: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
        })),
    };
}

const uah = (n: number) =>
    new Intl.NumberFormat("uk-UA", {
        style: "currency",
        currency: "UAH",
        minimumFractionDigits: 0,
    }).format(n);

const shortDate = (iso: string) =>
    new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso));

function StatusPill({ status }: { status: string }) {
    const color = ORDER_STATUS_COLORS[status as OrderStatus] ?? "var(--text-muted)";
    const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
    return (
        <span
            style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 600,
                color,
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </span>
    );
}

export default function AdminDashboard() {
    const d = useLoaderData<typeof loader>();

    const stats = [
        { label: "Дохід (7 днів)", value: uah(d.revenue7d), accent: true },
        { label: "Замовлень сьогодні", value: String(d.ordersToday) },
        { label: "Замовлень (7 днів)", value: String(d.orders7d) },
        { label: "Товарів", value: String(d.productsCount) },
        { label: "Клієнтів", value: String(d.customersCount) },
    ];

    // Cards that only matter when the count is non-zero — they highlight when
    // there's something for the operator to act on, and stay calm otherwise.
    const attention = [
        {
            label: "Очікують обробки",
            count: d.pendingOrders,
            to: "/admin/orders?status=pending",
            tone: "#f59e0b",
        },
        {
            label: "Відгуки на модерації",
            count: d.unapprovedReviews,
            to: "/admin/reviews?approved=false",
            tone: "#3b82f6",
        },
        {
            label: `Закінчується товар (≤${LOW_STOCK_THRESHOLD})`,
            count: d.lowStock.length,
            to: "/admin/products?lowStock=true",
            tone: "#ef4444",
        },
    ];

    return (
        <>
            <div className="admin-page-header">
                <h1>Dashboard</h1>
                <p>Огляд магазину за тиждень</p>
            </div>

            <div className="admin-stats">
                {stats.map((s) => (
                    <div className="admin-stat" key={s.label}>
                        <div className="admin-stat__label">{s.label}</div>
                        <div
                            className={`admin-stat__value ${s.accent ? "admin-stat__value--accent" : ""}`}
                        >
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Attention cards */}
            <div className="dash-attention-grid">
                {attention.map((a) => {
                    const active = a.count > 0;
                    return (
                        <Link
                            key={a.label}
                            to={a.to}
                            className="admin-card admin-card--hover"
                            style={{
                                padding: "20px 24px",
                                textDecoration: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "16px",
                                border: active
                                    ? `1px solid color-mix(in srgb, ${a.tone} 45%, transparent)`
                                    : "1px solid var(--border-subtle)",
                                background: active
                                    ? `color-mix(in srgb, ${a.tone} 9%, transparent)`
                                    : undefined,
                            }}
                        >
                            <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                                {a.label}
                            </span>
                            <span
                                style={{
                                    fontSize: "26px",
                                    fontWeight: 700,
                                    color: active ? a.tone : "var(--text-muted)",
                                }}
                            >
                                {a.count}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Recent orders + low stock */}
            <div className="dash-two-col">
                <div className="admin-card" style={{ padding: "20px 24px" }}>
                    <div className="dash-section-head">
                        <h3>Останні замовлення</h3>
                        <Link to="/admin/orders" className="dash-section-link">
                            Усі →
                        </Link>
                    </div>
                    {d.recentOrders.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                            Замовлень ще немає.
                        </p>
                    ) : (
                        <div className="dash-list">
                            {d.recentOrders.map((o) => (
                                <Link key={o.id} to={`/admin/orders/${o.id}`} className="dash-row">
                                    <span style={{ color: "var(--text-main)", fontWeight: 600 }}>
                                        #{o.orderNumber}
                                    </span>
                                    <span
                                        style={{
                                            color: "var(--text-muted)",
                                            fontSize: "13px",
                                            flex: 1,
                                            minWidth: 0,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {o.customer || "—"} · {shortDate(o.createdAt)}
                                    </span>
                                    <StatusPill status={o.status} />
                                    <span style={{ color: "var(--text-main)", fontWeight: 600 }}>
                                        {uah(o.total)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <div className="admin-card" style={{ padding: "20px 24px" }}>
                    <div className="dash-section-head">
                        <h3>Закінчується на складі</h3>
                        <Link to="/admin/products?lowStock=true" className="dash-section-link">
                            Усі →
                        </Link>
                    </div>
                    {d.lowStock.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                            Усе в наявності 👍
                        </p>
                    ) : (
                        <div className="dash-list">
                            {d.lowStock.map((p) => (
                                <Link
                                    key={p.id}
                                    to={`/admin/products/${p.id}`}
                                    className="dash-row"
                                >
                                    <span
                                        style={{
                                            color: "var(--text-main)",
                                            flex: 1,
                                            minWidth: 0,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {p.name}
                                    </span>
                                    <span
                                        style={{
                                            fontWeight: 700,
                                            color: p.stock === 0 ? "#ef4444" : "#f59e0b",
                                        }}
                                    >
                                        {p.stock} шт
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
