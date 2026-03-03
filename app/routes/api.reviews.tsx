import { prisma } from "../db.server";

// GET — fetch reviews for a product
export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
        return Response.json({ reviews: [], avg: 0, count: 0 });
    }

    try {
        const reviews = await prisma.$queryRawUnsafe(
            `SELECT id, "productId", "authorName", rating, text, "isVerified", "createdAt" 
             FROM "Review" 
             WHERE "productId" = $1 AND "isApproved" = true
             ORDER BY "createdAt" DESC`,
            productId
        ) as any[];

        const count = reviews.length;
        const avg = count > 0
            ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / count) * 10) / 10
            : 0;

        return Response.json({ reviews, avg, count });
    } catch (e) {
        console.error("Reviews fetch error:", e);
        return Response.json({ reviews: [], avg: 0, count: 0 });
    }
}

// POST — submit a new review
export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await request.json();
        const { productId, authorName, rating, text } = body;

        // Validate
        if (!productId || !authorName || !text) {
            return Response.json({ error: "Всі поля обов'язкові" }, { status: 400 });
        }

        const ratingNum = Number(rating);
        if (ratingNum < 1 || ratingNum > 5) {
            return Response.json({ error: "Оцінка має бути від 1 до 5" }, { status: 400 });
        }

        const trimmedName = authorName.trim().substring(0, 50);
        const trimmedText = text.trim().substring(0, 1000);

        const id = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
            `INSERT INTO "Review" (id, "productId", "authorName", rating, text, "isVerified", "isApproved", "createdAt") 
             VALUES ($1, $2, $3, $4, $5, false, true, CURRENT_TIMESTAMP)`,
            id, productId, trimmedName, ratingNum, trimmedText
        );

        return Response.json({ success: true, id });
    } catch (e) {
        console.error("Review create error:", e);
        return Response.json({ error: "Помилка збереження" }, { status: 500 });
    }
}
