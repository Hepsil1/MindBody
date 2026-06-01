import { useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/reviews";
import type { Prisma } from "@prisma/client";
import { useState } from "react";
import { prisma } from "../../db.server";
import { requireAdmin } from "../../utils/admin-guard.server";
import { actionOk, actionError, runAction } from "../../utils/action-result.server";
import { buildListQuery, paginate, type ListSpec } from "../../utils/admin-list.server";
import {
    AdminToolbar,
    SearchInput,
    FilterSelect,
    AdminPagination,
    BulkActionBar,
    EmptyState,
    useRowSelection,
} from "../../components/admin/list";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { useActionToast } from "../../components/admin/useActionToast";

const REVIEW_LIST: ListSpec = {
    searchFields: ["authorName", "text"],
    sortable: { createdAt: "createdAt", rating: "rating" },
    defaultSort: { field: "createdAt", dir: "desc" },
    filters: [
        { param: "approved", field: "isApproved", kind: "boolean", allowed: ["true", "false"] },
    ],
    perPageDefault: 20,
};

export async function loader({ request }: Route.LoaderArgs) {
    const { where, orderBy, skip, take, state } = buildListQuery<Prisma.ReviewWhereInput>(
        request,
        REVIEW_LIST,
    );
    const [reviews, total] = await prisma.$transaction([
        prisma.review.findMany({ where, orderBy, skip, take }),
        prisma.review.count({ where }),
    ]);

    const productIds = Array.from(new Set(reviews.map((r) => r.productId)));
    const productMap: Record<string, string> = {};
    if (productIds.length > 0) {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
        });
        products.forEach((p) => {
            productMap[p.id] = p.name;
        });
    }

    return { reviews, productMap, page: paginate(total, state.page, state.perPage), state };
}

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "bulk_approve") {
        const ids = formData.getAll("ids").map(String).filter(Boolean);
        if (ids.length === 0) return actionError("Нічого не обрано");
        return runAction("reviews.bulkApprove", async () => {
            const res = await prisma.review.updateMany({
                where: { id: { in: ids } },
                data: { isApproved: true },
            });
            return actionOk(undefined, {
                type: "success",
                message: `Схвалено відгуків: ${res.count}`,
            });
        });
    }

    const id = formData.get("id") as string;
    if (!id) return actionError("Не вказано відгук");

    if (intent === "approve" || intent === "reject") {
        return runAction("reviews.moderate", async () => {
            await prisma.review.update({
                where: { id },
                data: { isApproved: intent === "approve" },
            });
            return actionOk(undefined, {
                type: "success",
                message: intent === "approve" ? "Відгук схвалено" : "Відгук приховано",
            });
        });
    }

    if (intent === "delete") {
        return runAction("reviews.delete", async () => {
            await prisma.review.delete({ where: { id } });
            return actionOk(undefined, { type: "success", message: "Відгук видалено" });
        });
    }

    return null;
}

export default function AdminReviews() {
    const { reviews, productMap, page, state } = useLoaderData<typeof loader>();
    const mutate = useFetcher<typeof action>();
    useActionToast(mutate.data);

    const { selected, toggle, clear, selectedIds } = useRowSelection(reviews);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const runBulkApprove = () => {
        const fd = new FormData();
        fd.set("intent", "bulk_approve");
        selectedIds.forEach((id) => fd.append("ids", id));
        mutate.submit(fd, { method: "post" });
        clear();
    };

    const hasFilters = Boolean(state.q) || Object.keys(state.filters).length > 0;

    return (
        <>
            <div className="admin-page-header">
                <h1>Відгуки</h1>
                <p>Модерація відгуків клієнтів</p>
            </div>

            <AdminToolbar>
                <SearchInput defaultValue={state.q} placeholder="Пошук за автором або текстом…" />
                <FilterSelect
                    name="approved"
                    value={state.filters.approved ?? ""}
                    allLabel="Всі відгуки"
                    options={[
                        { value: "false", label: "На модерації" },
                        { value: "true", label: "Схвалені" },
                    ]}
                />
            </AdminToolbar>

            {reviews.length === 0 ? (
                <EmptyState
                    title={hasFilters ? "Нічого не знайдено" : "Відгуків ще немає"}
                    description={
                        hasFilters
                            ? "Спробуйте змінити пошук або фільтр."
                            : "Відгуки з'являться після того, як клієнти їх залишать."
                    }
                />
            ) : (
                <div style={{ display: "grid", gap: "16px" }}>
                    {reviews.map((r) => {
                        const isSelected = selected.has(r.id);
                        return (
                            <div
                                key={r.id}
                                className="admin-card"
                                style={{
                                    padding: "20px 24px",
                                    border: r.isApproved
                                        ? "1px solid var(--border-subtle)"
                                        : "1px solid rgba(245,158,11,0.35)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: "16px",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "12px",
                                            alignItems: "center",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggle(r.id)}
                                            aria-label={`Обрати відгук ${r.authorName}`}
                                            style={{ cursor: "pointer" }}
                                        />
                                        <div>
                                            <div
                                                style={{
                                                    color: "var(--text-main)",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {r.authorName}
                                                {!r.isApproved && (
                                                    <span
                                                        style={{
                                                            marginLeft: "10px",
                                                            fontSize: "11px",
                                                            color: "#f59e0b",
                                                            background: "rgba(245,158,11,0.12)",
                                                            padding: "2px 8px",
                                                            borderRadius: "100px",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        На модерації
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: "var(--text-muted)",
                                                    marginTop: "2px",
                                                }}
                                            >
                                                {productMap[r.productId] || r.productId}
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{ color: "#f59e0b", whiteSpace: "nowrap" }}>
                                        {"★".repeat(r.rating)}
                                        {"☆".repeat(Math.max(0, 5 - r.rating))}
                                    </span>
                                </div>

                                <p
                                    style={{
                                        margin: "12px 0 16px",
                                        color: "var(--text-secondary)",
                                        fontSize: "14px",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    {r.text}
                                </p>

                                <div style={{ display: "flex", gap: "8px" }}>
                                    {!r.isApproved ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                mutate.submit(
                                                    { intent: "approve", id: r.id },
                                                    { method: "post" },
                                                )
                                            }
                                            style={moderateBtn("#10b981")}
                                        >
                                            Схвалити
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                mutate.submit(
                                                    { intent: "reject", id: r.id },
                                                    { method: "post" },
                                                )
                                            }
                                            style={moderateBtn("#f59e0b")}
                                        >
                                            Сховати
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setConfirmId(r.id)}
                                        style={moderateBtn("#ef4444")}
                                    >
                                        Видалити
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    <AdminPagination page={page} />
                </div>
            )}

            <BulkActionBar count={selectedIds.length} onClear={clear}>
                <button
                    type="button"
                    onClick={runBulkApprove}
                    disabled={mutate.state !== "idle"}
                    style={moderateBtn("#10b981")}
                >
                    Схвалити обрані
                </button>
            </BulkActionBar>

            <ConfirmDialog
                open={confirmId !== null}
                title="Видалити відгук?"
                body="Цю дію не можна відмінити."
                busy={mutate.state !== "idle"}
                onConfirm={() => {
                    if (confirmId)
                        mutate.submit({ intent: "delete", id: confirmId }, { method: "post" });
                    setConfirmId(null);
                }}
                onCancel={() => setConfirmId(null)}
            />
        </>
    );
}

const moderateBtn = (color: string): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: "8px",
    border: `1px solid ${color}55`,
    background: `${color}1f`,
    color,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
});
