// Site editor (/admin/slides) data-integrity verification against a running dev
// server + test DB. Drives the real action via admin-auth'd POSTs and asserts DB
// state (the action returns { error } rather than throwing, so we check what was
// actually persisted). Read ADMIN_PASSWORD from env, never print it.
//
//   DATABASE_URL=<test> E2E_BASE=http://localhost:3001 node -r dotenv/config scripts/site-editor-e2e.mjs
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
let ipN = 40;
const nextIp = () => `10.7.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;

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
    const s = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith("admin_session="));
    return s ? s.split(";")[0] : null;
}

async function post(cookie, fields) {
    return fetch(`${BASE}/admin/slides`, {
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

const VALID_CFG = JSON.stringify({
    categories: { jumpsuit: "Комбінезони" },
    colors: { black: "Чорний" },
    sizes: ["S", "M", "L"],
    priceRanges: [{ id: "low", label: "До 1000", min: 0, max: 1000 }],
});

async function main() {
    console.log(`\n=== site-editor data-integrity against ${BASE} ===\n`);
    const cookie = await adminLogin();
    if (!cookie) {
        console.error("❌ admin login failed");
        process.exit(1);
    }

    // --- Filter config validation (pageSlug 'yoga') -----------------------
    await prisma.filterConfig.deleteMany({ where: { id: "yoga" } });

    await post(cookie, { intent: "update_filters", pageSlug: "yoga", config: VALID_CFG });
    const afterValid = await prisma.filterConfig.findUnique({ where: { id: "yoga" } });
    ok("valid filter config is saved", afterValid?.config === VALID_CFG);

    await post(cookie, { intent: "update_filters", pageSlug: "yoga", config: "{not valid json" });
    const afterBadJson = await prisma.filterConfig.findUnique({ where: { id: "yoga" } });
    ok(
        "malformed JSON is rejected (row unchanged)",
        afterBadJson?.config === VALID_CFG,
        afterBadJson?.config,
    );

    await post(cookie, {
        intent: "update_filters",
        pageSlug: "yoga",
        config: JSON.stringify({ categories: {}, colors: {}, sizes: [], priceRanges: [{ id: "x", label: "bad", min: 9000, max: 10 }] }),
    });
    const afterBadRange = await prisma.filterConfig.findUnique({ where: { id: "yoga" } });
    ok("price range min>max is rejected (row unchanged)", afterBadRange?.config === VALID_CFG);

    await post(cookie, { intent: "update_filters", pageSlug: "h4cker", config: VALID_CFG });
    const phantom = await prisma.filterConfig.findUnique({ where: { id: "h4cker" } });
    ok("unknown pageSlug is rejected (no phantom row)", phantom === null);

    await prisma.filterConfig.deleteMany({ where: { id: "yoga" } });

    // --- Triptych slide validation ---------------------------------------
    const before = await prisma.slide.count({ where: { page: "home" } });

    await post(cookie, {
        intent: "create",
        name: "E2E triptych missing imgs",
        type: "triptych",
        image1_url: "/pics1cloths/IMG_6201.JPG",
        // no image2_url / image3_url → must be rejected
    });
    const afterBadTrip = await prisma.slide.count({ where: { page: "home" } });
    ok("triptych without image2/3 is rejected (no slide created)", afterBadTrip === before);

    await post(cookie, {
        intent: "create",
        name: "E2E triptych ok",
        type: "triptych",
        image1_url: "/pics1cloths/IMG_6201.JPG",
        image2_url: "/pics1cloths/IMG_6203.JPG",
        image3_url: "/pics1cloths/IMG_6204.JPG",
    });
    const afterGoodTrip = await prisma.slide.count({ where: { page: "home" } });
    ok("valid triptych (3 images) is created", afterGoodTrip === before + 1);

    // cleanup the test slide
    await prisma.slide.deleteMany({ where: { name: "E2E triptych ok" } });

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("crashed:", e.message);
    await prisma.$disconnect();
    process.exit(1);
});
