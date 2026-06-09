import { prisma } from "../db.server";

export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query || query.trim().length < 2) {
        return Response.json({ products: [] });
    }

    try {
        const term = query.trim().replace(/[%_]/g, "");
        const products = await prisma.product.findMany({
            where: {
                status: "active",
                OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { description: { contains: term, mode: "insensitive" } },
                    { category: { contains: term, mode: "insensitive" } },
                ],
            },
            orderBy: { name: "asc" },
            take: 8,
            select: {
                id: true,
                slug: true,
                name: true,
                price: true,
                comparePrice: true,
                category: true,
                images: true,
                shopPageSlug: true,
            },
        });

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
                slug: p.slug,
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
