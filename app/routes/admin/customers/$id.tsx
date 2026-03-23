import { useLoaderData, useNavigate, Form, redirect } from "react-router";
import { prisma } from "../../../db.server";
import { isAuthenticated } from "../../../utils/admin.server";
import { useState } from "react";

interface LoaderArgs {
    params: { id: string };
}

interface ActionArgs {
    request: Request;
    params: { id: string };
}

export async function loader({ params }: LoaderArgs) {
    const customer = await prisma.customer.findUnique({
        where: { id: params.id },
        include: {
            orders: {
                include: {
                    items: {
                        include: { product: true }
                    }
                },
                orderBy: { createdAt: "desc" }
            }
        }
    });

    if (!customer) {
        throw new Response("Customer not found", { status: 404 });
    }

    return { customer };
}

export async function action({ request, params }: ActionArgs) {
    if (!(await isAuthenticated(request))) {
        return redirect("/admin/login");
    }
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete") {
        try {
            // First, get all order IDs for this customer
            const orders = await prisma.order.findMany({
                where: { customerId: params.id },
                select: { id: true }
            });

            const orderIds = orders.map(o => o.id);

            // Delete all order items first
            if (orderIds.length > 0) {
                await prisma.orderItem.deleteMany({
                    where: { orderId: { in: orderIds } }
                });
            }

            // Then delete all orders
            await prisma.order.deleteMany({
                where: { customerId: params.id }
            });

            // Finally delete the customer
            await prisma.customer.delete({
                where: { id: params.id }
            });

            return redirect("/admin/customers");
        } catch (error) {
            console.error("Delete error:", error);
            return { error: "Помилка при видаленні клієнта" };
        }
    }

    if (intent === "update") {
        const firstName = formData.get("firstName") as string;
        const lastName = formData.get("lastName") as string;
        const email = formData.get("email") as string;
        const phone = formData.get("phone") as string;
        const newPassword = formData.get("newPassword") as string;

        const updateData: any = {
            firstName,
            lastName,
            email,
            phone: phone || null
        };

        // If new password provided, hash it
        if (newPassword && newPassword.trim()) {
            // Simple hash for demo - in production use bcrypt
            let hash = 0;
            for (let i = 0; i < newPassword.length; i++) {
                const char = newPassword.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            updateData.passwordHash = hash.toString();
        }

        await prisma.customer.update({
            where: { id: params.id },
            data: updateData
        });

        return { success: true, message: newPassword ? "Дані та пароль оновлено!" : "Дані оновлено!" };
    }

    if (intent === "generate-password") {
        // Generate random password
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Hash it
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        await prisma.customer.update({
            where: { id: params.id },
            data: { passwordHash: hash.toString() }
        });

        return { success: true, generatedPassword: password, message: `Новий пароль: ${password}` };
    }

    return null;
}

