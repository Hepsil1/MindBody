import { prisma } from "../db.server";
import { isWellFormedToken } from "../utils/orderToken.server";

export interface TrackedOrder {
    number: number;
    status: string;
    statusLabel: string;
    paymentStatus: string;
    createdAt: string;
    total: number;
    discountAmount: number;
    items: Array<{
        productId: string;
        name: string;
        slug: string | null;
        image: string;
        size: string | null;
        color: string | null;
        quantity: number;
        price: number;
    }>;
    customer: {
        firstName: string;
        maskedPhone: string;
        maskedEmail: string;
    };
    delivery: {
        method: string | null;
        city: string | null;
        warehouse: string | null;
        comment: string | null;
    };
    trackingNumber: string | null;
    trackingUrl: string | null;
    timeline: Array<{
        status: string;
        label: string;
        at: string;
        done: boolean;
        current: boolean;
    }>;
}

const STATUS_LABELS: Record<string, string> = {
    pending: "Очікує підтвердження",
    processing: "В роботі / Комплектується",
    shipped: "Відправлено",
    delivered: "Доставлено",
    cancelled: "Скасовано",
};

export async function getOrderByToken(token: string): Promise<TrackedOrder | null> {
    if (!token || !isWellFormedToken(token)) {
        return null;
    }

    const order = await prisma.order.findUnique({
        where: { accessToken: token },
        include: {
            customer: true,
            items: {
                include: {
                    product: {
                        select: {
                            name: true,
                            slug: true,
                            images: true,
                        },
                    },
                },
            },
            statusHistory: {
                where: { field: "status" },
                orderBy: { createdAt: "asc" },
            },
        },
    });

    if (!order) {
        return null;
    }

    // Mask phone & email for guest privacy
    const rawPhone = order.customer?.phone || "";
    const maskedPhone =
        rawPhone.length > 6 ? `${rawPhone.slice(0, 4)}••••${rawPhone.slice(-2)}` : rawPhone;

    const rawEmail = order.customer?.email || "";
    const maskedEmail =
        rawEmail.includes("@") && !rawEmail.endsWith("@mindbody.local")
            ? `${rawEmail[0]}••••@${rawEmail.split("@")[1]}`
            : "";

    // Parse tracking link
    const ttn = order.trackingNumber;
    const trackingUrl =
        ttn && /^[0-9]{14}$/.test(ttn.trim())
            ? `https://novaposhta.ua/tracking/?cargo_number=${ttn.trim()}`
            : null;

    // Build timeline stages
    const stages = ["pending", "processing", "shipped", "delivered"];
    const currentIdx = stages.indexOf(order.status);

    const timeline = stages.map((s, idx) => {
        const histEntry = order.statusHistory.find((h) => h.toValue === s);
        const at = histEntry
            ? new Date(histEntry.createdAt).toISOString()
            : idx === 0
              ? new Date(order.createdAt).toISOString()
              : "";

        return {
            status: s,
            label: STATUS_LABELS[s] || s,
            at,
            done: currentIdx >= idx && order.status !== "cancelled",
            current: order.status === s,
        };
    });

    const items = order.items.map((i) => {
        let firstImg = "/og-default.jpg";
        if (i.product?.images) {
            try {
                const parsed = JSON.parse(i.product.images);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    firstImg = parsed[0];
                }
            } catch {
                // fallback
            }
        }

        return {
            productId: i.productId,
            name: i.product?.name || "Виріб MIND BODY",
            slug: i.product?.slug || null,
            image: firstImg,
            size: i.size,
            color: i.color,
            quantity: i.quantity,
            price: Number(i.price),
        };
    });

    return {
        number: order.orderNumber,
        status: order.status,
        statusLabel: STATUS_LABELS[order.status] || order.status,
        paymentStatus: order.paymentStatus,
        createdAt: new Date(order.createdAt).toISOString(),
        total: Number(order.total),
        discountAmount: Number(order.discountAmount ?? 0),
        items,
        customer: {
            firstName: order.customer?.firstName || "",
            maskedPhone,
            maskedEmail,
        },
        delivery: {
            method: order.deliveryMethod,
            city: order.shippingCity,
            warehouse: order.shippingWarehouse,
            comment: order.comment,
        },
        trackingNumber: ttn,
        trackingUrl,
        timeline,
    };
}
