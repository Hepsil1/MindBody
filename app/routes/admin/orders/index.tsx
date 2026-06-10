import { Link, useLoaderData, useFetcher, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/index";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { actionOk, actionError, runAction } from "../../../utils/action-result.server";
import { buildListQuery, paginate, type ListSpec } from "../../../utils/admin-list.server";
import {
    AdminToolbar,
    SearchInput,
    FilterSelect,
    SortableTh,
    AdminPagination,
    BulkActionBar,
    EmptyState,
    useRowSelection,
} from "../../../components/admin/list";
import { ConfirmDialog } from "../../../components/admin/ConfirmDialog";
import { useActionToast } from "../../../components/admin/useActionToast";
import {
    ORDER_STATUSES,
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
import { cancelOrder, writeOrderHistory } from "../../../services/order.server";
import { notifyOrderStatus } from "../../../utils/email.server";

const ORDER_LIST: ListSpec = {
    sortable: { createdAt: "createdAt", total: "total", orderNumber: "orderNumber" },
    defaultSort: { field: "createdAt", dir: "desc" },
    filters: [
        { param: "status", allowed: ORDER_STATUSES },
        { param: "paymentStatus", allowed: PAYMENT_STATUSES },
    ],
    perPageDefault: 20,
};

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "bulk_status") {
        const ids = formData.getAll("ids").map(String).filter(Boolean);
        const status = formData.get("status");
        if (ids.length === 0) return actionError("Нічого не обрано");
        if (typeof status !== "string" || !isOrderStatus(status))
            return actionError("Невірний статус");
        return runAction("orders.bulkStatus", async () => {
            // Each order has its OWN lifecycle position, so a bulk change can't be
            // a blind updateMany: apply only where the transition is legal, write
            // history per order (and return stock via the shared cancel path),
            // then report what was skipped instead of silently "succeeding".
            let skipped = 0;
            const appliedIds: string[] = [];
            for (const id of ids) {
                const cur = await prisma.order.findUnique({
                    where: { id },
                    select: { status: true },
                });
                if (!cur || cur.status === status || !canTransition(cur.status, status)) {
                    skipped++;
                    continue;
                }
                if (status === "cancelled") {
                    await cancelOrder(id, cur.status, "Масове скасування зі списку");
                } else {
                    await prisma.$transaction(async (tx) => {
                        await tx.order.update({ where: { id }, data: { status } });
                        await writeOrderHistory(
                            tx,
                            id,
                            "status",
                            cur.status,
                            status,
                            "Масова зміна статусу зі списку",
                        );
                    });
                }
                appliedIds.push(id);
            }
            // Best-effort customer notifications (no per-order ТТН from a bulk op).
            await Promise.allSettled(appliedIds.map((oid) => notifyOrderStatus(oid, status)));
            const applied = appliedIds.length;
            const label = ORDER_STATUS_LABELS[status];
            if (applied === 0)
                return actionError(
                    `Жодне з ${ids.length} замовлень не можна перевести у «${label}»`,
                );
            return actionOk(undefined, {
                type: skipped > 0 ? "info" : "success",
                message:
                    skipped > 0
                        ? `${label}: оновлено ${applied}, пропущено ${skipped} (недопустимий перехід)`
                        : `${label}: оновлено ${applied}`,
            });
        });
    }

    const id = String(formData.get("id") || "");
    if (!id) return actionError("Не вказано замовлення");

    if (intent === "set_status") {
        const status = formData.get("status");
        if (typeof status !== "string" || !isOrderStatus(status))
            return actionError("Невірний статус");
        return runAction("orders.setStatus", async () => {
            const cur = await prisma.order.findUnique({ where: { id }, select: { status: true } });
            if (!cur) return actionError("Замовлення не знайдено");
            if (cur.status === status)
                return actionOk(undefined, { type: "info", message: "Без змін" });
            // Same lifecycle as the detail page (defence in depth).
            if (!canTransition(cur.status, status)) {
                const from =
                    ORDER_STATUS_LABELS[cur.status as keyof typeof ORDER_STATUS_LABELS] ??
                    cur.status;
                return actionError(`Неможливий перехід: ${from} → ${ORDER_STATUS_LABELS[status]}`);
            }
            // Cancel goes through the shared path so stock is always returned.
            if (status === "cancelled") {
                await cancelOrder(id, cur.status, "Скасовано зі списку замовлень");
                await notifyOrderStatus(id, "cancelled");
                return actionOk(undefined, {
                    type: "success",
                    message: "Скасовано, залишок повернено",
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
                    "Зміна статусу зі списку",
                );
            });
            await notifyOrderStatus(id, status);
            return actionOk(undefined, {
                type: "success",
                message: `Статус: ${ORDER_STATUS_LABELS[status]}`,
            });
        });
    }

    if (intent === "set_payment") {
        const paymentStatus = formData.get("paymentStatus");
        if (typeof paymentStatus !== "string" || !isPaymentStatus(paymentStatus))
            return actionError("Невірний статус оплати");
        return runAction("orders.setPayment", async () => {
            const cur = await prisma.order.findUnique({
                where: { id },
                select: { paymentStatus: true },
            });
            if (!cur) return actionError("Замовлення не знайдено");
            if (cur.paymentStatus === paymentStatus)
                return actionOk(undefined, { type: "info", message: "Без змін" });
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id }, data: { paymentStatus } });
                await writeOrderHistory(
                    tx,
                    id,
                    "paymentStatus",
                    cur.paymentStatus,
                    paymentStatus,
                    "Зміна оплати зі списку",
                );
            });
            return actionOk(undefined, {
                type: "success",
                message: `Оплата: ${PAYMENT_LABELS[paymentStatus]}`,
            });
        });
    }

    return null;
}

