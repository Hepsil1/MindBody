import { prisma } from "../db.server";
import { resolveSiteUrl } from "../utils/site-url";

// Dynamic Google Merchant Center Feed (/feed.xml)
// RSS 2.0 specification with Google Base namespace (http://base.google.com/ns/1.0).
//
// Automatically syncs with PostgreSQL for Google Shopping free listings & ads:
//  - Title, description, canonical /p/<slug> link
//  - High-res image URL (absolute path)
//  - Availability (in_stock / out_of_stock)
//  - Price in UAH
//  - Brand: MIND BODY
//  - Condition: new
//  - Shipping destination: UA (Nova Poshta)
export async function loader() {
    const baseUrl = resolveSiteUrl();

    const products = await prisma.product.findMany({
        where: { status: "active", slug: { not: null } },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            price: true,
            comparePrice: true,
            stock: true,
            sku: true,
            images: true,
            category: true,
            shopPageSlug: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
    });

    const escapeXml = (str: string | null | undefined) => {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    };

    const itemsXml = products
        .map((p) => {
            const link = `${baseUrl}/p/${p.slug}`;

            let imageUrl = `${baseUrl}/og-default.jpg`;
            if (p.images) {
                try {
                    const parsed = JSON.parse(p.images);
                    if (
                        Array.isArray(parsed) &&
                        parsed.length > 0 &&
                        typeof parsed[0] === "string"
                    ) {
                        const firstImg = parsed[0];
                        imageUrl = firstImg.startsWith("http")
                            ? firstImg
                            : `${baseUrl}${firstImg.startsWith("/") ? "" : "/"}${firstImg}`;
                    }
                } catch {
                    // fallback
                }
            }

            const isAvailable = (p.stock ?? 1) > 0;
            const availability = isAvailable ? "in_stock" : "out_of_stock";
            const priceFormatted = `${Number(p.price).toFixed(2)} UAH`;
            const sku = p.sku || p.id.slice(0, 12).toUpperCase();

            const categoryText =
                p.shopPageSlug === "kids"
                    ? "Одяг > Дитячий одяг > Спортивний одяг"
                    : "Одяг > Жіночий одяг > Одяг для йоги та спорту";

            return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description || p.name + " — преміальний спортивний одяг MIND BODY.")}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${priceFormatted}</g:price>
      <g:brand>MIND BODY</g:brand>
      <g:mpn>${escapeXml(sku)}</g:mpn>
      <g:google_product_category>1604</g:google_product_category>
      <g:product_type>${escapeXml(categoryText)}</g:product_type>
    </item>`;
            // No per-item <g:shipping>: delivery is paid by the buyer at the Nova Poshta
            // tariff (see utils/shipping.ts — there is NO free shipping). A "0 UAH" price
            // here would advertise free delivery on Google Shopping. Configure the carrier
            // rate once in Merchant Center → Shipping & returns (account-level) instead.
        })
        .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>MIND BODY — Офіційний каталог</title>
    <link>${baseUrl}</link>
    <description>Преміальний жіночий та дитячий одяг для йоги, спорту та активного руху від українського виробника MIND BODY</description>
${itemsXml}
  </channel>
</rss>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
    });
}
