import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigate, redirect } from "react-router";
import { prisma } from "../../db.server";
import { isAuthenticated } from "../../utils/admin.server";
import { useState } from "react";

export async function loader() {
    const promos = await prisma.$queryRawUnsafe(
        `SELECT * FROM "PromoCode" ORDER BY "createdAt" DESC`
    ) as any[];
    return { promos };
}

export async function action({ request }: ActionFunctionArgs) {
    if (!(await isAuthenticated(request))) {
        return redirect("/admin/login");
    }
    try {
        const formData = await request.formData();
        const intent = formData.get("intent");

        if (intent === "create") {
            const code = (formData.get("code") as string)?.trim().toUpperCase();
            const discountType = formData.get("discountType") as string || "percent";
            const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
            const minOrder = parseFloat(formData.get("minOrder") as string) || 0;
            const maxUses = formData.get("maxUses") ? parseInt(formData.get("maxUses") as string) : null;
            const expiresAt = formData.get("expiresAt") as string || null;
            const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            if (!code || discountValue <= 0) {
                return { error: "Заповніть обов'язкові поля" };
            }

            try {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "PromoCode" (id, code, "discountType", "discountValue", "minOrder", "maxUses", "usedCount", "isActive", "expiresAt", "createdAt")
                     VALUES ($1, $2, $3, $4, $5, $6, 0, true, $7, CURRENT_TIMESTAMP)`,
                    id, code, discountType, discountValue, minOrder, maxUses, expiresAt ? new Date(expiresAt).toISOString() : null
                );
            } catch (e: any) {
                if (e.message?.includes('UNIQUE')) {
                    return { error: "Промокод з таким кодом вже існує" };
                }
                return { error: "Помилка створення" };
            }
        }

        if (intent === "toggle") {
            const id = formData.get("id") as string;
            const currentActive = formData.get("isActive") === "true";
            await prisma.$executeRawUnsafe(
                `UPDATE "PromoCode" SET "isActive" = $1 WHERE id = $2`,
                !currentActive, id
            );
        }

        if (intent === "delete") {
            const id = formData.get("id") as string;
            await prisma.$executeRawUnsafe(
                `DELETE FROM "PromoCode" WHERE id = $1`, id
            );
        }

        return null;
    } catch (e: any) {
        console.error("Promo action error:", e);
        return { error: e.message || "Сталася серверна помилка" };
    }
}

export default function AdminPromo() {
    const { promos } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const [showForm, setShowForm] = useState(false);
    const [formError, setFormError] = useState("");

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.append("intent", "create");
        submit(fd, { method: "post" });
        setShowForm(false);
    };

    const handleToggle = (id: string, isActive: boolean) => {
        const fd = new FormData();
        fd.append("intent", "toggle");
        fd.append("id", id);
        fd.append("isActive", String(isActive));
        submit(fd, { method: "post" });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Видалити промокод?")) return;
        const fd = new FormData();
        fd.append("intent", "delete");
        fd.append("id", id);
        submit(fd, { method: "post" });
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#e2e8f0' }}>
            <style>{`
                .promo-card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 20px;
                }
                .promo-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .promo-header h1 {
                    font-size: 28px;
                    font-weight: 700;
                    color: #f8fafc;
                    margin: 0;
                }
                .btn-create {
                    background: linear-gradient(135deg, #5eead4, #2dd4bf);
                    color: #0f172a;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn-create:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(94, 234, 212, 0.3);
                }
                .promo-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .promo-table th {
                    text-align: left;
                    padding: 12px 16px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #94a3b8;
                    border-bottom: 1px solid #334155;
                }
                .promo-table td {
                    padding: 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    font-size: 14px;
                }
                .promo-code {
                    font-family: 'JetBrains Mono', monospace;
                    font-weight: 700;
                    font-size: 16px;
                    color: #5eead4;
                    background: rgba(94, 234, 212, 0.1);
                    padding: 4px 12px;
                    border-radius: 6px;
                }
                .badge-active {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .badge-active.on { background: rgba(16,185,129,0.15); color: #10b981; }
                .badge-active.off { background: rgba(239,68,68,0.15); color: #ef4444; }
                .btn-sm {
                    padding: 6px 14px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    border: 1px solid #334155;
                    background: transparent;
                    color: #e2e8f0;
                    transition: all 0.2s;
                }
                .btn-sm:hover { border-color: #5eead4; color: #5eead4; }
                .btn-sm.danger:hover { border-color: #ef4444; color: #ef4444; }
                .create-form {
                    background: #1e293b;
                    border: 1px solid #5eead4;
                    border-radius: 12px;
                    padding: 32px;
                    margin-bottom: 24px;
                }
                .create-form h3 {
                    font-size: 18px;
                    margin: 0 0 24px 0;
                    color: #f8fafc;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                }
                .form-group label {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #94a3b8;
                    margin-bottom: 6px;
                }
                .form-group input, .form-group select {
                    width: 100%;
                    padding: 10px 14px;
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    color: #e2e8f0;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .form-group input:focus, .form-group select:focus {
                    outline: none;
                    border-color: #5eead4;
                }
                .form-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                }
                .btn-submit {
                    background: linear-gradient(135deg, #5eead4, #2dd4bf);
                    color: #0f172a;
                    border: none;
                    padding: 12px 32px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                }
                .btn-cancel {
                    background: transparent;
                    border: 1px solid #334155;
                    color: #94a3b8;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                }
                .stat-value {
                    font-size: 13px;
                    color: #94a3b8;
                }
            `}</style>

            <div className="promo-header">
                <h1>🏷️ Промокоди</h1>
                <button className="btn-create" onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ Закрити' : '+ Створити промокод'}
                </button>
            </div>

            {showForm && (
                <form className="create-form" onSubmit={handleCreate}>
                    <h3>Новий промокод</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Код *</label>
                            <input name="code" placeholder="ЗИМА25" required style={{ textTransform: 'uppercase' }} />
                        </div>
                        <div className="form-group">
                            <label>Тип знижки</label>
                            <select name="discountType">
                                <option value="percent">Відсотки (%)</option>
                                <option value="fixed">Фіксована сума (₴)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Значення знижки *</label>
                            <input name="discountValue" type="number" step="0.01" min="0.01" placeholder="10" required />
                        </div>
                        <div className="form-group">
                            <label>Мін. замовлення (₴)</label>
                            <input name="minOrder" type="number" step="1" min="0" placeholder="0" defaultValue="0" />
                        </div>
                        <div className="form-group">
                            <label>Макс. використань</label>
                            <input name="maxUses" type="number" min="1" placeholder="Без обмежень" />
                        </div>
                        <div className="form-group">
                            <label>Дійсний до</label>
                            <input name="expiresAt" type="date" />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn-submit">Створити</button>
                        <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Скасувати</button>
                    </div>
                </form>
            )}

            <div className="promo-card">
                {promos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏷️</div>
                        <p style={{ fontSize: '16px', marginBottom: '8px' }}>Промокодів ще немає</p>
                        <p style={{ fontSize: '13px' }}>Створіть перший промокод для своїх клієнтів</p>
                    </div>
                ) : (
                    <table className="promo-table">
                        <thead>
                            <tr>
                                <th>Код</th>
                                <th>Знижка</th>
                                <th>Мін. замовлення</th>
                                <th>Використань</th>
                                <th>Статус</th>
                                <th>Термін дії</th>
                                <th>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promos.map((p: any) => {
                                const isExpired = p.expiresAt && new Date(p.expiresAt) < new Date();
                                const isExhausted = p.maxUses && p.usedCount >= p.maxUses;
                                const isEffectivelyActive = p.isActive && !isExpired && !isExhausted;

                                return (
                                    <tr key={p.id}>
                                        <td>
                                            <span className="promo-code">{p.code}</span>
                                        </td>
                                        <td>
                                            <strong style={{ color: '#f8fafc' }}>
                                                {p.discountType === 'percent' ? `${p.discountValue}%` : `${p.discountValue} ₴`}
                                            </strong>
                                        </td>
                                        <td>
                                            <span className="stat-value">
                                                {p.minOrder > 0 ? `від ${p.minOrder} ₴` : '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="stat-value">
                                                {p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge-active ${isEffectivelyActive ? 'on' : 'off'}`}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
                                                {isExpired ? 'Протермін.' : isExhausted ? 'Вичерпано' : p.isActive ? 'Активний' : 'Неактивний'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="stat-value">
                                                {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('uk-UA') : '∞'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className="btn-sm"
                                                    onClick={() => handleToggle(p.id, p.isActive)}
                                                >
                                                    {p.isActive ? '⏸ Вимкнути' : '▶ Увімкнути'}
                                                </button>
                                                <button
                                                    className="btn-sm danger"
                                                    onClick={() => handleDelete(p.id)}
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
                )}
            </div>
        </div>
    );
}
