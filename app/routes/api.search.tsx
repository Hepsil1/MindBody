import { prisma } from "../db.server";

export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query || query.trim().length < 2) {
        return Response.json({ products: [] });
    }

    try {
        const searchTerm = `%${query.trim()}%`;
        const products = await prisma.$queryRaw<
            Array<{
                id: string;
                name: string;
                price: number | string;
                comparePrice: number | string | null;
                category: string | null;
                images: string | null;
                shopPageSlug: string | null;
            }>
        >`
            SELECT id, name, price, "comparePrice", category, images, "shopPageSlug"
            FROM "Product"
            WHERE status = 'active'
            AND (
                name ILIKE ${searchTerm}
                OR description ILIKE ${searchTerm}
                OR category ILIKE ${searchTerm}
            )
            ORDER BY name ASC
            LIMIT 8
        `;

        const results = products.map((p) => {
            let image = "/pics1cloths/IMG_6201.JPG";
            try {
                const imgs = JSON.parse(p.images || "[]");
                if (imgs[0]) image = imgs[0];
            } catch {
                // Malformed images JSON — keep default image
            }

            return {
                id: p.id,
                name: p.name,
                price: Number(p.price),
                comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
                category: p.category,
                image,
                shopPageSlug: p.shopPageSlug,
            };
        });

        return Response.json({ products: results });
    } catch (error) {
        console.error("Search error:", error);
        return Response.json({ products: [] });
    }
}
