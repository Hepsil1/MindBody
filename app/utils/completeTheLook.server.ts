import { prisma } from "../db.server";
import type { RelatedProductCard } from "../types/product";

// Complete the Look — editorial cross-merchandising engine.
// Pairs primary garments (e.g. yoga jumpsuits, sport sets) with complementary
// layering pieces (oversize shirts, hoodies, accessories) to inspire complete outfits.
// Model key: the quoted model name («HYPNOSE»), so colourways and sleeve
// variants of one model count as the same piece. Falls back to the full name.
function modelKey(name: string | null | undefined): string {
    const n = (name || "").trim().toLowerCase();
    const m = n.match(/«([^»]+)»/);
    return (m ? m[1] : n).trim();
}

export async function getCompleteTheLook(currentProduct: {
    id: string;
    name?: string | null;
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
                // `not` alone drops NULL families in SQL — keep them explicitly.
                ...(currentProduct.familyId
                    ? {
                          OR: [{ familyId: null }, { familyId: { not: currentProduct.familyId } }],
                      }
                    : {}),
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
            take: 24,
            orderBy: { updatedAt: "desc" },
        });

        // Never offer the same model (other colourway / sleeve) or two
        // variants of one model side by side.
        const seenModels = new Set<string>([modelKey(currentProduct.name)]);
        const pool = candidates.filter((c) => {
            const k = modelKey(c.name);
            if (!k || seenModels.has(k)) return false;
            seenModels.add(k);
            return true;
        });
        if (pool.length === 0) return [];

        // Pick distinct categories to offer a balanced outfit look
        const chosen: typeof candidates = [];
        const seenCategories = new Set<string>();

        // First pass: try to pick items with categories different from current product
        for (const item of pool) {
            const cat = item.category || item.shopPageSlug || "other";
            if (cat !== currentProduct.category && !seenCategories.has(cat)) {
                chosen.push(item);
                seenCategories.add(cat);
                if (chosen.length >= 3) break;
            }
        }

        // Second pass: fill up to 3 items if needed
        if (chosen.length < 3) {
            for (const item of pool) {
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
