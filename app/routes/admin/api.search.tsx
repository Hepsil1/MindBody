import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../../db.server";
import { requireAdmin } from "../../utils/admin-guard.server";

export interface AdminSearchHit {
    /** Route to navigate to. */
    to: string;
    label: string;
    sub: string;
}
export interface AdminSearchResults {
    orders: AdminSearchHit[];
    products: AdminSearchHit[];
    customers: AdminSearchHit[];
}

/**
 * Cmd+K palette backend: one query string → top hits across orders (by №,
 * customer name/email), products (name/slug/sku) and customers (name/email).
 * Resource route OUTSIDE the admin layout so it returns bare JSON.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const q = (new URL(request.url).searchParams.get("q") || "").trim();
    if (q.length < 2) {
        return Response.json({ orders: [], products: [], customers: [] });
    }
    const contains = { contains: q, mode: "insensitive" as const };

    const [orders, products, customers] = await Promise.all([
        prisma.order.findMany({
            where: {
                OR: [
                    ...(/^\d+$/.test(q) ? [{ orderNumber: parseInt(q, 10) }] : []),
                    { customer: { firstName: contains } },
                    { customer: { lastName: contains } },
                    { customer: { email: contains } },
                ],
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                orderNumber: true,
                total: true,
                status: true,
                customer: { select: { firstName: true, lastName: true } },
            },
        }),
        prisma.product.findMany({
            where: { OR: [{ name: contains }, { slug: contains }, { sku: contains }] },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, name: true, sku: true, status: true },
        }),
        prisma.customer.findMany({
            where: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, firstName: true, lastName: true, email: true },
        }),
    ]);

    const results: AdminSearchResults = {
        orders: orders.map((o) => ({
            to: `/admin/orders/${o.id}`,
            label: `#${o.orderNumber} · ${Number(o.total).toLocaleString("uk-UA")} ₴`,
            sub: `${o.customer ? `${o.customer.firstName} ${o.customer.lastName}`.trim() : "—"} · ${o.status}`,
        })),
        products: products.map((p) => ({
            to: `/admin/products/${p.id}`,
            label: p.name,
            sub: [p.sku, p.status].filter(Boolean).join(" · "),
        })),
        customers: customers.map((c) => ({
            to: `/admin/customers/${c.id}`,
            label: `${c.firstName} ${c.lastName}`.trim() || c.email,
            sub: c.email,
        })),
    };
    return Response.json(results);
}
