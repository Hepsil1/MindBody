import { prisma } from "../../db.server";

// GET /api/promo?code=ЗИМА25 — validate promo code
export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
        return Response.json({ valid: false, error: "Введіть промокод" }, { status: 400 });
    }

    try {
        const p = await prisma.promoCode.findUnique({ where: { code } });

        if (!p) {
            return Response.json({ valid: false, error: "Промокод не знайдено" });
        }

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
        const raw = (await request.json()) as { code?: unknown };
        const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";

        if (!code) {
            return Response.json({ error: "Код не вказано" }, { status: 400 });
        }

        await prisma.promoCode.updateMany({
            where: { code },
            data: { usedCount: { increment: 1 } },
        });

        return Response.json({ success: true });
    } catch (e) {
        console.error("Promo use error:", e);
        return Response.json({ error: "Помилка" }, { status: 500 });
    }
}
