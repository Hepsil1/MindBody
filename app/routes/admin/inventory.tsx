import { Link, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/inventory";
import { prisma } from "../../db.server";
import { paginate } from "../../utils/admin-list.server";
import {
    AdminToolbar,
    SearchInput,
    FilterSelect,
    AdminPagination,
    EmptyState,
} from "../../components/admin/list";

// Read-only audit journal of every stock change. NOT a CRUD surface — movements
// are written by the order/inventory services and never edited by hand. The
// InventoryMovement table isn't in the (un-regenerated) Prisma client, so it's
// read via parameterized raw SQL, JOINed to Product/Order for names + links.

const REASONS = ["order_created", "order_cancelled", "manual_adjustment", "correction"] as const;
const REASON_LABELS: Record<string, string> = {
    order_created: "Замовлення (списання)",
    order_cancelled: "Скасування (повернення)",
    manual_adjustment: "Ручне коригування",
    correction: "Виправлення",
};
const PER_PAGE = 50;

interface MovementRow {
    id: string;
    createdAt: Date;
    productId: string;
    productName: string | null;
    productSku: string | null;
    variantKey: string | null;
    delta: number;
    before: number;
    after: number;
    reason: string;
    actor: string;
    orderId: string | null;
    orderNumber: number | null;
}

export async function loader({ request }: Route.LoaderArgs) {
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") ?? "").trim();
    const reasonRaw = sp.get("reason") ?? "";
    const reason = (REASONS as readonly string[]).includes(reasonRaw) ? reasonRaw : "";
    const deltaRaw = sp.get("delta") ?? "";
    const delta = deltaRaw === "in" || deltaRaw === "out" ? deltaRaw : "";
    const from = (sp.get("from") ?? "").trim();
    const to = (sp.get("to") ?? "").trim();
    const orderId = (sp.get("orderId") ?? "").trim();
    const productId = (sp.get("productId") ?? "").trim();
    const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
    const skip = (page - 1) * PER_PAGE;

    // Build a parameterized WHERE. ph() returns the next $N placeholder and the
    // caller pushes the matching value, so SQL injection isn't possible.
    const where: string[] = [];
    const params: unknown[] = [];
    const ph = () => `$${params.length + 1}`;
    if (q) {
        const p = ph();
        params.push(`%${q}%`);
        where.push(`(p.name ILIKE ${p} OR p.sku ILIKE ${p})`);
    }
    if (reason) {
        where.push(`m.reason = ${ph()}`);
        params.push(reason);
    }
    if (orderId) {
        where.push(`m."orderId" = ${ph()}`);
        params.push(orderId);
    }
    if (productId) {
        where.push(`m."productId" = ${ph()}`);
        params.push(productId);
    }
    if (from) {
        where.push(`m."createdAt" >= ${ph()}::date`);
        params.push(from);
    }
    if (to) {
        where.push(`m."createdAt" < (${ph()}::date + interval '1 day')`);
        params.push(to);
    }
    if (delta === "in") where.push(`m.delta > 0`);
    if (delta === "out") where.push(`m.delta < 0`);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRows = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM "InventoryMovement" m
         LEFT JOIN "Product" p ON p.id = m."productId" ${whereSql}`,
        ...params,
    );
    const total = Number(countRows[0]?.n ?? 0);

    const rows = await prisma.$queryRawUnsafe<MovementRow[]>(
        `SELECT m.id, m."createdAt", m."productId", p.name AS "productName", p.sku AS "productSku",
                m."variantKey", m.delta, m.before, m.after, m.reason, m.actor, m."orderId",
                o."orderNumber"
         FROM "InventoryMovement" m
         LEFT JOIN "Product" p ON p.id = m."productId"
         LEFT JOIN "Order" o ON o.id = m."orderId"
         ${whereSql}
         ORDER BY m."createdAt" DESC
         LIMIT ${PER_PAGE} OFFSET ${skip}`,
        ...params,
    );

    // Context labels for the "filtered by order/product" banner.
    let orderNumber: number | null = null;
    if (orderId) {
        const o = await prisma.$queryRaw<{ orderNumber: number }[]>`
            SELECT "orderNumber" FROM "Order" WHERE id = ${orderId} LIMIT 1`;
        orderNumber = o[0] ? Number(o[0].orderNumber) : null;
    }
    let productName: string | null = null;
    if (productId) {
        const pr = await prisma.product.findUnique({
            where: { id: productId },
            select: { name: true },
        });
        productName = pr?.name ?? null;
    }

    return {
        movements: rows.map((r) => ({
            id: r.id,
            createdAt: new Date(r.createdAt).toISOString(),
            productId: r.productId,
            productName: r.productName,
            productSku: r.productSku,
            variantKey: r.variantKey,
            delta: Number(r.delta),
            before: Number(r.before),
            after: Number(r.after),
            reason: r.reason,
            actor: r.actor,
            orderId: r.orderId,
            orderNumber: r.orderNumber !== null ? Number(r.orderNumber) : null,
        })),
        page: paginate(total, page, PER_PAGE),
        state: { q, reason, delta, from, to, orderId, productId },
        orderNumber,
        productName,
    };
}

export default function AdminInventory() {
    const { movements, page, state, orderNumber, productName } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const isLoading =
        navigation.state === "loading" && navigation.location?.pathname === "/admin/inventory";

    const hasContextFilter = Boolean(state.orderId || state.productId);
    const hasFilters =
        Boolean(state.q || state.reason || state.delta || state.from || state.to) ||
        hasContextFilter;

    // Preserve the order/product context across filter-form submits.
    const preserved: Record<string, string> = {};
    if (state.orderId) preserved.orderId = state.orderId;
    if (state.productId) preserved.productId = state.productId;

    return (
        <>
            <div className="admin-page-header">
                <h1>Журнал складу</h1>
                <p>Кожна зміна залишку — хто, коли та чому. Тільки для перегляду.</p>
            </div>

            {hasContextFilter && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        marginBottom: "16px",
                        background: "rgba(94,234,212,0.08)",
                        border: "1px solid rgba(94,234,212,0.25)",
                        borderRadius: "10px",
                        color: "var(--text-main)",
                        fontSize: "14px",
                    }}
                >
                    <span>
                        {state.orderId
                            ? `Рухи складу для замовлення ${orderNumber ? `#${orderNumber}` : "(видалене)"}`
                            : `Рухи складу для товару «${productName ?? "—"}»`}
                    </span>
                    <Link
                        to="/admin/inventory"
                        style={{ color: "var(--accent-primary)", textDecoration: "none" }}
                    >
                        Скинути
                    </Link>
                </div>
            )}

            <AdminToolbar hidden={preserved}>
                <SearchInput defaultValue={state.q} placeholder="Пошук за товаром або SKU…" />
                <FilterSelect
                    name="reason"
                    value={state.reason}
                    allLabel="Всі причини"
                    options={REASONS.map((r) => ({ value: r, label: REASON_LABELS[r] }))}
                />
                <FilterSelect
                    name="delta"
                    value={state.delta}
                    allLabel="Будь-який рух"
                    options={[
                        { value: "in", label: "Надходження (+)" },
                        { value: "out", label: "Списання (−)" },
                    ]}
                />
                <input
                    type="date"
                    name="from"
                    defaultValue={state.from}
                    aria-label="Дата від"
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    style={dateInputStyle}
                />
                <input
                    type="date"
                    name="to"
                    defaultValue={state.to}
                    aria-label="Дата до"
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    style={dateInputStyle}
                />
            </AdminToolbar>

            {movements.length === 0 ? (
                <EmptyState
                    title={hasFilters ? "Рухів не знайдено" : "Журнал порожній"}
                    description={
                        hasFilters
                            ? "Спробуйте змінити фільтри."
                            : "Рухи складу з'являться після перших замовлень або коригувань."
                    }
                    action={
                        hasFilters ? (
                            <Link
                                to="/admin/inventory"
                                style={{ color: "var(--accent-primary)", textDecoration: "none" }}
                            >
                                Скинути фільтри
                            </Link>
                        ) : undefined
                    }
                />
            ) : (
                <div className="admin-card" style={{ padding: 0 }}>
                    <div
                        className="admin-table-container"
                        style={{
                            border: "none",
                            borderRadius: 0,
                            opacity: isLoading ? 0.55 : 1,
                            transition: "opacity 0.15s",
                            pointerEvents: isLoading ? "none" : "auto",
                        }}
                    >
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Товар</th>
                                    <th style={{ textAlign: "right" }}>Зміна</th>
                                    <th style={{ textAlign: "right" }}>Було → Стало</th>
                                    <th>Причина</th>
                                    <th>Хто</th>
                                    <th>Замовлення</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((m) => {
                                    const positive = m.delta > 0;
                                    return (
                                        <tr key={m.id}>
                                            <td style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                                                {new Date(m.createdAt).toLocaleString("uk-UA", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>
                                            <td>
                                                {m.productName ? (
                                                    <Link
                                                        to={`/admin/products/${m.productId}`}
                                                        style={{
                                                            color: "var(--text-main)",
                                                            fontWeight: 500,
                                                            textDecoration: "none",
                                                        }}
                                                    >
                                                        {m.productName}
                                                    </Link>
                                                ) : (
                                                    <span style={{ color: "var(--text-muted)" }}>
                                                        (видалений товар)
                                                    </span>
                                                )}
                                                <div
                                                    style={{
                                                        color: "var(--text-muted)",
                                                        fontSize: "12px",
                                                    }}
                                                >
                                                    {[m.productSku, m.variantKey]
                                                        .filter(Boolean)
                                                        .join(" · ") || "—"}
                                                </div>
                                            </td>
                                            <td
                                                style={{
                                                    textAlign: "right",
                                                    fontWeight: 700,
                                                    color: positive ? "#10b981" : "#f87171",
                                                }}
                                            >
                                                {positive ? `+${m.delta}` : m.delta}
                                            </td>
                                            <td
                                                style={{
                                                    textAlign: "right",
                                                    color: "var(--text-secondary)",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                {m.before} → <strong>{m.after}</strong>
                                            </td>
                                            <td>
                                                <span
                                                    style={{
                                                        fontSize: "12px",
                                                        padding: "3px 10px",
                                                        borderRadius: "100px",
                                                        background: "rgba(255,255,255,0.05)",
                                                        color: "var(--text-secondary)",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {REASON_LABELS[m.reason] ?? m.reason}
                                                </span>
                                            </td>
                                            <td
                                                style={{
                                                    color: "var(--text-muted)",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                {m.actor}
                                            </td>
                                            <td>
                                                {m.orderId && m.orderNumber ? (
                                                    <Link
                                                        to={`/admin/orders/${m.orderId}`}
                                                        style={{
                                                            color: "var(--accent-primary)",
                                                            textDecoration: "none",
                                                        }}
                                                    >
                                                        #{m.orderNumber}
                                                    </Link>
                                                ) : m.orderId ? (
                                                    <span style={{ color: "var(--text-muted)" }}>
                                                        (видалене)
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "var(--text-muted)" }}>
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <AdminPagination page={page} />
                </div>
            )}
        </>
    );
}

const dateInputStyle: React.CSSProperties = {
    padding: "9px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "var(--text-main)",
    fontSize: "14px",
    outline: "none",
};
