import { prisma } from "../db.server";

// Dynamic sitemap.xml — returns all public product and category pages
export async function loader() {
    const baseUrl = process.env.SITE_URL || "https://mindbody.com.ua";
    
    // Fetch all active products
    const products = await prisma.$queryRaw<any[]>`
        SELECT id, "updatedAt" FROM "Product" WHERE status = 'active'
    `;
    
    // Fetch all shop page slugs
    const shopPages = await prisma.$queryRaw<any[]>`
        SELECT slug, "updatedAt" FROM "ShopPage"
    `;

    const staticPages = [
        { url: "/", priority: "1.0", changefreq: "daily" },
        { url: "/about", priority: "0.6", changefreq: "monthly" },
        { url: "/contacts", priority: "0.5", changefreq: "monthly" },
        { url: "/delivery", priority: "0.5", changefreq: "monthly" },
        { url: "/size-guide", priority: "0.5", changefreq: "monthly" },
    ];

    const now = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Static pages
    for (const page of staticPages) {
        xml += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }

    // Shop category pages
    for (const sp of shopPages) {
        const lastmod = sp.updatedAt ? new Date(sp.updatedAt).toISOString().split("T")[0] : now;
        xml += `
  <url>
    <loc>${baseUrl}/shop/${sp.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    // Product pages
    for (const p of products) {
        const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : now;
        xml += `
  <url>
    <loc>${baseUrl}/product/${p.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600", // Cache 1 hour
        },
    });
}
