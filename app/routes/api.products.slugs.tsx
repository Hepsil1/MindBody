import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

// GET /api/products/slugs?ids=a,b,c → { "<id>": "<slug>", ... } for ACTIVE
// products that have a slug. Lets localStorage-backed surfaces (wishlist, cart)
// build /p/<slug> links from the productIds they store, without persisting the
// slug (which can change in admin). Unknown/draft/archived ids are simply
// omitted — the caller falls back to /product/<id> (which 301s).
export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100); // cap to keep the IN() bounded

    const map: Record<string, string> = {};
    if (ids.length > 0) {
        const rows = await prisma.product.findMany({
            where: { id: { in: ids }, status: "active", slug: { not: null } },
            select: { id: true, slug: true },
        });
        for (const r of rows) if (r.slug) map[r.id] = r.slug;
    }

    return Response.json(map, { headers: { "Cache-Control": "public, max-age=60" } });
}
