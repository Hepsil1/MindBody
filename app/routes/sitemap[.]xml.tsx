import { prisma } from "../db.server";
import { isValidSubcategory } from "../utils/categoryMap";

// Dynamic sitemap.xml — all canonical, indexable pages for Google.
//
// Conventions:
//  - Static info pages → constant priority.
//  - Categories (/shop/<slug>) → priority 0.8, daily (inventory changes).
//  - Subcategories (/shop/<slug>/<subcategory>) → priority 0.75, daily.
//    Only emitted when (a) there is at least one active product matching
//    the pair, and (b) the pair is in the per-shop whitelist
//    (CATEGORY_BY_SHOP_PAGE in app/utils/categoryMap.ts).
//  - Products → priority 0.7, weekly. Uses /p/<slug> when slug present,
//    falls back to /product/<id> otherwise.
//  - Filtered / search / paginated URLs are intentionally excluded
//    (they are noindex or query-only and don't deserve sitemap entries).
export async function loader() {
    const baseUrl = process.env.SITE_URL || "https://saleid.icu";

    const products = await prisma.$queryRaw<any[]>`
        SELECT id, slug, "updatedAt" FROM "Product" WHERE status = 'active'
    `;

    const shopPages = await prisma.$queryRaw<any[]>`
        SELECT slug, "updatedAt" FROM "ShopPage"
    `;

    // Distinct (shopPage, subcategory) pairs that have at least one active
    // product, with the most-recent product updatedAt as the pair's
    // lastmod. The index on Product.category + Product.shopPageSlug makes
    // this trivially cheap and the 1h Cache-Control absorbs the query.
    // Using MAX(updatedAt) avoids the SEO-anti-pattern of stamping
    // "today" on every subcategory URL — Google then re-crawls daily even
    // when nothing has actually changed.
    const subcategoryPairs = await prisma.$queryRaw<
        { shopPageSlug: string; category: string; maxUpdatedAt: Date | null }[]
    >`SELECT "shopPageSlug", category, MAX("updatedAt") AS "maxUpdatedAt"
      FROM "Product"
      WHERE status = 'active'
        AND category IS NOT NULL
        AND "shopPageSlug" IS NOT NULL
      GROUP BY "shopPageSlug", category`;

    const staticPages = [
        { url: "/", priority: "1.0", changefreq: "daily" },
        { url: "/about", priority: "0.7", changefreq: "monthly" },
        { url: "/contacts", priority: "0.5", changefreq: "monthly" },
        { url: "/delivery", priority: "0.6", changefreq: "monthly" },
        { url: "/size-guide", priority: "0.5", changefreq: "monthly" },
        { url: "/care-guide", priority: "0.5", changefreq: "monthly" },
        { url: "/faq", priority: "0.6", changefreq: "monthly" },
        { url: "/return-policy", priority: "0.4", changefreq: "yearly" },
        { url: "/privacy", priority: "0.3", changefreq: "yearly" },
        { url: "/terms", priority: "0.3", changefreq: "yearly" },
    ];

    const now = new Date().toISOString().split("T")[0];
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&apos;");

    const urls: string[] = [];

    for (const page of staticPages) {
        urls.push(
            `  <url>
    <loc>${baseUrl}${esc(page.url)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
        );
    }

    for (const sp of shopPages) {
        const lastmod = sp.updatedAt ? new Date(sp.updatedAt).toISOString().split("T")[0] : now;
        urls.push(
            `  <url>
    <loc>${baseUrl}/shop/${esc(sp.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
        );
    }

    for (const pair of subcategoryPairs) {
        // Defence in depth: filter out (shop, sub) combos that aren't in the
        // declared whitelist — they'd 301 anyway, but no point listing them.
        if (!isValidSubcategory(pair.shopPageSlug, pair.category)) continue;
        const lastmod = pair.maxUpdatedAt
            ? new Date(pair.maxUpdatedAt).toISOString().split("T")[0]
            : now;
        urls.push(
            `  <url>
    <loc>${baseUrl}/shop/${esc(pair.shopPageSlug)}/${esc(pair.category)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.75</priority>
  </url>`,
        );
    }

    for (const p of products) {
        const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : now;
        const path = p.slug ? `/p/${esc(p.slug)}` : `/product/${esc(p.id)}`;
        urls.push(
            `  <url>
    <loc>${baseUrl}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
        );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
}
