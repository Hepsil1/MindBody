// READ-ONLY pre-launch inspection of the default DB (mindbody_db). No PII printed
// — counts + names + schema presence only, to decide reset-vs-migrate.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const reg = async (t) =>
    (await p.$queryRawUnsafe(`SELECT to_regclass('"${t}"')::text AS r`))[0].r ? "YES" : "no";
const col = async (table, c) =>
    Number(
        (
            await p.$queryRawUnsafe(
                `SELECT count(*) n FROM information_schema.columns WHERE table_name='${table}' AND column_name='${c}'`,
            )
        )[0].n,
    ) > 0
        ? "YES"
        : "no";

const counts = {
    products: await p.product.count(),
    customers: await p.customer.count(),
    orders: await p.order.count(),
    orderItems: await p.orderItem.count(),
    categories: await p.category.count(),
    shopPages: await p.shopPage.count(),
    slides: await p.slide.count(),
    reviews: await p.review.count(),
    promo: await p.promoCode.count(),
    filterConfigs: await p.filterConfig.count(),
    newsletter: await p.newsletterSubscriber.count(),
};
console.log("COUNTS:", JSON.stringify(counts, null, 1));

// Products: status spread + slug coverage + a few names + image realness
const prodStatus = await p.$queryRawUnsafe(
    `SELECT status, count(*)::int n FROM "Product" GROUP BY status`,
);
console.log("PRODUCT STATUS:", JSON.stringify(prodStatus));
const slugCov = await p.$queryRawUnsafe(
    `SELECT count(*) FILTER (WHERE slug IS NOT NULL AND slug<>'')::int withslug, count(*) FILTER (WHERE slug IS NULL OR slug='')::int noslug FROM "Product"`,
);
console.log("SLUG COVERAGE:", JSON.stringify(slugCov[0]));
const sample = await p.product.findMany({
    select: { name: true, status: true, images: true },
    take: 6,
    orderBy: { createdAt: "desc" },
});
console.log("PRODUCT SAMPLE (newest 6):");
for (const s of sample) {
    let img = "—";
    try {
        img = JSON.parse(s.images || "[]")[0] || "—";
    } catch {
        /* ignore */
    }
    console.log(`  [${s.status}] ${s.name}  | img: ${String(img).slice(0, 50)}`);
}

// Customers: test (guest/local) vs real-ish — no emails printed
const custKind = await p.$queryRawUnsafe(
    `SELECT count(*) FILTER (WHERE email LIKE '%@mindbody.local')::int guests, count(*) FILTER (WHERE email NOT LIKE '%@mindbody.local')::int others FROM "Customer"`,
);
console.log("CUSTOMERS:", JSON.stringify(custKind[0]), "(guests = test/no-email orders)");

// Content realness
const cats = await p.category.findMany({ select: { title: true, image: true } });
console.log(
    "CATEGORIES:",
    cats.map((c) => `${c.title}${c.image ? "✓img" : "✗img"}`).join(", ") || "(none)",
);
const sp = await p.shopPage.findMany({ select: { slug: true, heroImage: true } });
console.log(
    "SHOP PAGES:",
    sp.map((s) => `${s.slug}${s.heroImage ? "✓hero" : "✗hero"}`).join(", ") || "(none)",
);

// Schema presence (the whole-branch needs these)
console.log("SCHEMA PRESENCE:");
console.log("  Product.slug:", await col("Product", "slug"));
console.log("  Product.fabric:", await col("Product", "fabric"));
console.log("  Product.sleeve:", await col("Product", "sleeve"));
console.log("  Product.metaTitle:", await col("Product", "metaTitle"));
console.log("  Category.moodType:", await col("Category", "moodType"));
console.log("  Order.idempotencyKey:", await col("Order", "idempotencyKey"));
console.log("  Order.discountAmount:", await col("Order", "discountAmount"));
console.log("  Order.emailStatus:", await col("Order", "emailStatus"));
console.log("  table InventoryMovement:", await reg("InventoryMovement"));
console.log("  table OrderStatusHistory:", await reg("OrderStatusHistory"));
console.log("  table _prisma_migrations:", await reg("_prisma_migrations"));

// Migration ledger state
try {
    const migs = await p.$queryRawUnsafe(
        `SELECT migration_name, (finished_at IS NOT NULL) done FROM "_prisma_migrations" ORDER BY started_at`,
    );
    console.log("MIGRATION LEDGER:", JSON.stringify(migs));
} catch {
    console.log("MIGRATION LEDGER: (no _prisma_migrations table — db push, not migrate)");
}

await p.$disconnect();
