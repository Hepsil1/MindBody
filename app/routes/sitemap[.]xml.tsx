import { prisma } from "../db.server";

// Dynamic sitemap.xml — all canonical, indexable pages for Google.
//
// Conventions:
//  - Static info pages → constant priority.
//  - Categories (/shop/<slug>) → priority 0.8, daily (inventory changes).
//  - Products → priority 0.7, weekly. Uses /p/<slug> when slug present,
//    falls back to /product/<id> otherwise.
//  - Filtered / search / paginated URLs are intentionally excluded
//    (they are noindex or query-only and don't deserve sitemap entries).
export async function loader() {
    const baseUrl = process.env.SITE_URL || "https://mindbody.com.ua";

    const products = await prisma.$queryRaw<any[]>`
        SELECT id, slug, "updatedAt" FROM "Product" WHERE status = 'active'
    `;

    const shopPages = await prisma.$queryRaw<any[]>`
        SELECT slug, "updatedAt" FROM "ShopPage"
    `;

    const staticPages = [
        { url: "/",            priority: "1.0", changefreq: "daily" },
        { url: "/about",       priority: "0.7", changefreq: "monthly" },
        { url: "/contacts",    priority: "0.5", changefreq: "monthly" },
        { url: "/delivery",    priority: "0.6", changefreq: "monthly" },
        { url: "/size-guide",  priority: "0.5", changefreq: "monthly" },
        { url: "/care-guide",  priority: "0.5", changefreq: "monthly" },
        { url: "/faq",         priority: "0.6", changefreq: "monthly" },
        { url: "/return-policy", priority: "0.4", changefreq: "yearly" },
        { url: "/privacy",     priority: "0.3", changefreq: "yearly" },
        { url: "/terms",       priority: "0.3", changefreq: "yearly" },
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
  </url>`
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
  </url>`
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
  </url>`
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
