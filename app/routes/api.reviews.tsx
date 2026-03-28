import { prisma } from "../db.server";
import { ReviewSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";

// GET — fetch reviews for a product (only approved ones for public)
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

// POST — submit a new review (isApproved: false — requires admin moderation)
export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        // Rate limit: 5 reviews per minute
        const rateLimited = checkRateLimit(request, "reviews", 5, 60_000);
        if (rateLimited) return rateLimited;

        const body = await request.json();

        // Zod validation
        const parsed = ReviewSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ error: formatZodErrors(parsed.error) }, { status: 400 });
        }

        const { productId, authorName, rating, text } = parsed.data;

        const review = await prisma.review.create({
            data: {
                productId,
                authorName,
                rating,
                text,
                isVerified: false,
                isApproved: false,
            }
        });

        return Response.json({ success: true, id: review.id, message: "Дякуємо! Ваш відгук буде опубліковано після модерації." });
    } catch (e) {
        console.error("Review create error:", e);
        return Response.json({ error: "Помилка збереження" }, { status: 500 });
    }
}
