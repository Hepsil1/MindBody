import { Link, useLoaderData, useFetcher, useNavigation } from "react-router";
import { AdminLinkButton } from "../../../components/admin/AdminButton";
import type { Route } from "./+types/index";
import { Prisma } from "@prisma/client";
import { useState, useEffect } from "react";
import { prisma } from "../../../db.server";
import { invalidateAll } from "../../../utils/cache.server";
import { actionOk, actionError, runAction } from "../../../utils/action-result.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { buildListQuery, paginate, type ListSpec } from "../../../utils/admin-list.server";
import { slugToLabel } from "../../../utils/categoryMap";
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

const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_STATUSES = ["active", "draft", "archived"];
const STATUS_LABELS: Record<string, string> = {
    active: "Активний",
    draft: "Чернетка",
    archived: "Архів",
};

const PRODUCT_LIST: ListSpec = {
    searchFields: ["name", "sku"],
    sortable: { createdAt: "createdAt", name: "name", price: "price", stock: "stock" },
    defaultSort: { field: "createdAt", dir: "desc" },
    filters: [{ param: "status", allowed: PRODUCT_STATUSES }, { param: "category" }],
    perPageDefault: 20,
};

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const formData = await request.formData();
    const intent = formData.get("intent");

    // NOTE: the former `delete_all` intent ran `orderItem.deleteMany({})` — an
    // empty filter that wiped EVERY order line-item in the system. Removed.
    // Deletion now never destroys order history (see delete_product below).

    if (intent === "delete_product") {
        const id = String(formData.get("id") || "");
        if (!id) return actionError("Не вказано товар");
        return runAction("products.delete", async () => {
            // A product that was ever ordered is archived (hidden from the
            // storefront, which filters on status === "active") instead of
            // deleted, so OrderItem history stays intact. Only products with no
            // order history are hard-deleted.
            const orderCount = await prisma.orderItem.count({ where: { productId: id } });
            if (orderCount > 0) {
                await prisma.product.update({ where: { id }, data: { status: "archived" } });
                invalidateAll();
                return actionOk(undefined, {
                    type: "info",
                    message: "Товар має історію замовлень — заархівовано замість видалення",
                });
            }
            await prisma.product.delete({ where: { id } });
            invalidateAll();
            return actionOk(undefined, { type: "success", message: "Товар видалено" });
        });
    }

    if (intent === "set_status") {
        const id = String(formData.get("id") || "");
        const status = String(formData.get("status") || "");
        if (!id || !PRODUCT_STATUSES.includes(status)) return actionError("Невірні дані");
        return runAction("products.setStatus", async () => {
            await prisma.product.update({ where: { id }, data: { status } });
            invalidateAll();
            return actionOk(undefined, {
                type: "success",
                message: `Статус: ${STATUS_LABELS[status]}`,
            });
        });
    }

    if (intent === "bulk_archive" || intent === "bulk_activate") {
        const ids = formData.getAll("ids").map(String).filter(Boolean);
        if (ids.length === 0) return actionError("Нічого не обрано");
        const status = intent === "bulk_archive" ? "archived" : "active";
        return runAction("products.bulk", async () => {
            const res = await prisma.product.updateMany({
                where: { id: { in: ids } },
                data: { status },
            });
            invalidateAll();
            return actionOk(undefined, {
                type: "success",
                message: `Оновлено товарів: ${res.count}`,
            });
        });
    }

    return null;
}

export async function loader({ request }: Route.LoaderArgs) {
    const { where, orderBy, skip, take, state } = buildListQuery<Prisma.ProductWhereInput>(
        request,
        PRODUCT_LIST,
    );

    const lowStock = new URL(request.url).searchParams.get("lowStock") === "1";
    const finalWhere: Prisma.ProductWhereInput = lowStock
        ? { AND: [where, { stock: { lte: LOW_STOCK_THRESHOLD } }] }
        : where;

    const [rows, total, cats] = await prisma.$transaction([
        prisma.product.findMany({ where: finalWhere, orderBy, skip, take }),
        prisma.product.count({ where: finalWhere }),
        prisma.product.findMany({
            where: { category: { not: null } },
            select: { category: true },
            distinct: ["category"],
            orderBy: { category: "asc" },
        }),
    ]);

    const products = rows.map((p) => ({
        ...p,
        price: Number(p.price),
        comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
    }));
    const categories = cats.map((c) => c.category).filter((c): c is string => Boolean(c));

    return {
        products,
        page: paginate(total, state.page, state.perPage),
        state,
        lowStock,
        categories,
    };
}

