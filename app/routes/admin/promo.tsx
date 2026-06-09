import { useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/promo";
import type { Prisma } from "@prisma/client";
import { useEffect, useState } from "react";
import { prisma } from "../../db.server";
import { requireAdmin } from "../../utils/admin-guard.server";
import { actionOk, actionError, runAction } from "../../utils/action-result.server";
import { buildListQuery, paginate, type ListSpec } from "../../utils/admin-list.server";
import {
    AdminToolbar,
    SearchInput,
    FilterSelect,
    SortableTh,
    AdminPagination,
    EmptyState,
} from "../../components/admin/list";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { useActionToast } from "../../components/admin/useActionToast";

const PROMO_LIST: ListSpec = {
    searchFields: ["code"],
    sortable: { createdAt: "createdAt", code: "code", usedCount: "usedCount" },
    defaultSort: { field: "createdAt", dir: "desc" },
    filters: [{ param: "active", field: "isActive", kind: "boolean", allowed: ["true", "false"] }],
    perPageDefault: 20,
};

export async function loader({ request }: Route.LoaderArgs) {
    const { where, orderBy, skip, take, state } = buildListQuery<Prisma.PromoCodeWhereInput>(
        request,
        PROMO_LIST,
    );
    const [promos, total] = await prisma.$transaction([
        prisma.promoCode.findMany({ where, orderBy, skip, take }),
        prisma.promoCode.count({ where }),
    ]);
    return { promos, page: paginate(total, state.page, state.perPage), state };
}

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const code = (formData.get("code") as string)?.trim().toUpperCase();
        // Whitelist the discount type — anything other than "fixed" is a percent.
        const discountType =
            (formData.get("discountType") as string) === "fixed" ? "fixed" : "percent";
        const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
        const minOrder = parseFloat(formData.get("minOrder") as string) || 0;
        const maxUses = formData.get("maxUses")
            ? parseInt(formData.get("maxUses") as string)
            : null;
        const expiresAt = (formData.get("expiresAt") as string) || null;
        if (!code) return actionError("Заповніть код", { fieldErrors: { code: "Обов'язкове" } });
        if (!(discountValue > 0))
            return actionError("Значення знижки має бути більше 0", {
                fieldErrors: { discountValue: "Більше 0" },
            });
        // Clamp percent discounts to 100% — without this a percent=200 code makes
        // the order total negative at checkout (the anti-fraud guard passes
        // because client and server use the same formula).
        if (discountType === "percent" && discountValue > 100)
            return actionError("Відсоткова знижка не може перевищувати 100%", {
                fieldErrors: { discountValue: "Максимум 100%" },
            });
        return runAction("promo.create", async () => {
            await prisma.promoCode.create({
                data: {
                    code,
                    discountType,
                    discountValue,
                    minOrder,
                    maxUses,
                    usedCount: 0,
                    isActive: true,
                    // Store inclusive end-of-day so a code stays valid through its
                    // last day — a bare YYYY-MM-DD parses to UTC midnight (~03:00
                    // Kyiv), which would expire the code mid-way through that day.
                    expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999`) : null,
                },
            });
            return actionOk(undefined, { type: "success", message: `Промокод ${code} створено` });
        });
    }

    if (intent === "toggle") {
        const id = formData.get("id") as string;
        const currentActive = formData.get("isActive") === "true";
        return runAction("promo.toggle", async () => {
            await prisma.promoCode.update({ where: { id }, data: { isActive: !currentActive } });
            return actionOk(undefined, {
                type: "success",
                message: !currentActive ? "Промокод увімкнено" : "Промокод вимкнено",
            });
        });
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        return runAction("promo.delete", async () => {
            await prisma.promoCode.delete({ where: { id } });
            return actionOk(undefined, { type: "success", message: "Промокод видалено" });
        });
    }

    return null;
}

export default function AdminPromo() {
    const { promos, page, state } = useLoaderData<typeof loader>();
    const createFetcher = useFetcher<typeof action>();
    const mutate = useFetcher<typeof action>();
    useActionToast(createFetcher.data);
    useActionToast(mutate.data);

    const [showForm, setShowForm] = useState(false);
    const [confirmPromo, setConfirmPromo] = useState<{ id: string; code: string } | null>(null);

    // Close the create form once a create succeeds (errors keep it open).
    useEffect(() => {
        if (
            createFetcher.state === "idle" &&
            createFetcher.data &&
            "ok" in createFetcher.data &&
            createFetcher.data.ok
        )
            setShowForm(false);
    }, [createFetcher.state, createFetcher.data]);

    const createError =
        createFetcher.data && "ok" in createFetcher.data && !createFetcher.data.ok
            ? createFetcher.data.error
            : null;

    return (
        <>
            <style>{`
                .promo-code { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 15px; color: #5eead4; background: rgba(94,234,212,0.1); padding: 4px 12px; border-radius: 6px; }
                .promo-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; }
                .promo-badge.on { background: rgba(16,185,129,0.15); color: #10b981; }
                .promo-badge.off { background: rgba(239,68,68,0.15); color: #ef4444; }
                .promo-badge.warn { background: rgba(245,158,11,0.15); color: #f59e0b; }
                .promo-btn-sm { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #e2e8f0; transition: all 0.2s; }
                .promo-btn-sm:hover { border-color: #5eead4; color: #5eead4; }
                .promo-btn-sm.danger:hover { border-color: #ef4444; color: #ef4444; }
                .promo-form { background: var(--bg-card); border: 1px solid rgba(94,234,212,0.4); border-radius: 16px; padding: 28px; margin-bottom: 24px; }
                .promo-form h3 { font-size: 18px; margin: 0 0 20px; color: var(--text-main); }
                .promo-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; }
                .promo-form label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 6px; }
                .promo-form input, .promo-form select { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-main); font-size: 14px; box-sizing: border-box; }
                .promo-form input:focus, .promo-form select:focus { outline: none; border-color: #5eead4; }
            `}</style>

            <div className="admin-page-header">
                <h1>Промокоди</h1>
                <p>Знижки та акційні коди</p>
            </div>

            <AdminToolbar
                right={
                    <button
                        type="button"
                        onClick={() => setShowForm((v) => !v)}
                        style={{
                            background: showForm ? "transparent" : "var(--accent-primary)",
                            color: showForm ? "var(--text-secondary)" : "#0f172a",
                            border: showForm ? "1px solid rgba(255,255,255,0.12)" : "none",
                            padding: "10px 20px",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "14px",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {showForm ? "Закрити" : "+ Створити промокод"}
                    </button>
                }
            >
                <SearchInput defaultValue={state.q} placeholder="Пошук за кодом…" />
                <FilterSelect
                    name="active"
                    value={state.filters.active ?? ""}
                    allLabel="Всі"
                    options={[
                        { value: "true", label: "Активні" },
                        { value: "false", label: "Вимкнені" },
                    ]}
                />
            </AdminToolbar>

            {showForm && (
                <createFetcher.Form method="post" className="promo-form">
                    <h3>Новий промокод</h3>
                    <input type="hidden" name="intent" value="create" />
                    <div className="promo-form-grid">
                        <div>
                            <label>Код *</label>
                            <input
                                name="code"
                                placeholder="ЗИМА25"
                                required
                                style={{ textTransform: "uppercase" }}
                            />
                        </div>
                        <div>
                            <label>Тип знижки</label>
                            <select name="discountType">
                                <option value="percent">Відсотки (%)</option>
                                <option value="fixed">Фіксована сума (₴)</option>
                            </select>
                        </div>
                        <div>
                            <label>Значення *</label>
                            <input
                                name="discountValue"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="10"
                                required
                            />
                        </div>
                        <div>
                            <label>Мін. замовлення (₴)</label>
                            <input
                                name="minOrder"
                                type="number"
                                step="1"
                                min="0"
                                defaultValue="0"
                            />
                        </div>
                        <div>
                            <label>Макс. використань</label>
                            <input
                                name="maxUses"
                                type="number"
                                min="1"
                                placeholder="Без обмежень"
                            />
                        </div>
                        <div>
                            <label>Дійсний до</label>
                            <input name="expiresAt" type="date" />
                        </div>
                    </div>
                    {createError && (
                        <div style={{ color: "#fca5a5", fontSize: "13px", marginTop: "12px" }}>
                            {createError}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                        <button
                            type="submit"
                            disabled={createFetcher.state !== "idle"}
                            style={{
                                background: "var(--accent-primary)",
                                color: "#0f172a",
                                border: "none",
                                padding: "11px 28px",
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "14px",
                                cursor: "pointer",
                            }}
                        >
                            {createFetcher.state !== "idle" ? "Створення…" : "Створити"}
                        </button>
                    </div>
                </createFetcher.Form>
            )}

            {promos.length === 0 ? (
                <EmptyState
                    title={
                        state.q || Object.keys(state.filters).length > 0
                            ? "Нічого не знайдено"
                            : "Промокодів ще немає"
                    }
                    description={
                        state.q || Object.keys(state.filters).length > 0
                            ? "Спробуйте змінити пошук або фільтр."
                            : "Створіть перший промокод для своїх клієнтів."
                    }
                />
            ) : (
                <div className="admin-card" style={{ padding: 0 }}>
                    <div
                        className="admin-table-container"
                        style={{ border: "none", borderRadius: 0 }}
                    >
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <SortableTh field="code" label="Код" state={state} />
                                    <th>Знижка</th>
                                    <th>Мін.</th>
                                    <SortableTh
                                        field="usedCount"
                                        label="Використань"
                                        state={state}
                                    />
                                    <th>Статус</th>
                                    <th>Термін</th>
                                    <th style={{ textAlign: "right" }}>Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                {promos.map((p) => {
                                    const isExpired =
                                        p.expiresAt && new Date(p.expiresAt) < new Date();
                                    const isExhausted =
                                        p.maxUses !== null && p.usedCount >= p.maxUses;
                                    const cls =
                                        isExpired || isExhausted
                                            ? "warn"
                                            : p.isActive
                                              ? "on"
                                              : "off";
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <span className="promo-code">{p.code}</span>
                                            </td>
                                            <td
                                                style={{
                                                    color: "var(--text-main)",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {p.discountType === "percent"
                                                    ? `${p.discountValue}%`
                                                    : `${p.discountValue} ₴`}
                                            </td>
                                            <td style={{ color: "var(--text-muted)" }}>
                                                {p.minOrder > 0 ? `${p.minOrder} ₴` : "—"}
                                            </td>
                                            <td style={{ color: "var(--text-muted)" }}>
                                                {p.usedCount}
                                                {p.maxUses ? ` / ${p.maxUses}` : ""}
                                            </td>
                                            <td>
                                                <span className={`promo-badge ${cls}`}>
                                                    <span
                                                        style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: "50%",
                                                            background: "currentColor",
                                                        }}
                                                    />
                                                    {isExpired
                                                        ? "Протермін."
                                                        : isExhausted
                                                          ? "Вичерпано"
                                                          : p.isActive
                                                            ? "Активний"
                                                            : "Вимкнений"}
                                                </span>
                                            </td>
                                            <td style={{ color: "var(--text-muted)" }}>
                                                {p.expiresAt
                                                    ? new Date(p.expiresAt).toLocaleDateString(
                                                          "uk-UA",
                                                      )
                                                    : "∞"}
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "8px",
                                                        justifyContent: "flex-end",
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        className="promo-btn-sm"
                                                        onClick={() =>
                                                            mutate.submit(
                                                                {
                                                                    intent: "toggle",
                                                                    id: p.id,
                                                                    isActive: String(p.isActive),
                                                                },
                                                                { method: "post" },
                                                            )
                                                        }
                                                    >
                                                        {p.isActive ? "Вимкнути" : "Увімкнути"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="promo-btn-sm danger"
                                                        onClick={() =>
                                                            setConfirmPromo({
                                                                id: p.id,
                                                                code: p.code,
                                                            })
                                                        }
                                                    >
                                                        🗑
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

            <ConfirmDialog
                open={confirmPromo !== null}
                title="Видалити промокод?"
                body={
                    <>
                        Промокод <strong>{confirmPromo?.code}</strong> буде видалено назавжди.
                    </>
                }
                busy={mutate.state !== "idle"}
                onConfirm={() => {
                    if (confirmPromo)
                        mutate.submit(
                            { intent: "delete", id: confirmPromo.id },
                            { method: "post" },
                        );
                    setConfirmPromo(null);
                }}
                onCancel={() => setConfirmPromo(null)}
            />
        </>
    );
}
