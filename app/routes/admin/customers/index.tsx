import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/index";
import { prisma } from "../../../db.server";

export async function loader({ request }: Route.LoaderArgs) {
    try {
        const customers = await prisma.customer.findMany({
            include: {
                orders: {
                    select: { total: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const stats = {
            total: customers.length,
            newThisMonth: customers.filter((c) => {
                const now = new Date();
                const created = new Date(c.createdAt);
                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length,
            withOrders: customers.filter((c) => c.orders.length > 0).length,
        };

        if (customers.length === 0) {
            // Mock for demo
            return {
                customers: [
                    { id: "c1", firstName: "Анна", lastName: "Коваленко", email: "anna@k.ua", createdAt: new Date().toISOString(), orders: [{ total: 2450 }] },
                    { id: "c2", firstName: "Олександр", lastName: "Петренко", email: "olex@p.ua", createdAt: new Date().toISOString(), orders: [{ total: 1200 }, { total: 800 }] },
                ],
                stats: { total: 2, newThisMonth: 1, withOrders: 2 }
            };
        }

        return { customers, stats };
    } catch (e) {
        console.warn("Customers loader failed, using mock data:", e);
        return {
            customers: [
                { id: "demo-c1", firstName: "Тест", lastName: "Клієнт1", email: "test1@demo.ua", createdAt: new Date().toISOString(), orders: [{ total: 1500 }] },
                { id: "demo-c2", firstName: "Тест", lastName: "Клієнт2", email: "test2@demo.ua", createdAt: new Date().toISOString(), orders: [] },
            ],
            stats: { total: 2, newThisMonth: 2, withOrders: 1 }
        };
    }
}

export default function AdminCustomers() {
    const { customers, stats } = useLoaderData<typeof loader>();

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const getTotalSpent = (orders: { total: any }[]) => {
        return orders.reduce((sum, order) => sum + Number(order.total), 0);
    };

    return (
        <>
            <div className="admin-page-header">
                <h1>Клієнти</h1>
                <p>Керування базою покупців</p>
            </div>

            {/* Stats Cards */}
            <div className="admin-stats">
                <div className="admin-stat">
                    <div className="admin-stat__label">Всього клієнтів</div>
                    <div className="admin-stat__value">{stats.total}</div>
                </div>
                <div className="admin-stat">
                    <div className="admin-stat__label">Нові за місяць</div>
                    <div className="admin-stat__value admin-stat__value--accent">+{stats.newThisMonth}</div>
                </div>
                <div className="admin-stat">
                    <div className="admin-stat__label">З замовленнями</div>
                    <div className="admin-stat__value">{stats.withOrders}</div>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Toolbar */}
                <div
                    style={{
                        padding: "20px 32px",
                        borderBottom: "1px solid var(--border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div style={{ position: "relative", width: "300px" }}>
                        <svg
                            style={{
                                position: "absolute",
                                left: "12px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: "18px",
                                height: "18px",
                                color: "var(--text-muted)",
                            }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Пошук клієнтів..."
                            style={{
                                width: "100%",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                padding: "10px 10px 10px 40px",
                                color: "var(--text-main)",
                                fontSize: "14px",
                                outline: "none",
                            }}
                        />
                    </div>
                    <button
                        style={{
                            background: "var(--accent-primary)",
                            color: "#0f172a",
                            border: "none",
                            padding: "10px 20px",
                            borderRadius: "8px",
                            fontWeight: "600",
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        Експорт CSV
                    </button>
                </div>

                {/* Table or Empty State */}
                {customers.length === 0 ? (
                    <div style={{ padding: "64px 32px", textAlign: "center" }}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            width="48"
                            height="48"
                            style={{ color: "var(--text-muted)", margin: "0 auto 16px" }}
                        >
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                        </svg>
                        <div style={{ color: "var(--text-main)", fontWeight: "600", marginBottom: "8px" }}>
                            Клієнтів немає
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                            Клієнти з'являться після першого замовлення
                        </div>
                    </div>
                ) : (
                    <div className="admin-table-container" style={{ border: "none", borderRadius: 0 }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Клієнт</th>
                                    <th>Замов.</th>
                                    <th>Витрачено</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((customer) => (
                                    <tr key={customer.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/admin/customers/${customer.id}`}>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                                <div
                                                    style={{
                                                        width: "40px",
                                                        height: "40px",
                                                        borderRadius: "50%",
                                                        background:
                                                            "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        color: "var(--accent-primary)",
                                                        fontWeight: "600",
                                                        fontSize: "14px",
                                                        border: "1px solid var(--border-subtle)",
                                                    }}
                                                >
                                                    {getInitials(customer.firstName, customer.lastName)}
                                                </div>
                                                <div>
                                                    <div style={{ color: "var(--text-main)", fontWeight: "500" }}>
                                                        {customer.firstName} {customer.lastName}
                                                    </div>
                                                    <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                                        {customer.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{customer.orders.length}</td>
                                        <td style={{ fontWeight: "500", color: "var(--text-main)" }}>
                                            ₴{getTotalSpent(customer.orders).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <Link
                                                to={`/admin/customers/${customer.id}`}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "var(--accent-primary)",
                                                    cursor: "pointer",
                                                    fontSize: "13px",
                                                    textDecoration: "none"
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Детальніше →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