export async function loader({ request }: Route.LoaderArgs) {
    const { where, orderBy, skip, take, state } = buildListQuery<Prisma.OrderWhereInput>(
        request,
        ORDER_LIST,
    );

    // Order search spans a numeric order number and the customer relation, so it
    // can't use buildListQuery's simple top-level searchFields.
    const q = state.q;
    const finalWhere: Prisma.OrderWhereInput = q
        ? {
              AND: [
                  where,
                  {
                      OR: [
                          ...(/^\d+$/.test(q) ? [{ orderNumber: parseInt(q, 10) }] : []),
                          {
                              customer: {
                                  firstName: { contains: q, mode: "insensitive" as const },
                              },
                          },
                          { customer: { lastName: { contains: q, mode: "insensitive" as const } } },
                          { customer: { email: { contains: q, mode: "insensitive" as const } } },
                      ],
                  },
              ],
          }
        : where;

    const [rows, total] = await prisma.$transaction([
        prisma.order.findMany({
            where: finalWhere,
            include: { customer: true },
            orderBy,
            skip,
            take,
        }),
        prisma.order.count({ where: finalWhere }),
    ]);

    const orders = rows.map((order) => ({
        id: order.id,
        orderNumber: String(order.orderNumber),
        customer: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : "—",
        email: order.customer?.email || "—",
        date: new Date(order.createdAt).toLocaleDateString("uk-UA"),
        total: Number(order.total),
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
    }));

    return { orders, page: paginate(total, state.page, state.perPage), state };
}

const pillSelectStyle = (color: string): React.CSSProperties => ({
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "100px",
    padding: "5px 10px",
    fontSize: "13px",
    fontWeight: 600,
    color,
    cursor: "pointer",
});

