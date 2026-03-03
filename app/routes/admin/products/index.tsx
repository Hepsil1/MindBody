import { Link, useLoaderData, Form } from "react-router";
import type { Route } from "./+types/index";
import { prisma } from "../../../db.server";
import { useState } from "react";

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete_all") {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM Product`);
            return { success: true };
        } catch (e) {
            console.error("Failed to delete all products:", e);
            return { error: "Failed to delete products" };
        }
    }

    if (intent === "delete_product") {
        const id = formData.get("id");
        try {
            // Use raw SQL to avoid potential Prisma Client issues with the new schema if it's not regenerated
            await prisma.$executeRawUnsafe(`DELETE FROM Product WHERE id = ?`, String(id));
            return { success: true };
        } catch (e) {
            console.error("Failed to delete product:", e);
            return { error: "Failed to delete product" };
        }
    }
    return null;
}

export async function loader({ request }: Route.LoaderArgs) {
    const dbProducts = await prisma.product.findMany({
        orderBy: { createdAt: "desc" },
    });

    const products = dbProducts.map(p => ({
        ...p,
        price: Number(p.price),
        comparePrice: p.comparePrice ? Number(p.comparePrice) : null
    }));
    return { products };
}

export default function AdminProducts() {
    const { products } = useLoaderData<typeof loader>();
    const [activeStockId, setActiveStockId] = useState<string | null>(null);

    const toggleStock = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveStockId(activeStockId === id ? null : id);
    };

    // Close on click outside (simple version: click anywhere else closes it if we added a global listener, 
    // but for now we rely on explicit toggles or clicking another one)

    const parseInventory = (invString: string | null): Record<string, string> => {
        if (!invString) return {};
        try {
            const parsed = JSON.parse(invString);
            const result: Record<string, string> = {};

            // Handle ARRAY format: [{color, size, stock}, ...]
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const key = `${item.size || '—'}/${item.color || '—'}`;
                    result[key] = String(item.stock || 0);
                }
                return result;
            }

            // Fallback for object format
            for (const [key, val] of Object.entries(parsed)) {
                result[key] = String(val);
            }
            return result;
        } catch {
            return {};
        }
    };

    return (
        <>
            <div className="admin-page-header">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h1>Товари</h1>
                        <p>Каталог товарів</p>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <Form method="post" onSubmit={(e) => {
                            if (!confirm("Ви впевнені, що хочете видалити ВСІ товари? Цю дію неможливо відмінити.")) {
                                e.preventDefault();
                            }
                        }}>
                            <button
                                name="intent"
                                value="delete_all"
                                style={{
                                    background: "rgba(239, 68, 68, 0.1)",
                                    color: "#ef4444",
                                    padding: "12px 24px",
                                    borderRadius: "8px",
                                    fontWeight: "600",
                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                    fontSize: "14px",
                                    cursor: "pointer",
                                }}
                            >
                                Видалити все
                            </button>
                        </Form>
                        <Link
                            to="/admin/products/new"
                            style={{
                                background: "var(--accent-primary)",
                                color: "#0f172a",
                                padding: "12px 24px",
                                borderRadius: "8px",
                                fontWeight: "600",
                                textDecoration: "none",
                                fontSize: "14px",
                                display: "inline-block"
                            }}
                        >
                            + Додати товар
                        </Link>
                    </div>
                </div>
            </div>

            {products.length === 0 ? (
                <div className="admin-card" style={{ padding: "64px 32px", textAlign: "center" }}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        width="48"
                        height="48"
                        style={{ color: "var(--text-muted)", margin: "0 auto 16px" }}
                    >
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                    </svg>
                    <div style={{ color: "var(--text-main)", fontWeight: "600", marginBottom: "8px" }}>
                        Товарів немає
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                        Товари з'являться тут після синхронізації
                    </div>
                </div>
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: "visible" }}> {/* Visible overflow for popups */}
                    <div className="admin-table-container" style={{ border: "none", borderRadius: 0, overflow: "visible" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Товар</th>
                                    <th>Ціна</th>
                                    <th>Залишок</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.id}>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div
                                                    style={{
                                                        width: "40px",
                                                        height: "40px",
                                                        borderRadius: "8px",
                                                        background: "rgba(255,255,255,0.05)",
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
                                                        style={{ color: "var(--text-muted)" }}
                                                    >
                                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                                        <path d="M21 15l-5-5L5 21" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div style={{ color: "var(--text-main)", fontWeight: "500" }}>
                                                        {product.name}
                                                    </div>
                                                    <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                                        {product.sku || "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: "500", color: "var(--text-main)" }}>
                                            {isNaN(Number(product.price)) ? "—" : `₴${Number(product.price).toLocaleString()}`}
                                        </td>
                                        <td style={{ position: 'relative' }}>
                                            <button
                                                onClick={(e) => toggleStock(product.id, e)}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '6px',
                                                    padding: '4px 8px',
                                                    color: 'var(--text-main)',
                                                    cursor: 'pointer',
                                                    minWidth: '40px',
                                                    textAlign: 'center',
                                                    transition: 'all 0.2s',
                                                    fontSize: '14px'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
                                                onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                            >
                                                {product.stock || 0}
                                            </button>

                                            {/* Stock Breakdown Popover */}
                                            {activeStockId === product.id && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    marginTop: '8px',
                                                    background: '#1e293b',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    padding: '12px',
                                                    zIndex: 50,
                                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                                    minWidth: '140px'
                                                }}>
                                                    <div style={{
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        color: '#94a3b8',
                                                        marginBottom: '8px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                        paddingBottom: '4px'
                                                    }}>
                                                        Залишок по варіантах
                                                    </div>

                                                    {Object.keys(parseInventory(product.inventory)).length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {Object.entries(parseInventory(product.inventory)).map(([key, val]) => (
                                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                                                    <span style={{ color: '#cbd5e1' }}>{key}</span>
                                                                    <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{String(val)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                                                            Варіанти не задані
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className={`admin-badge ${product.status === "active"
                                                    ? "admin-badge--success"
                                                    : product.status === "draft"
                                                        ? "admin-badge--neutral"
                                                        : "admin-badge--neutral"
                                                    }`}
                                            >
                                                {product.status === "active"
                                                    ? "Активний"
                                                    : product.status === "draft"
                                                        ? "Чернетка"
                                                        : product.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
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
                                                <Form method="post" onSubmit={(e) => {
                                                    if (!confirm("Ви впевнені, що хочете видалити цей товар?")) {
                                                        e.preventDefault();
                                                    }
                                                }}>
                                                    <input type="hidden" name="id" value={product.id} />
                                                    <button
                                                        name="intent"
                                                        value="delete_product"
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            padding: 0,
                                                            cursor: 'pointer',
                                                            color: '#ef4444',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            opacity: 0.7
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                        onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                                                        title="Видалити"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                        </svg>
                                                    </button>
                                                </Form>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
