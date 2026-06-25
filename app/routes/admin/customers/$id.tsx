import {
    useLoaderData,
    useNavigate,
    useNavigation,
    useActionData,
    useSubmit,
    Form,
    redirect,
} from "react-router";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { useState, useEffect } from "react";
import { actionOk, actionError as actionErr } from "../../../utils/action-result.server";
import { ConfirmDialog } from "../../../components/admin/ConfirmDialog";

interface LoaderArgs {
    request: Request;
    params: { id: string };
}

interface ActionArgs {
    request: Request;
    params: { id: string };
}

export async function loader({ request, params }: LoaderArgs) {
    // Defense-in-depth: this loader returns full customer PII + order history, so
    // guard it directly rather than relying solely on the parent _layout loader.
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const customer = await prisma.customer.findUnique({
        where: { id: params.id },
        include: {
            orders: {
                include: {
                    items: {
                        include: { product: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!customer) {
        throw new Response("Customer not found", { status: 404 });
    }

    // Normalize Prisma Decimal money fields to plain numbers — the single-fetch
    // serializer turns Decimal instances into plain objects and Number(<object>)
    // is NaN (same bug as the order page's "Разом до сплати: NaN ₴").
    return {
        customer: {
            ...customer,
            orders: customer.orders.map((order) => ({
                ...order,
                total: Number(order.total),
                items: order.items.map((item) => ({
                    ...item,
                    price: Number(item.price),
                    product: item.product
                        ? { ...item.product, price: Number(item.product.price) }
                        : item.product,
                })),
            })),
        },
    };
}

export async function action({ request, params }: ActionArgs) {
    // requireAdmin adds the same-origin (CSRF) check — this action hard-deletes
    // the customer and cascades their orders, so it must reject cross-origin POSTs.
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "delete") {
        try {
            // Never destroy order/revenue history. If the customer has ANY
            // orders, anonymize the PII and keep every row (order, orderItem)
            // intact — only a customer with zero orders is hard-deleted.
            const orderCount = await prisma.order.count({
                where: { customerId: params.id },
            });

            if (orderCount > 0) {
                // Anonymize: null/replace the PII but keep the customer row so
                // the orders stay attributed and reportable. email/passwordHash
                // are @unique → use an id-scoped sentinel email + null hash to
                // avoid a P2002 collision.
                await prisma.customer.update({
                    where: { id: params.id },
                    data: {
                        firstName: "Видалений",
                        lastName: "клієнт",
                        email: `deleted+${params.id}@local`,
                        phone: null,
                        avatar: null,
                        passwordHash: null,
                    },
                });
            } else {
                // No orders → nothing to preserve; hard-delete the record.
                await prisma.customer.delete({ where: { id: params.id } });
            }

            return redirect("/admin/customers");
        } catch (error) {
            console.error("Delete error:", error);
            return actionErr("Помилка при видаленні клієнта");
        }
    }

    if (intent === "update") {
        const firstName = ((formData.get("firstName") as string) || "").trim();
        const lastName = ((formData.get("lastName") as string) || "").trim();
        const email = ((formData.get("email") as string) || "").trim().toLowerCase();
        const phone = ((formData.get("phone") as string) || "").trim();
        // NOTE: newPassword update isn't wired up yet — the form posts the
        // field but the action ignores it. When implementing, bcrypt-hash it
        // and add to updateData under `passwordHash`.

        // Validate before writing — empty fields used to silently overwrite the
        // record with "".
        if (!firstName) return actionErr("Вкажіть ім'я клієнта");
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return actionErr("Вкажіть коректний email");

        const updateData: Prisma.CustomerUpdateInput = {
            firstName,
            lastName,
            email,
            phone: phone || null,
        };

        try {
            await prisma.customer.update({
                where: { id: params.id },
                data: updateData,
            });
        } catch (error) {
            // email is @unique — a duplicate throws P2002. Surface it instead of
            // a raw 500 that discards the operator's edits.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                return actionErr("Email вже використовується іншим клієнтом");
            }
            console.error("Customer update error:", error);
            return actionErr("Не вдалося оновити дані клієнта");
        }

        return actionOk(undefined, { type: "success", message: "Дані оновлено" });
    }

    return actionErr("Невідома дія");
}

export default function CustomerDetail() {
    const { customer } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const submit = useSubmit();
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDelete = () => {
        const formData = new FormData();
        formData.append("intent", "delete");
        submit(formData, { method: "post" });
    };

    // Surface the edit action's result (e.g. a duplicate-email rejection that
    // would otherwise fail silently). sonner is imported lazily per the gotcha.
    useEffect(() => {
        if (!actionData) return;
        if ("error" in actionData && actionData.error) {
            const msg = actionData.error;
            void import("sonner").then(({ toast }) => toast.error(msg));
        } else if ("ok" in actionData && actionData.ok) {
            const msg = actionData.toast?.message ?? "Збережено";
            void import("sonner").then(({ toast }) => toast.success(msg));
            setIsEditing(false);
        }
    }, [actionData]);

    const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total), 0);

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: "#f59e0b",
            processing: "#3b82f6",
            shipped: "#8b5cf6",
            delivered: "#10b981",
            cancelled: "#ef4444",
        };
        return colors[status] || "#6b7280";
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: "Очікує",
            processing: "Обробляється",
            shipped: "Відправлено",
            delivered: "Доставлено",
            cancelled: "Скасовано",
        };
        return labels[status] || status;
    };

    return (
        <>
            {/* Header */}
            <div
                className="admin-page-header"
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                }}
            >
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
                            fontSize: "14px",
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Назад до клієнтів
                    </button>
                    <h1>
                        {customer.firstName} {customer.lastName}
                    </h1>
                    <p>{customer.email}</p>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="admin-btn admin-btn--secondary"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {isEditing ? "Скасувати" : "Редагувати"}
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="admin-btn admin-btn--danger"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Видалити
                    </button>
                </div>
            </div>

            {/* Stats — icon tiles (shared dashboard style). */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                    marginBottom: "24px",
                }}
            >
                <div className="dash-tile" style={{ cursor: "default" }}>
                    <div
                        className="dash-tile__icon"
                        style={{ background: "rgba(94,234,212,0.16)", color: "#5eead4" }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                        </svg>
                    </div>
                    <div>
                        <div className="dash-tile__value">{customer.orders.length}</div>
                        <div className="dash-tile__label">Замовлень</div>
                    </div>
                </div>
                <div className="dash-tile" style={{ cursor: "default" }}>
                    <div
                        className="dash-tile__icon"
                        style={{ background: "rgba(167,139,250,0.16)", color: "#a78bfa" }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    </div>
                    <div>
                        <div className="dash-tile__value">
                            {totalSpent.toLocaleString("uk-UA")} ₴
                        </div>
                        <div className="dash-tile__label">Витрачено</div>
                    </div>
                </div>
                <div className="dash-tile" style={{ cursor: "default" }}>
                    <div
                        className="dash-tile__icon"
                        style={{ background: "rgba(96,165,250,0.16)", color: "#60a5fa" }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                    </div>
                    <div>
                        <div className="dash-tile__value" style={{ fontSize: "18px" }}>
                            {new Date(customer.createdAt).toLocaleDateString("uk-UA")}
                        </div>
                        <div className="dash-tile__label">Зареєстровано</div>
                    </div>
                </div>
            </div>

            {/* Edit Form */}
            {isEditing && (
                <div className="admin-card" style={{ marginBottom: "24px" }}>
                    <h3 style={{ marginBottom: "20px", color: "var(--text-main)" }}>
                        Редагування клієнта
                    </h3>
                    <Form method="post">
                        <input type="hidden" name="intent" value="update" />
                        <div
                            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
                        >
                            <div className="admin-field">
                                <label htmlFor="cust-firstName" className="admin-label">
                                    Ім'я
                                </label>
                                <input
                                    id="cust-firstName"
                                    type="text"
                                    name="firstName"
                                    defaultValue={customer.firstName}
                                    className="admin-input"
                                />
                            </div>
                            <div className="admin-field">
                                <label htmlFor="cust-lastName" className="admin-label">
                                    Прізвище
                                </label>
                                <input
                                    id="cust-lastName"
                                    type="text"
                                    name="lastName"
                                    defaultValue={customer.lastName}
                                    className="admin-input"
                                />
                            </div>
                            <div className="admin-field">
                                <label htmlFor="cust-email" className="admin-label">
                                    Email
                                </label>
                                <input
                                    id="cust-email"
                                    type="email"
                                    name="email"
                                    defaultValue={customer.email}
                                    className="admin-input"
                                />
                            </div>
                            <div className="admin-field">
                                <label htmlFor="cust-phone" className="admin-label">
                                    Телефон
                                </label>
                                <input
                                    id="cust-phone"
                                    type="tel"
                                    name="phone"
                                    defaultValue={customer.phone || ""}
                                    placeholder="+380..."
                                    className="admin-input"
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                            <button type="submit" className="admin-btn admin-btn--primary">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                    <polyline points="17,21 17,13 7,13 7,21" />
                                    <polyline points="7,3 7,8 15,8" />
                                </svg>
                                Зберегти зміни
                            </button>
                        </div>
                    </Form>
                </div>
            )}

            {/* Orders */}
            <div className="admin-card">
                <h3 style={{ marginBottom: "20px", color: "var(--text-main)" }}>
                    Історія замовлень
                </h3>
                {customer.orders.length === 0 ? (
                    <div
                        style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}
                    >
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            style={{ margin: "0 auto 16px", opacity: 0.5 }}
                        >
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <p>Клієнт ще не робив замовлень</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {customer.orders.map((order) => (
                            <div
                                key={order.id}
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "12px",
                                    padding: "20px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <div>
                                        <span
                                            style={{ color: "var(--text-main)", fontWeight: "600" }}
                                        >
                                            Замовлення #{order.orderNumber}
                                        </span>
                                        <span
                                            style={{
                                                color: "var(--text-muted)",
                                                marginLeft: "12px",
                                                fontSize: "13px",
                                            }}
                                        >
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
                                            fontWeight: "500",
                                        }}
                                    >
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>
                                <div
                                    style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                                >
                                    {order.items.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "8px 0",
                                                borderBottom: "1px solid var(--border-subtle)",
                                            }}
                                        >
                                            <span style={{ color: "var(--text-main)" }}>
                                                {item.product.name} × {item.quantity}
                                            </span>
                                            <span style={{ color: "var(--text-muted)" }}>
                                                ₴{Number(item.price).toLocaleString("uk-UA")}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: "12px", textAlign: "right" }}>
                                    <span
                                        style={{
                                            color: "var(--text-main)",
                                            fontWeight: "600",
                                            fontSize: "16px",
                                        }}
                                    >
                                        Разом: ₴{Number(order.total).toLocaleString("uk-UA")}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation — branded, accessible ConfirmDialog (was a
                bespoke inline modal with no focus trap / Escape / aria). Copy
                no longer promises to wipe orders: customers with order history
                are anonymized server-side, not destroyed. */}
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Видалити клієнта?"
                body={
                    <>
                        Видалити клієнта{" "}
                        <strong style={{ color: "#f8fafc" }}>
                            {customer.firstName} {customer.lastName}
                        </strong>
                        ?{" "}
                        {customer.orders.length > 0
                            ? "У клієнта є замовлення — його дані буде знеособлено, а історія замовлень збережеться."
                            : "Запис буде остаточно видалено. Цю дію неможливо скасувати."}
                    </>
                }
                confirmLabel="Видалити"
                cancelLabel="Скасувати"
                tone="danger"
                busy={navigation.state !== "idle"}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    handleDelete();
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    );
}
