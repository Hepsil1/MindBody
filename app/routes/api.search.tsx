import { prisma } from "../db.server";
import { expandSearchTerms } from "../utils/search-synonyms";
import { isLocale, type Locale } from "../i18n/config";
import { localizeEntities } from "../utils/translations.server";

export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const langParam = url.searchParams.get("lang");
    const locale: Locale = isLocale(langParam) ? langParam : "uk";

    if (!query || query.trim().length < 2) {
        return Response.json({ products: [] });
    }

    try {
        // F-014 — expand "легінси" → ["легінси", "лосини", ...] so the
        // top buyer query in the niche stops returning zero hits.
        const terms = expandSearchTerms(query);
        if (terms.length === 0) {
            return Response.json({ products: [] });
        }
        const products = await prisma.product.findMany({
            where: {
                status: "active",
                OR: terms.flatMap((t) => [
                    { name: { contains: t, mode: "insensitive" as const } },
                    { description: { contains: t, mode: "insensitive" as const } },
                    { category: { contains: t, mode: "insensitive" as const } },
                ]),
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

        // en/ru: show translated names (search itself matches uk text — the
        // synonym expansion maps en/ru queries onto uk terms).
        const localized = await localizeEntities("Product", products, locale, ["name"]);

        const results = localized.map((p) => {
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
