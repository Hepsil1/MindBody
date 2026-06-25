import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

// GET /api/cart/prices?ids=a,b,c → { "<id>": <price>, ... } for ACTIVE products.
//
// The cart lives in localStorage and stores the unit price captured at
// add-to-cart time, which goes stale the moment an admin edits a price or
// starts a sale. The order service recomputes from the live DB price and hard-
// rejects any client/server divergence over 5 UAH, so a stale cart becomes
// silently un-checkout-able. Checkout calls this on entry to reconcile each
// line against the current price before the customer reaches the pay button.
//
// Ids that are missing/draft/archived are OMITTED from the map — the caller
// treats an absent id as "no longer purchasable" and drops that line.
export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100); // cap to keep the IN() bounded

    const map: Record<string, number> = {};
    if (ids.length > 0) {
        const rows = await prisma.product.findMany({
            where: { id: { in: ids }, status: "active" },
            select: { id: true, price: true },
        });
        for (const r of rows) map[r.id] = Number(r.price);
    }

    // Short cache: prices change rarely; 60 s keeps a burst of checkout entries
    // cheap without serving a meaningfully stale price.
    return Response.json(map, { headers: { "Cache-Control": "public, max-age=60" } });
}
