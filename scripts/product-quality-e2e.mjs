// Product publish-quality gate verification against the running dev server.
// Proves the save action blocks publishing (status=active) an incomplete product
// but allows saving it as a draft. Verified via the DB (was the product created?).
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
let ipN = 80;
const nextIp = () => `10.5.0.${ipN++ % 250}`;

async function login() {
    const body = new URLSearchParams({
        username: process.env.ADMIN_USERNAME || "Admin",
        password: process.env.ADMIN_PASSWORD || "",
    }).toString();
    const r = await fetch(`${BASE}/admin/login`, {
        method: "POST",
        redirect: "manual",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: BASE,
            "x-forwarded-for": nextIp(),
        },
        body,
    });
    const s = (r.headers.getSetCookie?.() || []).find((c) => c.startsWith("admin_session="));
    return s ? s.split(";")[0] : null;
}

async function saveProduct(cookie, over) {
    const fields = {
        intent: "save_product",
        name: "PQ Test Product",
        price: "1000",
        comparePrice: "",
        sku: over.sku,
        status: over.status,
        stock: over.stock,
        category: "leggings",
        shopPageSlug: "yoga",
        images: JSON.stringify(["/uploads/pq-test.webp"]),
        colors: JSON.stringify([]),
        sizes: JSON.stringify([]),
        inventory: JSON.stringify([]),
        fabric: "sport", // valid for yoga/leggings → isolates `stock` as the only blocker
        sleeve: "",
    };
    return fetch(`${BASE}/admin/products/new`, {
        method: "POST",
        redirect: "manual",
        headers: {
            Cookie: cookie,
            Origin: BASE,
            "x-forwarded-for": nextIp(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(fields).toString(),
    });
}

const bySku = async (sku) =>
    prisma.product.findFirst({ where: { sku }, select: { id: true, status: true } });

async function main() {
    console.log(`\n=== product publish-quality gate against ${BASE} ===\n`);
    const cookie = await login();
    ok("admin login", Boolean(cookie));
    if (!cookie) {
        await prisma.$disconnect();
        process.exit(1);
    }

    const ts = Date.now();
    const skuA = `PQ-A-${ts}`,
        skuB = `PQ-B-${ts}`,
        skuC = `PQ-C-${ts}`;

    // A) active + stock 0 → must be BLOCKED (not created).
    await saveProduct(cookie, { sku: skuA, status: "active", stock: "0" });
    ok("active + 0 stock is NOT created (publish blocked)", !(await bySku(skuA)));

    // B) draft + stock 0 → allowed (incomplete drafts are fine).
    await saveProduct(cookie, { sku: skuB, status: "draft", stock: "0" });
    const b = await bySku(skuB);
    ok("draft + 0 stock IS saved as draft", b?.status === "draft", JSON.stringify(b));

    // C) active + stock 5 (complete) → published.
    await saveProduct(cookie, { sku: skuC, status: "active", stock: "5" });
    const c = await bySku(skuC);
    ok("active + stock + complete IS published", c?.status === "active", JSON.stringify(c));

    // Cleanup
    await prisma.product.deleteMany({ where: { sku: { in: [skuA, skuB, skuC] } } });

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("harness crashed:", e);
    await prisma.$disconnect();
    process.exit(1);
});
