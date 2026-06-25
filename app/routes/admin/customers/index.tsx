import { useLoaderData, Link, useSearchParams, useNavigation } from "react-router";
import type { Route } from "./+types/index";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { buildListQuery, paginate, type ListSpec } from "../../../utils/admin-list.server";
import {
    AdminToolbar,
    SearchInput,
    SortableTh,
    AdminPagination,
    EmptyState,
} from "../../../components/admin/list";

const CUSTOMER_LIST: ListSpec = {
    searchFields: ["firstName", "lastName", "email"],
    sortable: { createdAt: "createdAt", firstName: "firstName", email: "email" },
    defaultSort: { field: "createdAt", dir: "desc" },
    perPageDefault: 20,
};

export async function loader({ request }: Route.LoaderArgs) {
    // Defense-in-depth: the _layout loader already redirects unauthenticated
    // requests, but guard here too (consistency with orders/$id, customers/$id).
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const { where, orderBy, skip, take, state } = buildListQuery<Prisma.CustomerWhereInput>(
        request,
        CUSTOMER_LIST,
    );

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [rows, total, statTotal, statNew, statWithOrders] = await prisma.$transaction([
        prisma.customer.findMany({
            where,
            orderBy,
            skip,
            take,
            include: { orders: { select: { total: true } } },
        }),
        prisma.customer.count({ where }),
        prisma.customer.count(),
        prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.customer.count({ where: { orders: { some: {} } } }),
    ]);

    const customers = rows.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        orderCount: c.orders.length,
        totalSpent: c.orders.reduce((s, o) => s + Number(o.total), 0),
    }));

    return {
        customers,
        page: paginate(total, state.page, state.perPage),
        state,
        stats: { total: statTotal, newThisMonth: statNew, withOrders: statWithOrders },
    };
}

const getInitials = (firstName: string, lastName: string) =>
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

export default function AdminCustomers() {
    const { customers, page, state, stats } = useLoaderData<typeof loader>();
    const [sp] = useSearchParams();
    const navigation = useNavigation();

    const isListLoading =
        navigation.state === "loading" && navigation.location?.pathname === "/admin/customers";
    const exportHref = `/admin/customers/export${sp.toString() ? `?${sp.toString()}` : ""}`;
    const hasSearch = Boolean(state.q);

    const csvButton = (
        <a href={exportHref} className="admin-btn admin-btn--secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Експорт CSV
        </a>
    );

    return (
        <>
            <div className="admin-page-header">
                <h1>Клієнти</h1>
                <p>Керування базою покупців</p>
            </div>

            <div className="admin-stats">
                <div className="admin-stat">
                    <div className="admin-stat__label">Всього клієнтів</div>
                    <div className="admin-stat__value">{stats.total}</div>
                </div>
                <div className="admin-stat">
                    <div className="admin-stat__label">Нові за місяць</div>
                    <div className="admin-stat__value admin-stat__value--accent">
                        +{stats.newThisMonth}
                    </div>
                </div>
                <div className="admin-stat">
                    <div className="admin-stat__label">З замовленнями</div>
                    <div className="admin-stat__value">{stats.withOrders}</div>
                </div>
            </div>

            <AdminToolbar right={csvButton}>
                <SearchInput defaultValue={state.q} placeholder="Пошук за ім'ям або email…" />
            </AdminToolbar>

            {customers.length === 0 ? (
                <EmptyState
                    icon={
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            width="48"
                            height="48"
                        >
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                        </svg>
                    }
                    title={hasSearch ? "Нічого не знайдено" : "Клієнтів немає"}
                    description={
                        hasSearch
                            ? "Спробуйте інший запит."
                            : "Клієнти з'являться після першого замовлення."
                    }
                    action={
                        hasSearch ? (
                            <Link
                                to="/admin/customers"
                                style={{ color: "var(--accent-primary)", textDecoration: "none" }}
                            >
                                Скинути пошук
                            </Link>
                        ) : undefined
                    }
                />
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
                    <div
                        className="admin-table-container"
                        style={{
                            border: "none",
                            borderRadius: 0,
                            opacity: isListLoading ? 0.55 : 1,
                            transition: "opacity 0.15s",
                            pointerEvents: isListLoading ? "none" : "auto",
                        }}
                    >
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <SortableTh field="firstName" label="Клієнт" state={state} />
                                    <th>Замов.</th>
                                    <th>Витрачено</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((customer) => (
                                    <tr key={customer.id}>
                                        <td>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "16px",
                                                }}
                                            >
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
                                                        fontWeight: 600,
                                                        fontSize: "14px",
                                                        border: "1px solid var(--border-subtle)",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {getInitials(
                                                        customer.firstName,
                                                        customer.lastName,
                                                    )}
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            color: "var(--text-main)",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        {customer.firstName} {customer.lastName}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: "var(--text-muted)",
                                                            fontSize: "13px",
                                                        }}
                                                    >
                                                        {customer.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{customer.orderCount}</td>
                                        <td style={{ fontWeight: 500, color: "var(--text-main)" }}>
                                            ₴{customer.totalSpent.toLocaleString("uk-UA")}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <Link
                                                to={`/admin/customers/${customer.id}`}
                                                style={{
                                                    color: "var(--accent-primary)",
                                                    fontSize: "13px",
                                                    textDecoration: "none",
                                                }}
                                            >
                                                Детальніше →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <AdminPagination page={page} />
                </div>
            )}
        </>
    );
}
