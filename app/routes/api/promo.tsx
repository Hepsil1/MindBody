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

// NOTE: the former public POST /api/promo (increment usedCount) was removed —
// it was unauthenticated, unlinked to any order, and let anyone inflate a
// code's usedCount to exhaust it (promo DoS) / corrupt analytics. Usage is
// incremented server-side in api.orders.create.tsx, the single source of truth.
