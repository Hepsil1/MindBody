// Resource route (no component) — streams a CSV of customers respecting the
// current search/sort. Lives outside the admin _layout so it returns a raw CSV
// Response instead of being wrapped in the layout HTML. Does its own auth.
import type { Route } from "./+types/export";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.server";
import { requireAdmin } from "../../../utils/admin-guard.server";
import { buildListQuery } from "../../../utils/admin-list.server";

const csvCell = (v: string) => {
    // Neutralize spreadsheet formula injection: a cell starting with = + - @
    // (or tab/CR) is executed as a formula by Excel/Sheets. Customer-controlled
    // names/emails — and every UA phone (starts with "+") — hit this. Prefix
    // such cells with an apostrophe so they're treated as text.
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function loader({ request }: Route.LoaderArgs) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { where, orderBy } = buildListQuery<Prisma.CustomerWhereInput>(request, {
        searchFields: ["firstName", "lastName", "email"],
        sortable: { createdAt: "createdAt", firstName: "firstName", email: "email" },
        defaultSort: { field: "createdAt", dir: "desc" },
    });

    const customers = await prisma.customer.findMany({
        where,
        orderBy,
        include: { orders: { select: { total: true } } },
    });

    const header = ["Ім'я", "Прізвище", "Email", "Телефон", "Замовлень", "Витрачено"];
    const lines = customers.map((c) => {
        const spent = c.orders.reduce((s, o) => s + Number(o.total), 0);
        return [
            c.firstName,
            c.lastName,
            c.email,
            c.phone || "",
            String(c.orders.length),
            String(spent),
        ];
    });
    const csv = [header, ...lines].map((r) => r.map(csvCell).join(",")).join("\r\n");

    // Leading BOM so Excel opens the UTF-8 Cyrillic correctly.
    return new Response("﻿" + csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="customers.csv"',
        },
    });
}
