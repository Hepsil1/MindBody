import { prisma } from "../../db.server";

// GET /api/promo?code=ЗИМА25 — validate promo code
export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
        return Response.json({ valid: false, error: "Введіть промокод" }, { status: 400 });
    }

    try {
        const promo = await prisma.$queryRawUnsafe(
            `SELECT * FROM PromoCode WHERE code = ? LIMIT 1`,
            code
        ) as any[];

        if (!promo[0]) {
            return Response.json({ valid: false, error: "Промокод не знайдено" });
        }

        const p = promo[0];

        // Check if active
        if (!p.isActive) {
            return Response.json({ valid: false, error: "Промокод більше не дійсний" });
        }

        // Check expiration
        if (p.expiresAt && new Date(p.expiresAt) < new Date()) {
            return Response.json({ valid: false, error: "Термін дії промокоду минув" });
        }

        // Check usage limit
        if (p.maxUses && p.usedCount >= p.maxUses) {
            return Response.json({ valid: false, error: "Промокод вичерпано" });
        }

        return Response.json({
            valid: true,
            code: p.code,
            discountType: p.discountType,
            discountValue: p.discountValue,
            minOrder: p.minOrder,
        });
    } catch (e) {
        console.error("Promo check error:", e);
        return Response.json({ valid: false, error: "Помилка перевірки" }, { status: 500 });
    }
}

// POST /api/promo — increment use count
export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const { code } = body;

        if (!code) {
            return Response.json({ error: "Код не вказано" }, { status: 400 });
        }

        await prisma.$executeRawUnsafe(
            `UPDATE PromoCode SET usedCount = usedCount + 1 WHERE code = ?`,
            code.trim().toUpperCase()
        );

        return Response.json({ success: true });
    } catch (e) {
        console.error("Promo use error:", e);
        return Response.json({ error: "Помилка" }, { status: 500 });
    }
}
