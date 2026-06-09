// P0 end-to-end verification against the running dev server (port 3001, test DB).
// Drives the REAL HTTP endpoints (route → service → DB) and asserts DB state.
// Distinct x-forwarded-for per request keeps us under the 3/min order rate limit.
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

let ipN = 100;
const nextIp = () => `10.9.${Math.floor(ipN / 256)}.${ipN++ % 256}`;

async function postOrder(o, { idempotencyKey, ip } = {}) {
    const res = await fetch(`${BASE}/api/orders/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip || nextIp(),
        },
        body: JSON.stringify({
            customer: {
                name: "Тест Клієнт",
                email: o.email ?? "p0-test@example.com",
                phone: "+380501112233",
                city: "Київ",
                warehouse: "Відділення №1",
            },
            items: [
                {
                    id: o.productId,
                    name: o.name,
                    price: o.price,
                    quantity: o.qty,
                    size: o.size,
                    color: o.color,
                },
            ],
            total: o.total,
            shippingCost: 0,
            paymentMethod: "cash",
            deliveryMethod: "nova_poshta",
            promoCode: o.promoCode ?? null,
            idempotencyKey: idempotencyKey ?? null,
        }),
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        /* non-json */
    }
    return { status: res.status, json };
}

const stockOf = async (id) =>
    (await prisma.product.findUnique({ where: { id }, select: { stock: true } }))?.stock ?? null;
const variantStock = async (id, size, color) => {
    const p = await prisma.product.findUnique({ where: { id }, select: { inventory: true } });
    const inv = JSON.parse(p?.inventory || "[]");
    return inv.find((v) => (v.size ?? null) === size && (v.color ?? null) === color)?.stock ?? null;
};
// idempotencyKey isn't in the (un-regenerated) client → look it up via raw SQL.
const orderIdByKey = async (key) =>
    (await prisma.$queryRaw`SELECT id FROM "Order" WHERE "idempotencyKey" = ${key} LIMIT 1`)[0]
        ?.id ?? null;
const movementsFor = async (id, reason) =>
    prisma.$queryRaw`SELECT count(*)::int AS n FROM "InventoryMovement" WHERE "productId" = ${id} AND reason = ${reason}`.then(
        (r) => r[0].n,
    );

async function makeProduct({ status, stock, variant }) {
    const inventory = JSON.stringify([variant]);
    return prisma.product.create({
        data: {
            name: `P0 ${status} ${Date.now()}`,
            price: 1000,
            status,
            stock,
            inventory,
            sku: `P0-${status}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            slug: `p0-${status}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            shopPageSlug: "yoga",
            category: "tops",
            colors: JSON.stringify([variant.color]),
            sizes: JSON.stringify([variant.size]),
        },
    });
}

// ---- Admin login (password read from env, never printed) -------------------
async function adminLogin() {
    const body = new URLSearchParams({
        username: process.env.ADMIN_USERNAME || "Admin",
        password: process.env.ADMIN_PASSWORD || "",
    }).toString();
    const res = await fetch(`${BASE}/admin/login`, {
        method: "POST",
        redirect: "manual",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: BASE,
            "x-forwarded-for": nextIp(),
        },
        body,
    });
    const cookies = res.headers.getSetCookie?.() || [];
    const session = cookies.find((c) => c.startsWith("admin_session="));
    return session ? session.split(";")[0] : null;
}

async function adminPost(path, fields, cookie) {
    return fetch(`${BASE}${path}`, {
        method: "POST",
        redirect: "manual",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: BASE,
            Cookie: cookie,
            "x-forwarded-for": nextIp(),
        },
        body: new URLSearchParams(fields).toString(),
    });
}

async function main() {
    console.log(`\n=== P0 E2E against ${BASE} ===\n`);

    // Fixtures
    const active = await makeProduct({
        status: "active",
        stock: 5,
        variant: { size: "M", color: "black", stock: 5 },
    });
    const draft = await makeProduct({
        status: "draft",
        stock: 5,
        variant: { size: "M", color: "black", stock: 5 },
    });
    const last = await makeProduct({
        status: "active",
        stock: 1,
        variant: { size: "M", color: "black", stock: 1 },
    });

    // ---- Scenario A: draft gate ----
    console.log("A. Draft/archived gate");
    const draftPage = await fetch(`${BASE}/product/${draft.id}`);
    ok("GET /product/<draft> returns 404", draftPage.status === 404, `got ${draftPage.status}`);
    const activePage = await fetch(`${BASE}/product/${active.id}`);
    ok("GET /product/<active> returns 200", activePage.status === 200, `got ${activePage.status}`);
    const draftOrder = await postOrder({
        productId: draft.id,
        name: draft.name,
        price: 1000,
        qty: 1,
        size: "M",
        color: "black",
        total: 1000,
    });
    ok(
        "POST order for draft product is rejected",
        draftOrder.json?.success === false,
        JSON.stringify(draftOrder.json),
    );

    // ---- Scenario B: active purchase decrements stock + writes movement ----
    console.log("B. Active purchase → stock decrement + movement");
    const before = await variantStock(active.id, "M", "black");
    const buy = await postOrder({
        productId: active.id,
        name: active.name,
        price: 1000,
        qty: 2,
        size: "M",
        color: "black",
        total: 2000,
    });
    ok("order created", buy.json?.success === true, JSON.stringify(buy.json));
    const afterB = await variantStock(active.id, "M", "black");
    ok("variant stock decremented by 2", afterB === before - 2, `${before} -> ${afterB}`);
    ok("order_created movement written", (await movementsFor(active.id, "order_created")) >= 1);

    // ---- Scenario C: idempotency ----
    console.log("C. Idempotency (same key twice → one order)");
    const key = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sBefore = await variantStock(active.id, "M", "black");
    const r1 = await postOrder(
        {
            productId: active.id,
            name: active.name,
            price: 1000,
            qty: 1,
            size: "M",
            color: "black",
            total: 1000,
        },
        { idempotencyKey: key },
    );
    const r2 = await postOrder(
        {
            productId: active.id,
            name: active.name,
            price: 1000,
            qty: 1,
            size: "M",
            color: "black",
            total: 1000,
        },
        { idempotencyKey: key },
    );
    ok("both responses success", r1.json?.success && r2.json?.success);
    ok(
        "same orderId returned (deduped)",
        String(r1.json?.orderId) === String(r2.json?.orderId),
        `${r1.json?.orderId} vs ${r2.json?.orderId}`,
    );
    ok("2nd response flagged deduped", r2.json?.deduped === true, JSON.stringify(r2.json));
    const orderCount =
        await prisma.$queryRaw`SELECT count(*)::int AS n FROM "Order" WHERE "idempotencyKey" = ${key}`.then(
            (r) => r[0].n,
        );
    ok("exactly ONE order row for the key", orderCount === 1, `count=${orderCount}`);
    const sAfter = await variantStock(active.id, "M", "black");
    ok("stock decremented only ONCE", sAfter === sBefore - 1, `${sBefore} -> ${sAfter}`);

    // ---- Scenario D: oversell on the last unit (concurrency) ----
    console.log("D. Oversell on last unit (2 concurrent → 1 wins)");
    const [d1, d2] = await Promise.all([
        postOrder(
            {
                productId: last.id,
                name: last.name,
                price: 1000,
                qty: 1,
                size: "M",
                color: "black",
                total: 1000,
            },
            { ip: nextIp() },
        ),
        postOrder(
            {
                productId: last.id,
                name: last.name,
                price: 1000,
                qty: 1,
                size: "M",
                color: "black",
                total: 1000,
            },
            { ip: nextIp() },
        ),
    ]);
    const successes = [d1, d2].filter((r) => r.json?.success === true).length;
    const failures = [d1, d2].filter((r) => r.json?.success === false).length;
    ok("exactly one order succeeded", successes === 1, `successes=${successes}`);
    ok("the other was rejected (out of stock)", failures === 1, `failures=${failures}`);
    const lastStock = await variantStock(last.id, "M", "black");
    ok("stock is 0, never negative", lastStock === 0, `stock=${lastStock}`);

    // ---- Scenario E: admin cancel restores stock + guards ----
    console.log("E. Admin cancel restores stock; paid order can't be deleted");
    const cookie = await adminLogin();
    ok("admin login succeeded (session cookie)", Boolean(cookie));
    if (cookie) {
        // Create a fresh order to cancel
        const cancelKey = `cancel-${Date.now()}`;
        const beforeCancel = await variantStock(active.id, "M", "black");
        await postOrder(
            {
                productId: active.id,
                name: active.name,
                price: 1000,
                qty: 1,
                size: "M",
                color: "black",
                total: 1000,
            },
            { idempotencyKey: cancelKey },
        );
        const afterBuy = await variantStock(active.id, "M", "black");
        ok("stock decremented for the to-cancel order", afterBuy === beforeCancel - 1);
        const ordId = await orderIdByKey(cancelKey);
        const cancelRes = await adminPost(`/admin/orders/${ordId}`, { intent: "cancel" }, cookie);
        ok(
            "cancel accepted",
            cancelRes.status < 400 || cancelRes.status === 302,
            `status=${cancelRes.status}`,
        );
        const afterCancel = await variantStock(active.id, "M", "black");
        ok(
            "stock restored after cancel",
            afterCancel === beforeCancel,
            `${beforeCancel} -> ${afterCancel}`,
        );
        ok(
            "order_cancelled movement written",
            (await movementsFor(active.id, "order_cancelled")) >= 1,
        );
        const cancelled = await prisma.order.findUnique({
            where: { id: ordId },
            select: { status: true },
        });
        ok("order status is cancelled", cancelled?.status === "cancelled", cancelled?.status);

        // paid order can't be hard-deleted
        const paidKey = `paid-${Date.now()}`;
        await postOrder(
            {
                productId: active.id,
                name: active.name,
                price: 1000,
                qty: 1,
                size: "M",
                color: "black",
                total: 1000,
            },
            { idempotencyKey: paidKey },
        );
        const paidOrdId = await orderIdByKey(paidKey);
        await prisma.order.update({ where: { id: paidOrdId }, data: { paymentStatus: "paid" } });
        const delRes = await adminPost(`/admin/orders/${paidOrdId}`, { intent: "delete" }, cookie);
        const stillExists = await prisma.order.findUnique({ where: { id: paidOrdId } });
        ok(
            "paid order NOT deleted (guard held)",
            Boolean(stillExists),
            `deleteStatus=${delRes.status}`,
        );

        // ---- Scenario F: order status state-machine ----
        console.log("F. Order status state-machine (legal vs illegal transitions)");
        const fKey = `flow-${Date.now()}`;
        await postOrder(
            {
                productId: active.id,
                name: active.name,
                price: 1000,
                qty: 1,
                size: "M",
                color: "black",
                total: 1000,
            },
            { idempotencyKey: fKey },
        );
        const fId = await orderIdByKey(fKey);
        await adminPost(
            `/admin/orders/${fId}`,
            { intent: "update_status", status: "delivered" },
            cookie,
        );
        let st = (await prisma.order.findUnique({ where: { id: fId }, select: { status: true } }))
            ?.status;
        ok("illegal jump pending->delivered rejected", st === "pending", `status=${st}`);
        await adminPost(
            `/admin/orders/${fId}`,
            { intent: "update_status", status: "confirmed" },
            cookie,
        );
        st = (await prisma.order.findUnique({ where: { id: fId }, select: { status: true } }))
            ?.status;
        ok("legal transition pending->confirmed applied", st === "confirmed", `status=${st}`);
        const histN = (
            await prisma.$queryRaw`SELECT count(*)::int AS n FROM "OrderStatusHistory" WHERE "orderId" = ${fId} AND "toValue" = 'confirmed'`
        )[0].n;
        ok("status-history row written for the transition", histN >= 1, `history=${histN}`);
    }

    // Cleanup fixtures + their orders/movements
    for (const p of [active, draft, last]) {
        const oids = (
            await prisma.order.findMany({
                where: { items: { some: { productId: p.id } } },
                select: { id: true },
            })
        ).map((o) => o.id);
        if (oids.length) {
            await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
            await prisma.$executeRaw`DELETE FROM "OrderStatusHistory" WHERE "orderId" = ANY(${oids})`;
            await prisma.order.deleteMany({ where: { id: { in: oids } } });
        }
        await prisma.$executeRaw`DELETE FROM "InventoryMovement" WHERE "productId" = ${p.id}`;
        await prisma.product.delete({ where: { id: p.id } }).catch(() => {});
    }

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("E2E harness crashed:", e);
    await prisma.$disconnect();
    process.exit(1);
});
