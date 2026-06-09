// Slug-URL canonicalization verification against the running dev server.
import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE || "http://localhost:3001";
const prisma = new PrismaClient();
let pass = 0,
    fail = 0;
const ok = (name, cond, detail = "") => {
    if (cond) {
        pass++;
        console.log(`  ✅ ${name}`);
    } else {
        fail++;
        console.log(`  ❌ ${name}  ${detail}`);
    }
};
const head = (p) => fetch(BASE + p, { redirect: "manual" });
const text = (p) => fetch(BASE + p).then((r) => r.text());

async function main() {
    console.log(`\n=== slug-URL canonicalization against ${BASE} ===\n`);

    const a = await prisma.product.findFirst({
        where: { status: "active", slug: { not: null }, shopPageSlug: "yoga" },
        select: { id: true, slug: true, name: true },
    });
    const draft = await prisma.product.findFirst({
        where: { status: "draft" },
        select: { id: true },
    });
    if (!a) {
        console.error("No active yoga product with a slug — seed first.");
        await prisma.$disconnect();
        process.exit(1);
    }

    // 1. Catalog card links to /p/<slug>
    const shop = await text(`/shop/yoga`);
    ok("shop/yoga product card links to /p/<slug>", shop.includes(`/p/${a.slug}`), a.slug);

    // 2. /p/<slug> renders
    ok("GET /p/<slug> = 200", (await head(`/p/${a.slug}`)).status === 200);

    // 3. /product/<id> 301 → /p/<slug>
    const r3 = await head(`/product/${a.id}`);
    ok(
        "/product/<id> 301-redirects to /p/<slug>",
        r3.status === 301 && r3.headers.get("location") === `/p/${a.slug}`,
        `${r3.status} → ${r3.headers.get("location")}`,
    );

    // 4. draft /product/<id> → 404 (no redirect)
    if (draft) {
        ok(
            "/product/<draft> = 404 (no redirect)",
            (await head(`/product/${draft.id}`)).status === 404,
        );
    }

    // 5. canonical + JSON-LD point at /p/<slug>, and no /product/<id> reference (no double-index)
    const pdp = await text(`/p/${a.slug}`);
    ok("canonical is /p/<slug>", pdp.includes('rel="canonical"') && pdp.includes(`/p/${a.slug}`));
    ok("JSON-LD url is /p/<slug>", pdp.includes(`"url":"`) && pdp.includes(`/p/${a.slug}`));
    ok(
        "PDP does not reference its own /product/<id> (single canonical)",
        !pdp.includes(`/product/${a.id}`),
    );

    // 6. id→slug API (wishlist/cart link builder)
    const apiMap = await (await fetch(`${BASE}/api/products/slugs?ids=${a.id}`)).json();
    ok("GET /api/products/slugs maps id→slug", apiMap[a.id] === a.slug, JSON.stringify(apiMap));

    // 7. search API returns slug (header dropdown links to /p/<slug>)
    const term = encodeURIComponent(a.name.split(" ")[0]);
    const search = await (await fetch(`${BASE}/api/search?q=${term}`)).json();
    ok(
        "GET /api/search returns slug on results",
        Array.isArray(search.products) && search.products.some((p) => p.slug === a.slug),
        JSON.stringify(search.products?.[0]),
    );

    // 8. wishlist page still renders (stores id, doesn't break)
    ok("GET /wishlist = 200", (await head(`/wishlist`)).status === 200);

    // 9. sitemap already uses /p/<slug> — not broken
    const sm = await text(`/sitemap.xml`);
    ok("sitemap contains /p/<slug>", sm.includes(`/p/${a.slug}`));

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("harness crashed:", e);
    await prisma.$disconnect();
    process.exit(1);
});
