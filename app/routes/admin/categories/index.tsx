import { useLoaderData, useFetcher } from "react-router";
import type { Route } from "./+types/index";
import { useEffect, useState } from "react";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { actionOk, actionError, runAction } from "../../../utils/action-result.server";
import { uploadFileChecked } from "../../../utils/upload.server";
import { invalidateCache } from "../../../utils/cache.server";
import { ConfirmDialog } from "../../../components/admin/ConfirmDialog";
import { useActionToast } from "../../../components/admin/useActionToast";

// `moodType` lives on a column the un-regenerated Prisma client doesn't know
// (added without `prisma generate`, same as the P0 columns), so every Category
// read/write here goes through raw SQL — matching admin/slides.tsx + home.tsx.
const ALLOWED_MOODS = ["yoga", "sport", "dance", "casual", "kids"];
const MOOD_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "— Без теми —" },
    { value: "yoga", label: "Yoga" },
    { value: "sport", label: "Sport" },
    { value: "dance", label: "Dance" },
    { value: "casual", label: "Casual" },
    { value: "kids", label: "Kids" },
];

interface CategoryRow {
    id: string;
    title: string;
    subtitle: string | null;
    image: string;
    imagePos: string;
    link: string;
    buttonText: string;
    moodType: string | null;
    order: number;
}

export async function loader() {
    const rows = await prisma.$queryRaw<CategoryRow[]>`
        SELECT id, title, subtitle, image, "imagePos", link, "buttonText", "moodType", "order"
        FROM "Category" ORDER BY "order" ASC, "createdAt" ASC`;
    return { categories: rows.map((c) => ({ ...c, order: Number(c.order) })) };
}

