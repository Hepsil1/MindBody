import { prisma } from "../db.server";
import type { RelatedProductCard } from "../types/product";

// Complete the Look — editorial cross-merchandising engine.
// Pairs primary garments (e.g. yoga jumpsuits, sport sets) with complementary
// layering pieces (oversize shirts, hoodies, accessories) to inspire complete outfits.
export async function getCompleteTheLook(currentProduct: {
    id: string;
    category: string | null;
    shopPageSlug: string | null;
    familyId?: string | null;
}): Promise<RelatedProductCard[]> {
    try {
        // Exclude current product and colorway siblings
        const excludeIds = [currentProduct.id];

        // Complementary logic:
        // - Jumpsuits / Velo -> prefer Casual shirts, tops, loungewear, or kids jumpsuits
        // - Tops / Leggings -> prefer opposite halves or shirts
        // - Kids -> complementary kids items
        let targetShopPages: string[] = [];
        let targetCategories: string[] = [];

        if (currentProduct.shopPageSlug === "kids") {
            targetShopPages = ["kids"];
        } else if (currentProduct.category === "jumpsuit" || currentProduct.category === "velo") {
            targetShopPages = ["casual", "yoga", "sport"];
            targetCategories = ["shirts", "tops", "suits", "hoodies"];
        } else {
            targetShopPages = ["yoga", "casual", "sport"];
        }

        // Query up to 6 candidates
        const candidates = await prisma.product.findMany({
            where: {
                status: "active",
                slug: { not: null },
                id: { notIn: excludeIds },
                ...(currentProduct.familyId ? { familyId: { not: currentProduct.familyId } } : {}),
                ...(targetShopPages.length > 0 ? { shopPageSlug: { in: targetShopPages } } : {}),
            },
            select: {
                id: true,
                slug: true,
                name: true,
                price: true,
                images: true,
                category: true,
                shopPageSlug: true,
            },
            take: 8,
            orderBy: { updatedAt: "desc" },
        });

        if (candidates.length === 0) return [];

        // Pick distinct categories to offer a balanced outfit look
        const chosen: typeof candidates = [];
        const seenCategories = new Set<string>();

        // First pass: try to pick items with categories different from current product
        for (const item of candidates) {
            const cat = item.category || item.shopPageSlug || "other";
            if (cat !== currentProduct.category && !seenCategories.has(cat)) {
                chosen.push(item);
                seenCategories.add(cat);
                if (chosen.length >= 3) break;
            }
        }

        // Second pass: fill up to 3 items if needed
        if (chosen.length < 3) {
            for (const item of candidates) {
                if (!chosen.some((c) => c.id === item.id)) {
                    chosen.push(item);
                    if (chosen.length >= 3) break;
                }
            }
        }

        return chosen.map((p) => {
            let firstImg = "/og-default.jpg";
            if (p.images) {
                try {
                    const parsed = JSON.parse(p.images);
                    if (
                        Array.isArray(parsed) &&
                        parsed.length > 0 &&
                        typeof parsed[0] === "string"
                    ) {
                        firstImg = parsed[0];
                    }
                } catch {
                    // fallback
                }
            }

            return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: Number(p.price),
                image: firstImg,
            };
        });
    } catch (e) {
        console.error("[completeTheLook] failed to fetch complementary items:", e);
        return [];
    }
}