export default function AdminOrdersList() {
    const { orders, page, state } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const mutate = useFetcher<typeof action>();
    useActionToast(mutate.data);

    const isListLoading =
        navigation.state === "loading" && navigation.location?.pathname === "/admin/orders";

    // Bulk status change (mirrors products/reviews): row selection is ephemeral
    // and cleared whenever the visible result set changes, so a bulk action can
    // never hit rows the operator no longer sees.
    const { selected, toggle, toggleAll, clear, allSelected, someSelected, selectedIds } =
        useRowSelection(orders);
    const rowsSignature = orders.map((o) => o.id).join(",");
    useEffect(() => {
        clear();
    }, [rowsSignature, clear]);

    const [bulkStatus, setBulkStatus] = useState("");
    const [confirmBulkCancel, setConfirmBulkCancel] = useState(false);
    const mutating = mutate.state !== "idle";

    const submitBulk = (status: string) => {
        const fd = new FormData();
        fd.set("intent", "bulk_status");
        fd.set("status", status);
        selectedIds.forEach((id) => fd.append("ids", id));
        mutate.submit(fd, { method: "post" });
        clear();
        setBulkStatus("");
    };
    const applyBulk = () => {
        if (!bulkStatus || selectedIds.length === 0) return;
        // Mass-cancel returns stock for every order — confirm before firing.
        if (bulkStatus === "cancelled") setConfirmBulkCancel(true);
        else submitBulk(bulkStatus);
    };

    return (
        <>
            <div className="admin-page-header">
                <h1>Замовлення</h1>
                <p>Керуйте та відстежуйте замовлення клієнтів</p>
            </div>

            <AdminToolbar>
                <SearchInput defaultValue={state.q} placeholder="Пошук за №, ім'ям, email…" />
                <FilterSelect
                    name="status"
                    value={state.filters.status ?? ""}
                    allLabel="Всі статуси"
                    options={ORDER_STATUSES.map((s) => ({
                        value: s,
                        label: ORDER_STATUS_LABELS[s],
                    }))}
                />
                <FilterSelect
                    name="paymentStatus"
                    value={state.filters.paymentStatus ?? ""}
                    allLabel="Будь-яка оплата"
                    options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_LABELS[s] }))}
                />
            </AdminToolbar>

            {orders.length === 0 ? (
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
                            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 01-8 0" />
                        </svg>
                    }
                    title={
                        state.q || Object.keys(state.filters).length > 0
                            ? "Нічого не знайдено"
                            : "Замовлень поки немає"
                    }
                    description={
                        state.q || Object.keys(state.filters).length > 0
                            ? "Спробуйте змінити пошук або фільтри."
                            : "Тут з'являться замовлення після перших покупок."
                    }
                    action={
                        state.q || Object.keys(state.filters).length > 0 ? (
                            <Link
                                to="/admin/orders"
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
                            opacity: isListLoading ? 0.55 : 1,
                            transition: "opacity 0.15s",
                            pointerEvents: isListLoading ? "none" : "auto",
                        }}
                    >
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "36px" }}>
                                        <input
                                            type="checkbox"
                                            aria-label="Обрати всі замовлення на сторінці"
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = someSelected;
                                            }}
                                            onChange={toggleAll}
                                            style={{ accentColor: "var(--accent-primary)" }}
                                        />
                                    </th>
                                    <SortableTh
                                        field="orderNumber"
                                        label="Замовлення"
                                        state={state}
                                    />
                                    <th>Клієнт</th>
                                    <SortableTh field="createdAt" label="Дата" state={state} />
                                    <SortableTh field="total" label="Сума" state={state} />
                                    <th>Статус</th>
                                    <th>Оплата</th>
                                    <th style={{ textAlign: "right" }}>Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                aria-label={`Обрати замовлення #${order.orderNumber}`}
                                                checked={selected.has(order.id)}
                                                onChange={() => toggle(order.id)}
                                                style={{ accentColor: "var(--accent-primary)" }}
                                            />
                                        </td>
                                        <td style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                            #{order.orderNumber}
                                        </td>
                                        <td>
                                            <div
                                                style={{
                                                    fontWeight: 500,
                                                    color: "var(--text-main)",
                                                }}
                                            >
                                                {order.customer}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: "var(--text-muted)",
                                                }}
                                            >
                                                {order.email}
                                            </div>
                                        </td>
                                        <td>{order.date}</td>
                                        <td style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                            {order.total.toLocaleString("uk-UA")} ₴
                                        </td>
                                        <td>
                                            <select
                                                key={order.orderStatus}
                                                defaultValue={order.orderStatus}
                                                aria-label={`Статус замовлення #${order.orderNumber}`}
                                                onChange={(e) =>
                                                    mutate.submit(
                                                        {
                                                            intent: "set_status",
                                                            id: order.id,
                                                            status: e.target.value,
                                                        },
                                                        { method: "post" },
                                                    )
                                                }
                                                style={pillSelectStyle(
                                                    ORDER_STATUS_COLORS[
                                                        order.orderStatus as keyof typeof ORDER_STATUS_COLORS
                                                    ] || "var(--text-secondary)",
                                                )}
                                            >
                                                {allowedNext(order.orderStatus).map((s) => (
                                                    <option
                                                        key={s}
                                                        value={s}
                                                        style={{ color: "#000" }}
                                                    >
                                                        {ORDER_STATUS_LABELS[s]}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                key={order.paymentStatus}
                                                defaultValue={order.paymentStatus}
                                                aria-label={`Оплата замовлення #${order.orderNumber}`}
                                                onChange={(e) =>
                                                    mutate.submit(
                                                        {
                                                            intent: "set_payment",
                                                            id: order.id,
                                                            paymentStatus: e.target.value,
                                                        },
                                                        { method: "post" },
                                                    )
                                                }
                                                style={pillSelectStyle(
                                                    PAYMENT_COLORS[
                                                        order.paymentStatus as keyof typeof PAYMENT_COLORS
                                                    ] || "var(--text-secondary)",
                                                )}
                                            >
                                                {PAYMENT_STATUSES.map((s) => (
                                                    <option
                                                        key={s}
                                                        value={s}
                                                        style={{ color: "#000" }}
                                                    >
                                                        {PAYMENT_LABELS[s]}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <Link
                                                to={`/admin/orders/${order.id}`}
                                                style={{
                                                    color: "var(--accent-primary)",
                                                    textDecoration: "none",
                                                    fontSize: "14px",
                                                }}
                                            >
                                                Деталі
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

            <BulkActionBar count={selectedIds.length} onClear={clear}>
                <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    aria-label="Новий статус для обраних замовлень"
                    style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "10px",
                        color: "var(--text-main)",
                        padding: "8px 12px",
                        fontSize: "14px",
                        cursor: "pointer",
                    }}
                >
                    <option value="" style={{ color: "#000" }}>
                        Новий статус…
                    </option>
                    {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s} style={{ color: "#000" }}>
                            {ORDER_STATUS_LABELS[s]}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={applyBulk}
                    disabled={mutating || !bulkStatus}
                    style={{
                        padding: "8px 18px",
                        borderRadius: "10px",
                        border: "none",
                        background: "var(--accent-primary)",
                        color: "#0f172a",
                        fontWeight: 700,
                        fontSize: "14px",
                        cursor: mutating || !bulkStatus ? "default" : "pointer",
                        opacity: mutating || !bulkStatus ? 0.5 : 1,
                    }}
                >
                    {mutating ? "Застосування…" : "Застосувати"}
                </button>
            </BulkActionBar>

            <ConfirmDialog
                open={confirmBulkCancel}
                title="Скасувати обрані замовлення?"
                body={
                    <>
                        Буде скасовано <strong>{selectedIds.length}</strong> замовлень, залишок за
                        кожним повернеться на склад. Замовлення, для яких скасування недопустиме,
                        будуть пропущені.
                    </>
                }
                confirmLabel="Скасувати замовлення"
                busy={mutating}
                onConfirm={() => {
                    setConfirmBulkCancel(false);
                    submitBulk("cancelled");
                }}
                onCancel={() => setConfirmBulkCancel(false)}
            />
        </>
    );
}
