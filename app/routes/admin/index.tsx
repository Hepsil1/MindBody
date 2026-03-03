import { Link } from "react-router";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { prisma } from "../../db.server";

export async function loader({ request }: Route.LoaderArgs) {
    try {
        const [productsCount, customersCount, revenue] = await Promise.all([
            prisma.product.count(),
            prisma.customer.count(),
            prisma.order.aggregate({ _sum: { total: true } }),
        ]);

        return {
            productsCount,
            customersCount,
            revenue: Number(revenue._sum.total || 0),
            debugError: null
        };
    } catch (error: any) {
        console.error("DEBUG: Admin Dashboard Loader Error:", error);
        return {
            productsCount: 0,
            customersCount: 0,
            revenue: 0,
            debugError: error?.message || "Unknown error"
        };
    }
}

export default function AdminDashboard() {
    const { productsCount, customersCount, revenue, debugError } = useLoaderData<typeof loader>();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("uk-UA", {
            style: "currency",
            currency: "UAH",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const stats = [
        { label: "Дохід", value: formatCurrency(revenue), accent: true },
        { label: "Товарів", value: productsCount.toString() },
        { label: "Клієнтів", value: customersCount.toString() },
    ];

    return (
        <>
            <div className="admin-page-header">
                <h1>Dashboard</h1>
                <p>Огляд магазину</p>
                {debugError && (
                    <div style={{ color: 'red', marginTop: '10px', padding: '10px', border: '1px solid red', borderRadius: '5px' }}>
                        Error: {debugError}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="admin-stats">
                {stats.map((stat, i) => (
                    <div className="admin-stat" key={i}>
                        <div className="admin-stat__label">{stat.label}</div>
                        <div className={`admin-stat__value ${stat.accent ? "admin-stat__value--accent" : ""}`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Links */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
                <Link to="/admin/products" className="admin-card admin-card--hover" style={{ padding: "32px", textDecoration: "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ color: "var(--text-muted)" }}>
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                        </svg>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ color: "var(--text-main)", fontWeight: "600", marginBottom: "4px" }}>Товари</div>
                            <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                                {productsCount > 0 ? `${productsCount} товарів` : "Товарів немає"}
                            </div>
                        </div>
                    </div>
                </Link>

                <Link to="/admin/customers" className="admin-card admin-card--hover" style={{ padding: "32px", textDecoration: "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ color: "var(--text-muted)" }}>
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                        </svg>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ color: "var(--text-main)", fontWeight: "600", marginBottom: "4px" }}>Клієнти</div>
                            <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                                {customersCount > 0 ? `${customersCount} клієнтів` : "Клієнтів немає"}
                            </div>
                        </div>
                    </div>
                </Link>

                <Link to="/admin/slides" className="admin-card admin-card--hover" style={{ padding: "32px", textDecoration: "none", border: "1px solid var(--accent-primary)", background: "rgba(94, 234, 212, 0.05)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ color: "var(--accent-primary)" }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 4" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M20 20L4 4" />
                        </svg>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ color: "var(--text-main)", fontWeight: "600", marginBottom: "4px" }}>Редактор сайту</div>
                            <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                                Візуальне налаштування
                            </div>
                        </div>
                    </div>
                </Link>
            </div>
        </>
    );
}
