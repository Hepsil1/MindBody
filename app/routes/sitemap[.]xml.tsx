import { prisma } from "../db.server";
import { isValidSubcategory } from "../utils/categoryMap";
import { resolveSiteUrl } from "../utils/site-url";
import { HTML_LANG, LOCALES, localizePath } from "../i18n/config";

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
    const baseUrl = resolveSiteUrl();

    const products = await prisma.product.findMany({
        where: { status: "active" },
        select: { id: true, slug: true, updatedAt: true },
    });

    const shopPages = await prisma.shopPage.findMany({
        select: { slug: true, updatedAt: true },
    });

    // Distinct (shopPage, subcategory) pairs that have at least one active
    // product, with the most-recent product updatedAt as the pair's
    // lastmod. The index on Product.category + Product.shopPageSlug makes
    // this trivially cheap and the 1h Cache-Control absorbs the query.
    // Using MAX(updatedAt) avoids the SEO-anti-pattern of stamping
    // "today" on every subcategory URL — Google then re-crawls daily even
    // when nothing has actually changed.
    const subRows = await prisma.product.groupBy({
        by: ["shopPageSlug", "category"],
        where: { status: "active", category: { not: null }, shopPageSlug: { not: null } },
        _max: { updatedAt: true },
    });
    const subcategoryPairs = subRows.flatMap((g) =>
        g.shopPageSlug && g.category
            ? [
                  {
                      shopPageSlug: g.shopPageSlug,
                      category: g.category,
                      maxUpdatedAt: g._max.updatedAt,
                  },
              ]
            : [],
    );

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

    // Every canonical path exists in three language trees (uk = no prefix,
    // /en, /ru). Each tree gets its own <url> entry, and every entry carries
    // the full hreflang alternate cluster (Google's recommended sitemap form).
    const pushLocalized = (path: string, lastmod: string, changefreq: string, priority: string) => {
        const alternates = [
            ...LOCALES.map(
                (l) =>
                    `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${baseUrl}${localizePath(path, l)}"/>`,
            ),
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${path}"/>`,
        ].join("\n");
        for (const l of LOCALES) {
            urls.push(
                `  <url>
    <loc>${baseUrl}${localizePath(path, l)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`,
            );
        }
    };

    for (const page of staticPages) {
        pushLocalized(esc(page.url), now, page.changefreq, page.priority);
    }

    for (const sp of shopPages) {
        const lastmod = sp.updatedAt ? new Date(sp.updatedAt).toISOString().split("T")[0] : now;
        pushLocalized(`/shop/${esc(sp.slug)}`, lastmod, "daily", "0.8");
    }

    for (const pair of subcategoryPairs) {
        // Defence in depth: filter out (shop, sub) combos that aren't in the
        // declared whitelist — they'd 301 anyway, but no point listing them.
        if (!isValidSubcategory(pair.shopPageSlug, pair.category)) continue;
        const lastmod = pair.maxUpdatedAt
            ? new Date(pair.maxUpdatedAt).toISOString().split("T")[0]
            : now;
        pushLocalized(
            `/shop/${esc(pair.shopPageSlug)}/${esc(pair.category)}`,
            lastmod,
            "daily",
            "0.75",
        );
    }

    for (const p of products) {
        const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : now;
        const path = p.slug ? `/p/${esc(p.slug)}` : `/product/${esc(p.id)}`;
        pushLocalized(path, lastmod, "weekly", "0.7");
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
}