export async function action({ request }: Route.ActionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "reorder") {
        const id = String(formData.get("id") || "");
        const direction = String(formData.get("direction") || "");
        return runAction("categories.reorder", async () => {
            const rows = await prisma.$queryRaw<{ id: string }[]>`
                SELECT id FROM "Category" ORDER BY "order" ASC, "createdAt" ASC`;
            const ids = rows.map((r) => r.id);
            const idx = ids.indexOf(id);
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            if (idx < 0 || swapIdx < 0 || swapIdx >= ids.length)
                return actionOk(undefined, { type: "info", message: "Межа списку" });
            [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
            // Normalize order to 0..n-1 with the swap applied (robust even if the
            // existing order values are duplicated / all zero from the seed).
            await prisma.$transaction(
                ids.map(
                    (cid, i) =>
                        prisma.$executeRaw`UPDATE "Category" SET "order" = ${i}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${cid}`,
                ),
            );
            invalidateCache("home:categories");
            return actionOk(undefined, { type: "success", message: "Порядок оновлено" });
        });
    }

    if (intent === "delete") {
        const id = String(formData.get("id") || "");
        if (!id) return actionError("Не вказано категорію");
        return runAction("categories.delete", async () => {
            await prisma.$executeRaw`DELETE FROM "Category" WHERE id = ${id}`;
            invalidateCache("home:categories");
            return actionOk(undefined, { type: "success", message: "Категорію видалено" });
        });
    }

    if (intent === "create" || intent === "update") {
        const title = ((formData.get("title") as string) || "").trim();
        const link = ((formData.get("link") as string) || "").trim();
        if (!title || !link) return actionError("Заповніть назву та посилання");
        const subtitle = ((formData.get("subtitle") as string) || "").trim() || null;
        const buttonText =
            ((formData.get("buttonText") as string) || "").trim() || "Переглянути все";
        const imagePos = ((formData.get("imagePos") as string) || "").trim() || "center center";
        const moodRaw = ((formData.get("moodType") as string) || "").trim();
        const moodType = ALLOWED_MOODS.includes(moodRaw) ? moodRaw : null;

        // New file → upload (hardened: rejects non-raster/SVG); else keep current.
        const upload = await uploadFileChecked(formData.get("imageFile"));
        if (upload.status === "error") return actionError(upload.reason);
        const image =
            upload.status === "ok"
                ? upload.path
                : ((formData.get("currentImage") as string) || "").trim();

        if (intent === "create") {
            if (!image) return actionError("Завантажте зображення категорії");
            return runAction("categories.create", async () => {
                const maxRow = await prisma.$queryRaw<{ max: number | null }[]>`
                    SELECT MAX("order") AS max FROM "Category"`;
                const nextOrder = (Number(maxRow[0]?.max) || 0) + 1;
                await prisma.$executeRaw`
                    INSERT INTO "Category"
                        (id, title, subtitle, image, "imagePos", link, "buttonText", "moodType", "order", "createdAt", "updatedAt")
                    VALUES
                        (gen_random_uuid(), ${title}, ${subtitle}, ${image}, ${imagePos}, ${link},
                         ${buttonText}, ${moodType}, ${nextOrder}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
                invalidateCache("home:categories");
                return actionOk(undefined, {
                    type: "success",
                    message: `Категорію «${title}» створено`,
                });
            });
        }

        const id = String(formData.get("id") || "");
        if (!id) return actionError("Не вказано категорію");
        if (!image) return actionError("Зображення обов'язкове");
        return runAction("categories.update", async () => {
            await prisma.$executeRaw`
                UPDATE "Category"
                SET title = ${title}, subtitle = ${subtitle}, image = ${image}, "imagePos" = ${imagePos},
                    link = ${link}, "buttonText" = ${buttonText}, "moodType" = ${moodType},
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = ${id}`;
            invalidateCache("home:categories");
            return actionOk(undefined, { type: "success", message: "Категорію оновлено" });
        });
    }

    return null;
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "var(--text-main)",
    fontSize: "14px",
    boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: "6px",
};

function CategoryFields({ c }: { c?: CategoryRow }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "14px",
            }}
        >
            <div>
                <label style={labelStyle}>Назва *</label>
                <input name="title" defaultValue={c?.title ?? ""} required style={inputStyle} />
            </div>
            <div>
                <label style={labelStyle}>Підзаголовок</label>
                <input name="subtitle" defaultValue={c?.subtitle ?? ""} style={inputStyle} />
            </div>
            <div>
                <label style={labelStyle}>Посилання *</label>
                <input
                    name="link"
                    defaultValue={c?.link ?? ""}
                    placeholder="/shop/yoga"
                    required
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>Текст кнопки</label>
                <input
                    name="buttonText"
                    defaultValue={c?.buttonText ?? "Переглянути все"}
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>Тема (mood)</label>
                <select name="moodType" defaultValue={c?.moodType ?? ""} style={inputStyle}>
                    {MOOD_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value} style={{ color: "#000" }}>
                            {m.label}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label style={labelStyle}>Позиція фото</label>
                <input
                    name="imagePos"
                    defaultValue={c?.imagePos ?? "center center"}
                    placeholder="center center"
                    style={inputStyle}
                />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                    Зображення {c ? "(залиште порожнім, щоб не змінювати)" : "*"}
                </label>
                <input name="imageFile" type="file" accept="image/*" style={inputStyle} />
                <input type="hidden" name="currentImage" value={c?.image ?? ""} />
            </div>
        </div>
    );
}

const btn = (bg: string, color: string): React.CSSProperties => ({
    background: bg,
    color,
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
});

export default function AdminCategories() {
    const { categories } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();
    useActionToast(fetcher.data);

    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);
    const busy = fetcher.state !== "idle";

    // Close forms once a mutation succeeds.
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
            setShowCreate(false);
            setEditId(null);
        }
    }, [fetcher.state, fetcher.data]);

    const reorder = (id: string, direction: "up" | "down") =>
        fetcher.submit({ intent: "reorder", id, direction }, { method: "post" });

    return (
        <>
            <div
                className="admin-page-header"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
                <div>
                    <h1>Категорії головної</h1>
                    <p>Картки колекцій на головній сторінці</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setShowCreate((v) => !v);
                        setEditId(null);
                    }}
                    style={btn(
                        showCreate ? "transparent" : "var(--accent-primary)",
                        showCreate ? "var(--text-secondary)" : "#0f172a",
                    )}
                >
                    {showCreate ? "Закрити" : "+ Додати категорію"}
                </button>
            </div>

            {showCreate && (
                <fetcher.Form
                    method="post"
                    encType="multipart/form-data"
                    className="admin-card"
                    style={{ padding: "24px", marginBottom: "24px" }}
                >
                    <input type="hidden" name="intent" value="create" />
                    <h3 style={{ margin: "0 0 16px", color: "var(--text-main)" }}>
                        Нова категорія
                    </h3>
                    <CategoryFields />
                    <div style={{ marginTop: "16px" }}>
                        <button
                            type="submit"
                            disabled={busy}
                            style={btn("var(--accent-primary)", "#0f172a")}
                        >
                            {busy ? "Збереження…" : "Створити"}
                        </button>
                    </div>
                </fetcher.Form>
            )}

            {categories.length === 0 ? (
                <div
                    className="admin-card"
                    style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}
                >
                    Категорій ще немає. Додайте першу.
                </div>
            ) : (
                <div style={{ display: "grid", gap: "16px" }}>
                    {categories.map((c, i) => (
                        <div key={c.id} className="admin-card" style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                                <img
                                    src={c.image || "/brand-sun.png"}
                                    alt=""
                                    style={{
                                        width: "84px",
                                        height: "60px",
                                        borderRadius: "8px",
                                        objectFit: "cover",
                                        objectPosition: c.imagePos || "center",
                                        flexShrink: 0,
                                        background: "rgba(255,255,255,0.05)",
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: "var(--text-main)", fontWeight: 600 }}>
                                        {c.title}
                                        {c.moodType && (
                                            <span
                                                style={{
                                                    marginLeft: "10px",
                                                    fontSize: "11px",
                                                    color: "#5eead4",
                                                    background: "rgba(94,234,212,0.12)",
                                                    padding: "2px 8px",
                                                    borderRadius: "100px",
                                                }}
                                            >
                                                {c.moodType}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                        {c.subtitle ? `${c.subtitle} · ` : ""}
                                        {c.link}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <button
                                        type="button"
                                        title="Вгору"
                                        disabled={i === 0 || busy}
                                        onClick={() => reorder(c.id, "up")}
                                        style={btn("rgba(255,255,255,0.06)", "var(--text-main)")}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        title="Вниз"
                                        disabled={i === categories.length - 1 || busy}
                                        onClick={() => reorder(c.id, "down")}
                                        style={btn("rgba(255,255,255,0.06)", "var(--text-main)")}
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditId(editId === c.id ? null : c.id);
                                            setShowCreate(false);
                                        }}
                                        style={btn("rgba(94,234,212,0.12)", "#5eead4")}
                                    >
                                        {editId === c.id ? "Закрити" : "Редагувати"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDel({ id: c.id, title: c.title })}
                                        style={btn("rgba(239,68,68,0.12)", "#ef4444")}
                                    >
                                        Видалити
                                    </button>
                                </div>
                            </div>

                            {editId === c.id && (
                                <fetcher.Form
                                    method="post"
                                    encType="multipart/form-data"
                                    style={{
                                        marginTop: "16px",
                                        paddingTop: "16px",
                                        borderTop: "1px solid var(--border-subtle)",
                                    }}
                                >
                                    <input type="hidden" name="intent" value="update" />
                                    <input type="hidden" name="id" value={c.id} />
                                    <CategoryFields c={c} />
                                    <div style={{ marginTop: "16px" }}>
                                        <button
                                            type="submit"
                                            disabled={busy}
                                            style={btn("var(--accent-primary)", "#0f172a")}
                                        >
                                            {busy ? "Збереження…" : "Зберегти"}
                                        </button>
                                    </div>
                                </fetcher.Form>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={confirmDel !== null}
                title="Видалити категорію?"
                body={
                    <>
                        Категорію <strong>{confirmDel?.title}</strong> буде видалено з головної
                        сторінки.
                    </>
                }
                busy={busy}
                onConfirm={() => {
                    if (confirmDel)
                        fetcher.submit({ intent: "delete", id: confirmDel.id }, { method: "post" });
                    setConfirmDel(null);
                }}
                onCancel={() => setConfirmDel(null)}
            />
        </>
    );
}
