import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { prisma } from "../../db.server";
import { requireAdmin } from "../../utils/admin-guard.server";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatus } from "../../utils/statuses";

const LOW_STOCK_THRESHOLD = 5;

export async function loader({ request }: Route.LoaderArgs) {
    // Defense-in-depth: the _layout loader already redirects unauthenticated
    // requests, but guard here too (consistency with orders/$id, customers/$id).
    const denied = await requireAdmin(request);
    if (denied) return denied;
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

// Group the digits with uk-UA, then append "₴" ourselves. The currency STYLE
// of Intl.NumberFormat renders the symbol differently on Node (ICU → "грн")
// vs the browser ("₴"), which hydration-mismatches. A plain number + manual
// symbol is identical on both sides (matches the order/customer pages).
const uah = (n: number) => `${new Intl.NumberFormat("uk-UA").format(n)} ₴`;

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

// Tinted icon swatch for the metric tiles (icon by index → meaningful glyph).
const tileTint = (hex: string) => ({
    background: `color-mix(in srgb, ${hex} 16%, transparent)`,
    color: hex,
});

export default function AdminDashboard() {
    const d = useLoaderData<typeof loader>();

    const tiles = [
        {
            label: "Замовлень сьогодні",
            value: String(d.ordersToday),
            tone: "#5eead4",
            to: "/admin/orders",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                </svg>
            ),
        },
        {
            label: "Замовлень за тиждень",
            value: String(d.orders7d),
            tone: "#a78bfa",
            to: "/admin/orders",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                </svg>
            ),
        },
        {
            label: "Товарів у каталозі",
            value: String(d.productsCount),
            tone: "#60a5fa",
            to: "/admin/products",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.6 7.3 12 12 3.4 7.3M12 12v9.5M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
            ),
        },
        {
            label: "Клієнтів",
            value: String(d.customersCount),
            tone: "#f0abfc",
            to: "/admin/customers",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
                </svg>
            ),
        },
    ];

    // Cards that only matter when the count is non-zero — they highlight when
    // there's something for the operator to act on, and stay calm otherwise.
    const attention = [
        {
            label: "Замовлення очікують обробки",
            count: d.pendingOrders,
            to: "/admin/orders?status=pending",
            tone: "#f59e0b",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                </svg>
            ),
        },
        {
            label: "Відгуки на модерації",
            count: d.unapprovedReviews,
            to: "/admin/reviews?approved=false",
            tone: "#3b82f6",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            ),
        },
        {
            label: `Закінчується товар (≤${LOW_STOCK_THRESHOLD})`,
            count: d.lowStock.length,
            to: "/admin/products?lowStock=1",
            tone: "#ef4444",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    <path d="M12 9v4M12 17h.01" />
                </svg>
            ),
        },
    ];

    return (
        <>
            <div className="admin-page-header">
                <h1>Дашборд</h1>
                <p>Огляд магазину за тиждень</p>
            </div>

            {/* Revenue hero + metric tiles */}
            <div className="dash-grid">
                <div className="dash-hero">
                    <div className="dash-hero__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    </div>
                    <div>
                        <div className="dash-hero__label">Дохід за 7 днів</div>
                        <div className="dash-hero__value">{uah(d.revenue7d)}</div>
                    </div>
                    <div className="dash-hero__foot">
                        <span className="dash-hero__chip">{d.orders7d} замовлень</span>
                        <span>за тиждень · без скасованих</span>
                    </div>
                </div>

                {tiles.map((t) => (
                    <Link key={t.label} to={t.to} className="dash-tile">
                        <div className="dash-tile__icon" style={tileTint(t.tone)}>
                            {t.icon}
                        </div>
                        <div>
                            <div className="dash-tile__value">{t.value}</div>
                            <div className="dash-tile__label">{t.label}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Attention strip */}
            <div className="dash-attn">
                {attention.map((a) => {
                    const active = a.count > 0;
                    return (
                        <Link
                            key={a.label}
                            to={a.to}
                            className="dash-attn-card"
                            style={
                                active
                                    ? {
                                          borderColor: `color-mix(in srgb, ${a.tone} 45%, transparent)`,
                                          background: `color-mix(in srgb, ${a.tone} 8%, transparent)`,
                                      }
                                    : undefined
                            }
                        >
                            <div
                                className="dash-attn-card__icon"
                                style={
                                    active
                                        ? tileTint(a.tone)
                                        : {
                                              background: "rgba(255,255,255,0.04)",
                                              color: "var(--text-muted)",
                                          }
                                }
                            >
                                {a.icon}
                            </div>
                            <span className="dash-attn-card__label">{a.label}</span>
                            <span
                                className="dash-attn-card__count"
                                style={{ color: active ? a.tone : "var(--text-muted)" }}
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
                        <Link to="/admin/products?lowStock=1" className="dash-section-link">
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
