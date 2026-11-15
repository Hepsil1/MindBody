import { prisma } from "../db.server";

export interface CartLeadItem {
    productId: string;
    name?: string;
    size?: string | null;
    color?: string | null;
    quantity: number;
    price?: number;
}

export interface UpsertCartLeadInput {
    sessionKey: string;
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    locale?: string;
    items: CartLeadItem[];
    subtotal: number;
}

export async function upsertCartLead(input: UpsertCartLeadInput) {
    const { sessionKey, email, phone, name, locale = "uk", items, subtotal } = input;

    // We only track leads if at least email or phone was provided and cart has items
    if ((!email && !phone) || !items || items.length === 0) {
        return null;
    }

    const cleanEmail = email?.trim().toLowerCase() || null;
    const cleanPhone = phone?.trim() || null;
    const cleanName = name?.trim() || null;
    const itemCount = items.reduce((acc, i) => acc + (i.quantity || 1), 0);

    // Strip client-side prices for safety; keep minimal product identifiers
    const sanitizedItems = items.map((i) => ({
        productId: String(i.productId),
        name: i.name,
        size: i.size || null,
        color: i.color || null,
        quantity: i.quantity || 1,
    }));

    // A lead already converted into an order is history — never overwrite it
    // (the client rotates its key after ordering, so this only blocks replays).
    const existing = await prisma.abandonedCart.findUnique({
        where: { sessionKey },
        select: { status: true },
    });
    if (existing && existing.status === "recovered") return null;

    return prisma.abandonedCart.upsert({
        where: { sessionKey },
        update: {
            email: cleanEmail,
            phone: cleanPhone,
            name: cleanName,
            locale,
            items: sanitizedItems,
            itemCount,
            subtotal,
            lastActivityAt: new Date(),
        },
        create: {
            sessionKey,
            email: cleanEmail,
            phone: cleanPhone,
            name: cleanName,
            locale,
            items: sanitizedItems,
            itemCount,
            subtotal,
            status: "open",
        },
    });
}

export async function markCartRecovered(
    sessionKey: string,
    orderId: string,
    contact: { email?: string | null; phone?: string | null } = {},
) {
    if (!sessionKey) return;
    // Only the order's own buyer can close a lead: the lead must still be open
    // and share the order's email or phone (a foreign sessionKey alone is not enough).
    const email = contact.email?.trim().toLowerCase() || undefined;
    const phoneDigits = contact.phone?.replace(/\D/g, "") || "";
    try {
        const lead = await prisma.abandonedCart.findUnique({
            where: { sessionKey },
            select: { status: true, email: true, phone: true },
        });
        if (!lead || lead.status !== "open") return;
        const leadPhone = lead.phone?.replace(/\D/g, "") || "";
        const phoneMatch = phoneDigits.length >= 9 && leadPhone.endsWith(phoneDigits.slice(-9));
        const emailMatch = !!email && lead.email === email;
        if (!phoneMatch && !emailMatch) return;
        await prisma.abandonedCart.updateMany({
            where: { sessionKey, status: "open" },
            data: {
                status: "recovered",
                recoveredOrderId: orderId,
            },
        });
    } catch (e) {
        console.error("[abandonedCart] error marking recovered:", e);
    }
}