export default function CustomerDetail() {
    const { customer } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total), 0);

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: "#f59e0b",
            processing: "#3b82f6",
            shipped: "#8b5cf6",
            delivered: "#10b981",
            cancelled: "#ef4444"
        };
        return colors[status] || "#6b7280";
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: "Очікує",
            processing: "Обробляється",
            shipped: "Відправлено",
            delivered: "Доставлено",
            cancelled: "Скасовано"
        };
        return labels[status] || status;
    };

    return (
        <>
            {/* Header */}
            <div className="admin-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <button
                        onClick={() => navigate("/admin/customers")}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent-primary)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "12px",
                            fontSize: "14px"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Назад до клієнтів
                    </button>
                    <h1>{customer.firstName} {customer.lastName}</h1>
                    <p>{customer.email}</p>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        style={{
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-main)",
                            padding: "10px 20px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {isEditing ? "Скасувати" : "Редагувати"}
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#ef4444",
                            padding: "10px 20px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Видалити
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="admin-stats">
                <div className="admin-stat">
                    <div className="admin-stat__label">Замовлень</div>
                    <div className="admin-stat__value">{customer.orders.length}</div>
                </div>
                <div className="admin-stat">
                    <div className="admin-stat__label">Витрачено</div>
                    <div className="admin-stat__value">₴{totalSpent.toLocaleString()}</div>
                </div>
                <div className="admin-stat">
                    <div className="admin-stat__label">Зареєстровано</div>
                    <div className="admin-stat__value" style={{ fontSize: "18px" }}>
                        {new Date(customer.createdAt).toLocaleDateString("uk-UA")}
                    </div>
                </div>
            </div>

            {/* Edit Form */}
            {isEditing && (
                <div className="admin-card" style={{ marginBottom: "24px" }}>
                    <h3 style={{ marginBottom: "20px", color: "var(--text-main)" }}>Редагування клієнта</h3>
                    <Form method="post">
                        <input type="hidden" name="intent" value="update" />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "6px", color: "var(--text-muted)", fontSize: "13px" }}>Ім'я</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    defaultValue={customer.firstName}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-main)",
                                        fontSize: "14px"
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "6px", color: "var(--text-muted)", fontSize: "13px" }}>Прізвище</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    defaultValue={customer.lastName}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-main)",
                                        fontSize: "14px"
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "6px", color: "var(--text-muted)", fontSize: "13px" }}>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    defaultValue={customer.email}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-main)",
                                        fontSize: "14px"
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "6px", color: "var(--text-muted)", fontSize: "13px" }}>Телефон</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    defaultValue={customer.phone || ""}
                                    placeholder="+380..."
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-main)",
                                        fontSize: "14px"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password Section */}
                        <div style={{
                            marginTop: "24px",
                            paddingTop: "24px",
                            borderTop: "1px solid var(--border-subtle)"
                        }}>
                            <h4 style={{ color: "var(--text-main)", marginBottom: "16px", fontSize: "14px", fontWeight: "600" }}>
                                🔐 Управління паролем
                            </h4>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "6px", color: "var(--text-muted)", fontSize: "13px" }}>
                                        Поточний хеш пароля
                                    </label>
                                    <div style={{
                                        padding: "12px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-muted)",
                                        fontSize: "13px",
                                        fontFamily: "monospace"
                                    }}>
                                        {(customer as any).passwordHash ? `••••••••` : "Не встановлено"}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "6px", color: "var(--text-muted)", fontSize: "13px" }}>
                                        Новий пароль (залиште пустим щоб не змінювати)
                                    </label>
                                    <input
                                        type="text"
                                        name="newPassword"
                                        placeholder="Введіть новий пароль..."
                                        style={{
                                            width: "100%",
                                            padding: "12px",
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid var(--border-subtle)",
                                            borderRadius: "8px",
                                            color: "var(--text-main)",
                                            fontSize: "14px"
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                            <button
                                type="submit"
                                style={{
                                    background: "var(--accent-primary)",
                                    color: "#0f172a",
                                    border: "none",
                                    padding: "12px 24px",
                                    borderRadius: "8px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px"
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                    <polyline points="17,21 17,13 7,13 7,21" />
                                    <polyline points="7,3 7,8 15,8" />
                                </svg>
                                Зберегти зміни
                            </button>
                        </div>
                    </Form>

                    {/* Generate Password Button - Separate form */}
                    <Form method="post" style={{ marginTop: "16px" }}>
                        <input type="hidden" name="intent" value="generate-password" />
                        <button
                            type="submit"
                            style={{
                                background: "rgba(139, 92, 246, 0.2)",
                                border: "1px solid rgba(139, 92, 246, 0.3)",
                                color: "#a78bfa",
                                padding: "10px 20px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                            </svg>
                            Згенерувати новий пароль автоматично
                        </button>
                    </Form>
                </div>
            )}


            {/* Orders */}
            <div className="admin-card">
                <h3 style={{ marginBottom: "20px", color: "var(--text-main)" }}>Історія замовлень</h3>
                {customer.orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 16px", opacity: 0.5 }}>
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <p>Клієнт ще не робив замовлень</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {customer.orders.map(order => (
                            <div
                                key={order.id}
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "12px",
                                    padding: "20px"
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <div>
                                        <span style={{ color: "var(--text-main)", fontWeight: "600" }}>
                                            Замовлення #{order.orderNumber}
                                        </span>
                                        <span style={{ color: "var(--text-muted)", marginLeft: "12px", fontSize: "13px" }}>
                                            {new Date(order.createdAt).toLocaleDateString("uk-UA")}
                                        </span>
                                    </div>
                                    <span
                                        style={{
                                            background: getStatusColor(order.status),
                                            color: "#fff",
                                            padding: "4px 12px",
                                            borderRadius: "20px",
                                            fontSize: "12px",
                                            fontWeight: "500"
                                        }}
                                    >
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {order.items.map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "8px 0",
                                                borderBottom: "1px solid var(--border-subtle)"
                                            }}
                                        >
                                            <span style={{ color: "var(--text-main)" }}>
                                                {item.product.name} × {item.quantity}
                                            </span>
                                            <span style={{ color: "var(--text-muted)" }}>
                                                ₴{Number(item.price).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: "12px", textAlign: "right" }}>
                                    <span style={{ color: "var(--text-main)", fontWeight: "600", fontSize: "16px" }}>
                                        Разом: ₴{Number(order.total).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        style={{
                            background: "#1e293b",
                            borderRadius: "16px",
                            padding: "32px",
                            maxWidth: "400px",
                            width: "90%"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ color: "#ef4444", marginBottom: "16px" }}>Видалити клієнта?</h3>
                        <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                            Ви впевнені, що хочете видалити клієнта <strong style={{ color: "var(--text-main)" }}>{customer.firstName} {customer.lastName}</strong>?
                            Це також видалить всі його замовлення. Цю дію неможливо скасувати.
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    background: "rgba(255,255,255,0.1)",
                                    border: "none",
                                    color: "var(--text-main)",
                                    padding: "10px 20px",
                                    borderRadius: "8px",
                                    cursor: "pointer"
                                }}
                            >
                                Скасувати
                            </button>
                            <Form method="post">
                                <input type="hidden" name="intent" value="delete" />
                                <button
                                    type="submit"
                                    style={{
                                        background: "#ef4444",
                                        border: "none",
                                        color: "#fff",
                                        padding: "10px 20px",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontWeight: "600"
                                    }}
                                >
                                    Видалити
                                </button>
                            </Form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
