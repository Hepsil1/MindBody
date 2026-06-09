// READ-ONLY admin walkthrough. Logs in (password from env, never printed),
// GETs each admin page with the session cookie, asserts it renders (200, not a
// 302 to /admin/login) and contains an expected content marker. No writes.
//
//   E2E_BASE=https://saleid.icu node -r dotenv/config scripts/_prelaunch_admin_walk.mjs
const BASE = process.env.E2E_BASE || "http://localhost:3000";
let ip = 70;
const nextIp = () => `10.9.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`;

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
    const s = cookies.find((c) => c.startsWith("admin_session="));
    return s ? s.split(";")[0] : null;
}

const PAGES = [
    ["/admin", ["Панель", "Dashboard", "admin", "Огляд"]],
    ["/admin/products", ["Товари", "Product", "Додати"]],
    ["/admin/orders", ["Замовлен", "Order"]],
    ["/admin/categories", ["Категор", "Categor"]],
    ["/admin/inventory", ["Рух", "склад", "Inventory", "журнал"]],
    ["/admin/slides", ["Слайд", "Slide"]],
    ["/admin/shop-pages", ["Сторінк", "Shop", "hero", "Hero"]],
    ["/admin/reviews", ["Відгук", "Review"]],
    ["/admin/promo", ["Промо", "Promo", "код"]],
    ["/admin/customers", ["Клієнт", "Customer"]],
];

async function main() {
    console.log(`\n=== admin walkthrough against ${BASE} ===\n`);
    const cookie = await adminLogin();
    if (!cookie) {
        console.error(
            "❌ admin login failed (no admin_session cookie). Check ADMIN_PASSWORD/USERNAME.",
        );
        process.exit(1);
    }
    console.log("✅ admin login OK (session cookie acquired)\n");
    let pass = 0,
        fail = 0;
    for (const [path, markers] of PAGES) {
        const r = await fetch(`${BASE}${path}`, {
            redirect: "manual",
            headers: { Cookie: cookie, "x-forwarded-for": nextIp() },
        });
        const status = r.status;
        const html = status === 200 ? await r.text() : "";
        const marker = markers.find((m) => html.includes(m));
        const ok = status === 200 && Boolean(marker);
        if (ok) {
            pass++;
            console.log(`  ✅ ${path.padEnd(20)} 200  (${html.length} bytes, marker="${marker}")`);
        } else {
            fail++;
            const loc = r.headers.get("location");
            console.log(
                `  ❌ ${path.padEnd(20)} ${status}${loc ? " → " + loc : ""}  marker=${marker || "NONE"}`,
            );
        }
    }
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => {
    console.error("crashed:", e.message);
    process.exit(1);
});
