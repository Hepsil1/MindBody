// /admin/categories CRUD verification against the running dev server (test DB).
// Drives the real route (auth + multipart upload + raw-SQL writes) and asserts DB.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

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
let ipN = 50;
const nextIp = () => `10.7.0.${ipN++ % 250}`;

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
    const cs = r.headers.getSetCookie?.() || [];
    const s = cs.find((c) => c.startsWith("admin_session="));
    return s ? s.split(";")[0] : null;
}

const catByTitle = async (t) =>
    (
        await prisma.$queryRaw`SELECT id, image, "moodType", "order" FROM "Category" WHERE title = ${t} LIMIT 1`
    )[0] || null;

async function createCat(cookie, title) {
    const png = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 5, g: 6, b: 7 } },
    })
        .png()
        .toBuffer();
    const fd = new FormData();
    fd.set("intent", "create");
    fd.set("title", title);
    fd.set("link", "/shop/yoga");
    fd.set("imagePos", "center center");
    fd.set("moodType", "yoga");
    fd.set("buttonText", "Дивитись");
    fd.set("imageFile", new Blob([new Uint8Array(png)], { type: "image/png" }), "c.png");
    return fetch(`${BASE}/admin/categories`, {
        method: "POST",
        redirect: "manual",
        headers: { Cookie: cookie, Origin: BASE, "x-forwarded-for": nextIp() },
        body: fd,
    });
}

const form = (cookie, fields) =>
    fetch(`${BASE}/admin/categories`, {
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
    console.log(`\n=== /admin/categories CRUD against ${BASE} ===\n`);
    const cookie = await login();
    ok("admin login", Boolean(cookie));
    if (!cookie) {
        await prisma.$disconnect();
        process.exit(1);
    }

    const page = await fetch(`${BASE}/admin/categories`, { headers: { Cookie: cookie } });
    const html = await page.text();
    ok(
        "GET /admin/categories renders",
        page.status === 200 && html.includes("Категорії головної"),
        `status=${page.status}`,
    );

    const A = "E2E Cat AAA",
        B = "E2E Cat BBB";
    await createCat(cookie, A);
    await createCat(cookie, B);
    const a = await catByTitle(A);
    const b = await catByTitle(B);
    ok("create inserted both categories", Boolean(a) && Boolean(b));
    ok(
        "uploaded image is re-encoded to .webp + moodType saved",
        a && /\.webp$/.test(a.image) && a.moodType === "yoga",
        JSON.stringify(a),
    );
    ok(
        "appended in order (A before B)",
        a && b && Number(a.order) < Number(b.order),
        `${a?.order} < ${b?.order}`,
    );

    // reorder B up → B should now sort before A
    await form(cookie, { intent: "reorder", id: b.id, direction: "up" });
    const a2 = await catByTitle(A);
    const b2 = await catByTitle(B);
    ok(
        "reorder up swaps B above A",
        Number(b2.order) < Number(a2.order),
        `B=${b2.order} A=${a2.order}`,
    );

    // delete both
    await form(cookie, { intent: "delete", id: a.id });
    await form(cookie, { intent: "delete", id: b.id });
    ok("delete removed both", !(await catByTitle(A)) && !(await catByTitle(B)));

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("harness crashed:", e);
    await prisma.$disconnect();
    process.exit(1);
});