const parseInventory = (invString: string | null): Record<string, string> => {
    if (!invString) return {};
    try {
        const parsed = JSON.parse(invString);
        const result: Record<string, string> = {};
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                result[`${item.size || "—"}/${item.color || "—"}`] = String(item.stock || 0);
            }
            return result;
        }
        for (const [key, val] of Object.entries(parsed)) result[key] = String(val);
        return result;
    } catch {
        return {};
    }
};

const stockColor = (stock: number) =>
    stock <= 0 ? "#f87171" : stock <= LOW_STOCK_THRESHOLD ? "#fbbf24" : "var(--text-main)";

export default function AdminProducts() {
    const { products, page, state, lowStock, categories } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const mutate = useFetcher<typeof action>();
    useActionToast(mutate.data);

    const { selected, toggle, toggleAll, clear, allSelected, someSelected, selectedIds } =
        useRowSelection(products);
    // Clear selection whenever the visible result set changes (page/search/
    // sort/filter), so a bulk action can't hit page-1 rows the operator can no
    // longer see (client nav keeps this component mounted).
    useEffect(() => {
        clear();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.page, state.q, state.sort, state.dir, JSON.stringify(state.filters), lowStock]);
    const [activeStockId, setActiveStockId] = useState<string | null>(null);
    const [confirmProduct, setConfirmProduct] = useState<{ id: string; name: string } | null>(null);

    const isListLoading =
        navigation.state === "loading" && navigation.location?.pathname === "/admin/products";
    const mutating = mutate.state !== "idle";

    const changeStatus = (id: string, status: string) =>
        mutate.submit({ intent: "set_status", id, status }, { method: "post" });

    const runBulk = (intent: "bulk_archive" | "bulk_activate") => {
        const fd = new FormData();
        fd.set("intent", intent);
        selectedIds.forEach((id) => fd.append("ids", id));
        mutate.submit(fd, { method: "post" });
        clear(); // ids are already captured in fd; clear the bar optimistically
    };

    const hasFilters = Boolean(state.q) || Object.keys(state.filters).length > 0 || lowStock;

    const addButton = (
        <AdminLinkButton to="/admin/products/new" variant="primary">
            + Додати товар
        </AdminLinkButton>
    );

    return (
        <>
            <div className="admin-page-header">
                <h1>Товари</h1>
                <p>Каталог товарів</p>
            </div>

            <AdminToolbar right={addButton}>
                <SearchInput defaultValue={state.q} placeholder="Пошук за назвою або SKU…" />
                <FilterSelect
                    name="status"
                    value={state.filters.status ?? ""}
                    allLabel="Всі статуси"
                    options={PRODUCT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                />
                {categories.length > 0 && (
                    <FilterSelect
                        name="category"
                        value={state.filters.category ?? ""}
                        allLabel="Всі категорії"
                        options={categories.map((c) => ({ value: c, label: slugToLabel(c) }))}
                    />
                )}
                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: lowStock ? "#fbbf24" : "var(--text-secondary)",
                        fontSize: "14px",
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                >
                    <input
                        type="checkbox"
                        name="lowStock"
                        value="1"
                        defaultChecked={lowStock}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        style={{ cursor: "pointer" }}
                    />
                    Мало на складі
                </label>
            </AdminToolbar>

            {products.length === 0 ? (
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
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                        </svg>
                    }
                    title={hasFilters ? "Нічого не знайдено" : "Товарів немає"}
                    description={
                        hasFilters
                            ? "Спробуйте змінити пошук або фільтри."
                            : "Додайте перший товар, щоб почати."
                    }
                    action={
                        hasFilters ? (
                            <Link
                                to="/admin/products"
                                style={{ color: "var(--accent-primary)", textDecoration: "none" }}
                            >
                                Скинути фільтри
                            </Link>
                        ) : (
                            addButton
                        )
                    }
                />
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: "visible" }}>
                    <div
                        className="admin-table-container admin-table-container--products"
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
                                    <th style={{ width: 36 }}>
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = someSelected;
                                            }}
                                            onChange={toggleAll}
                                            aria-label="Обрати всі"
                                            style={{ cursor: "pointer" }}
                                        />
                                    </th>
                                    <SortableTh field="name" label="Товар" state={state} />
                                    <SortableTh field="price" label="Ціна" state={state} />
                                    <SortableTh field="stock" label="Залишок" state={state} />
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => {
                                    const isSelected = selected.has(product.id);
                                    let thumbSrc: string | null = null;
                                    try {
                                        const imgs = JSON.parse(product.images || "[]");
                                        if (imgs.length > 0) thumbSrc = imgs[0];
                                    } catch {
                                        /* ignore malformed images json */
                                    }
                                    return (
                                        <tr
                                            key={product.id}
                                            style={
                                                isSelected
                                                    ? { background: "rgba(94,234,212,0.06)" }
                                                    : undefined
                                            }
                                        >
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggle(product.id)}
                                                    aria-label={`Обрати ${product.name}`}
                                                    style={{ cursor: "pointer" }}
                                                />
                                            </td>
                                            <td>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "12px",
                                                    }}
                                                >
                                                    {thumbSrc ? (
                                                        <img
                                                            src={thumbSrc}
                                                            alt=""
                                                            style={{
                                                                width: "40px",
                                                                height: "40px",
                                                                borderRadius: "8px",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            style={{
                                                                width: "40px",
                                                                height: "40px",
                                                                borderRadius: "8px",
                                                                background:
                                                                    "rgba(255,255,255,0.05)",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                            }}
                                                        >
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="1.5"
                                                                width="20"
                                                                height="20"
                                                                style={{
                                                                    color: "var(--text-muted)",
                                                                }}
                                                            >
                                                                <rect
                                                                    x="3"
                                                                    y="3"
                                                                    width="18"
                                                                    height="18"
                                                                    rx="2"
                                                                />
                                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                                <path d="M21 15l-5-5L5 21" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div
                                                            style={{
                                                                color: "var(--text-main)",
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            {product.name}
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: "var(--text-muted)",
                                                                fontSize: "13px",
                                                            }}
                                                        >
                                                            {product.sku || "—"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td
                                                style={{
                                                    fontWeight: 500,
                                                    color: "var(--text-main)",
                                                }}
                                            >
                                                {isNaN(Number(product.price))
                                                    ? "—"
                                                    : `₴${Number(product.price).toLocaleString()}`}
                                            </td>
                                            <td style={{ position: "relative" }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setActiveStockId(
                                                            activeStockId === product.id
                                                                ? null
                                                                : product.id,
                                                        );
                                                    }}
                                                    style={{
                                                        background: "none",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        borderRadius: "6px",
                                                        padding: "4px 8px",
                                                        color: stockColor(product.stock || 0),
                                                        cursor: "pointer",
                                                        minWidth: "40px",
                                                        textAlign: "center",
                                                        fontSize: "14px",
                                                        fontWeight: 600,
                                                    }}
                                                    title="Залишок по варіантах"
                                                >
                                                    {product.stock || 0}
                                                </button>
                                                {activeStockId === product.id && (
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            top: "100%",
                                                            left: "50%",
                                                            transform: "translateX(-50%)",
                                                            marginTop: "8px",
                                                            background: "#1e293b",
                                                            border: "1px solid rgba(255,255,255,0.1)",
                                                            borderRadius: "8px",
                                                            padding: "12px",
                                                            zIndex: 50,
                                                            boxShadow:
                                                                "0 10px 15px -3px rgba(0,0,0,0.5)",
                                                            minWidth: "140px",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize: "11px",
                                                                fontWeight: 700,
                                                                color: "#94a3b8",
                                                                marginBottom: "8px",
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.05em",
                                                                borderBottom:
                                                                    "1px solid rgba(255,255,255,0.05)",
                                                                paddingBottom: "4px",
                                                            }}
                                                        >
                                                            Залишок по варіантах
                                                        </div>
                                                        {Object.keys(
                                                            parseInventory(product.inventory),
                                                        ).length > 0 ? (
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    gap: "6px",
                                                                }}
                                                            >
                                                                {Object.entries(
                                                                    parseInventory(
                                                                        product.inventory,
                                                                    ),
                                                                ).map(([key, val]) => (
                                                                    <div
                                                                        key={key}
                                                                        style={{
                                                                            display: "flex",
                                                                            justifyContent:
                                                                                "space-between",
                                                                            fontSize: "13px",
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                color: "#cbd5e1",
                                                                            }}
                                                                        >
                                                                            {key}
                                                                        </span>
                                                                        <span
                                                                            style={{
                                                                                fontWeight: 600,
                                                                                color: "#f1f5f9",
                                                                            }}
                                                                        >
                                                                            {String(val)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    fontSize: "13px",
                                                                    color: "#64748b",
                                                                    fontStyle: "italic",
                                                                }}
                                                            >
                                                                Варіанти не задані
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <select
                                                    key={product.status}
                                                    defaultValue={product.status}
                                                    onChange={(e) =>
                                                        changeStatus(product.id, e.target.value)
                                                    }
                                                    aria-label={`Статус ${product.name}`}
                                                    style={{
                                                        background: "rgba(255,255,255,0.04)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        borderRadius: "100px",
                                                        padding: "5px 10px",
                                                        fontSize: "13px",
                                                        fontWeight: 500,
                                                        color:
                                                            product.status === "active"
                                                                ? "#5eead4"
                                                                : "var(--text-secondary)",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    {PRODUCT_STATUSES.map((s) => (
                                                        <option
                                                            key={s}
                                                            value={s}
                                                            style={{ color: "#000" }}
                                                        >
                                                            {STATUS_LABELS[s]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "12px",
                                                        justifyContent: "flex-end",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <Link
                                                        to={`/admin/products/${product.id}`}
                                                        style={{
                                                            color: "var(--accent-primary)",
                                                            textDecoration: "none",
                                                            fontSize: "14px",
                                                        }}
                                                    >
                                                        Редагувати
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmProduct({
                                                                id: product.id,
                                                                name: product.name,
                                                            })
                                                        }
                                                        title="Видалити"
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            padding: 0,
                                                            cursor: "pointer",
                                                            color: "#ef4444",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            opacity: 0.7,
                                                        }}
                                                    >
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            width="18"
                                                            height="18"
                                                        >
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>
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

            <BulkActionBar count={selectedIds.length} onClear={clear}>
                <button
                    type="button"
                    onClick={() => runBulk("bulk_activate")}
                    disabled={mutating}
                    style={bulkBtn("#5eead4")}
                >
                    Активувати
                </button>
                <button
                    type="button"
                    onClick={() => runBulk("bulk_archive")}
                    disabled={mutating}
                    style={bulkBtn("#94a3b8")}
                >
                    Архівувати
                </button>
            </BulkActionBar>

            <ConfirmDialog
                open={confirmProduct !== null}
                title="Видалити товар?"
                body={
                    <>
                        {confirmProduct ? <strong>{confirmProduct.name}</strong> : null}. Якщо у
                        нього є історія замовлень — товар буде заархівовано (приховано з магазину),
                        а не видалено.
                    </>
                }
                confirmLabel="Видалити"
                busy={mutating}
                onConfirm={() => {
                    if (confirmProduct)
                        mutate.submit(
                            { intent: "delete_product", id: confirmProduct.id },
                            { method: "post" },
                        );
                    setConfirmProduct(null);
                }}
                onCancel={() => setConfirmProduct(null)}
            />
        </>
    );
}

const bulkBtn = (color: string): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: "9px",
    border: `1px solid ${color}55`,
    background: `${color}22`,
    color,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
});
