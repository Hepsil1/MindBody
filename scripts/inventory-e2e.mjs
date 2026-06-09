// /admin/inventory journal verification against the running dev server (test DB).
// Proves movements are written on order create/cancel and that the orderId +
// reason filters actually scope the rendered rows. Distinctive deltas (qty 2 vs
// qty 1) make the substring assertions unambiguous.
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
let ipN = 30;
const nextIp = () => `10.6.0.${ipN++ % 250}`;

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

async function postOrder(productId, name, qty, total, key) {
    const r = await fetch(`${BASE}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": nextIp() },
        body: JSON.stringify({
            customer: {
                name: "Inv Test",
                email: "inv@example.com",
                phone: "+380501112233",
                city: "Київ",
                warehouse: "№1",
            },
            items: [{ id: productId, name, price: 1000, quantity: qty, size: "M", color: "black" }],
            total,
            paymentMethod: "cash",
            deliveryMethod: "nova_poshta",
            idempotencyKey: key,
        }),
    });
    return r.json();
}

const orderIdByKey = async (key) =>
    (await prisma.$queryRaw`SELECT id FROM "Order" WHERE "idempotencyKey" = ${key} LIMIT 1`)[0]
        ?.id ?? null;
const movCount = async (productId, reason) =>
    Number(
        (
            await prisma.$queryRaw`SELECT count(*)::int AS n FROM "InventoryMovement" WHERE "productId" = ${productId} AND reason = ${reason}`
        )[0].n,
    );
const get = (cookie, qs) =>
    fetch(`${BASE}/admin/inventory${qs}`, { headers: { Cookie: cookie } }).then((r) => r.text());
const adminForm = (cookie, path, fields) =>
    fetch(`${BASE}${path}`, {
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

async function main() {
    console.log(`\n=== /admin/inventory journal against ${BASE} ===\n`);
    const cookie = await login();
    ok("admin login", Boolean(cookie));
    if (!cookie) {
        await prisma.$disconnect();
        process.exit(1);
    }

    const product = await prisma.product.create({
        data: {
            name: `Inv Journal ${Date.now()}`,
            price: 1000,
            status: "active",
            stock: 5,
            inventory: JSON.stringify([{ size: "M", color: "black", stock: 5 }]),
            sku: `INV-${Date.now()}`,
            shopPageSlug: "yoga",
            category: "tops",
            colors: JSON.stringify(["black"]),
            sizes: JSON.stringify(["M"]),
        },
    });

    // Two orders; the API returns the order NUMBER as `orderId` — use those
    // (digits only, no hyphens) as scoping markers. "+2" (no "+" in UUIDs/digits)
    // marks the cancel restore row for the reason-filter check.
    const k1 = `inv1-${Date.now()}`,
        k2 = `inv2-${Date.now()}`;
    const r1 = await postOrder(product.id, product.name, 2, 2000, k1);
    const r2 = await postOrder(product.id, product.name, 1, 1000, k2);
    const num1 = String(r1.orderId),
        num2 = String(r2.orderId);
    const o1 = await orderIdByKey(k1);
    const o2 = await orderIdByKey(k2);
    ok("two order_created movements written", (await movCount(product.id, "order_created")) === 2);

    const pageAll = await get(cookie, "");
    ok("GET /admin/inventory renders", pageAll.includes("Журнал складу"));

    const byProduct = await get(cookie, `?productId=${product.id}`);
    ok(
        "productId filter shows BOTH orders' movements",
        byProduct.includes(`/admin/orders/${o1}`) && byProduct.includes(`/admin/orders/${o2}`),
    );

    const byO1 = await get(cookie, `?orderId=${o1}`);
    ok(
        "orderId=O1 scoped to O1 (excludes O2)",
        byO1.includes(`/admin/orders/${o1}`) && !byO1.includes(`/admin/orders/${o2}`),
    );
    ok("orderId=O1 banner shows the order number", byO1.includes(`#${num1}`));
    const byO2 = await get(cookie, `?orderId=${o2}`);
    ok(
        "orderId=O2 scoped to O2",
        byO2.includes(`/admin/orders/${o2}`) && !byO2.includes(`/admin/orders/${o1}`),
    );

    // Cancel O1 → order_cancelled (+2). Reason filter must isolate it.
    await adminForm(cookie, `/admin/orders/${o1}`, { intent: "cancel" });
    ok("order_cancelled movement written", (await movCount(product.id, "order_cancelled")) === 1);
    const o1Cancel = await get(cookie, `?orderId=${o1}&reason=order_cancelled`);
    ok("reason=order_cancelled shows the +2 restore row", o1Cancel.includes("+2"));
    const o1Created = await get(cookie, `?orderId=${o1}&reason=order_created`);
    ok("reason=order_created hides the +2 restore row", !o1Created.includes("+2"));

    // Cleanup
    const oids = [o1, o2].filter(Boolean);
    if (oids.length) {
        await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
        await prisma.$executeRaw`DELETE FROM "OrderStatusHistory" WHERE "orderId" = ANY(${oids})`;
        await prisma.order.deleteMany({ where: { id: { in: oids } } });
    }
    await prisma.$executeRaw`DELETE FROM "InventoryMovement" WHERE "productId" = ${product.id}`;
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("harness crashed:", e);
    await prisma.$disconnect();
    process.exit(1);
});
