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
        config: JSON.stringify({
            categories: {},
            colors: {},
            sizes: [],
            priceRanges: [{ id: "x", label: "bad", min: 9000, max: 10 }],
        }),
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

    // --- A1: non-empty image guards + imagePos normalization ----------------
    const beforeA1 = await prisma.slide.count({ where: { page: "home" } });

    await post(cookie, {
        intent: "create",
        name: "E2E single no image",
        type: "single",
        // no image1_url, no file → must be rejected (broken hero otherwise)
    });
    const afterNoImg = await prisma.slide.count({ where: { page: "home" } });
    ok("single slide without image1 is rejected", afterNoImg === beforeA1);

    await post(cookie, {
        intent: "create",
        name: "E2E garbage pos",
        type: "single",
        image1_url: "/pics1cloths/IMG_6201.JPG",
        image1Pos: "garbage; background:url(evil)",
    });
    const garbageSlide = await prisma.slide.findFirst({ where: { name: "E2E garbage pos" } });
    ok(
        "garbage image1Pos is normalized to 'center center'",
        garbageSlide?.image1Pos === "center center",
        garbageSlide?.image1Pos,
    );
    await prisma.slide.deleteMany({ where: { name: "E2E garbage pos" } });

    // Category: empty image must not overwrite the existing one.
    const cat = await prisma.category.create({
        data: {
            title: "E2E cat",
            subtitle: null,
            image: "/pics1cloths/IMG_6201.JPG",
            imagePos: "center center",
            link: "/shop/yoga",
            buttonText: "Переглянути все",
            order: 999,
        },
    });
    await post(cookie, {
        intent: "update_category",
        id: cat.id,
        title: "E2E cat",
        link: "/shop/yoga",
        image_url: "", // cleared client-side, no new file → must be rejected
    });
    const catAfter = await prisma.category.findUnique({ where: { id: cat.id } });
    ok(
        "category update with empty image is rejected (image kept)",
        catAfter?.image === "/pics1cloths/IMG_6201.JPG",
        catAfter?.image,
    );
    await prisma.category.delete({ where: { id: cat.id } });

    // Shop hero: bad heroImagePos falls back to "50% 50% 1".
    const shopBefore = await prisma.shopPage.findUnique({ where: { slug: "yoga" } });
    await post(cookie, {
        intent: "update_shop_page",
        slug: "yoga",
        currentHeroImage: "/pics1cloths/IMG_6201.JPG",
        heroImagePos: "999",
    });
    const shopAfter = await prisma.shopPage.findUnique({ where: { slug: "yoga" } });
    ok(
        "bad heroImagePos falls back to '50% 50% 1'",
        shopAfter?.heroImagePos === "50% 50% 1",
        shopAfter?.heroImagePos,
    );
    if (shopBefore) {
        await prisma.shopPage.update({
            where: { slug: "yoga" },
            data: { heroImage: shopBefore.heroImage, heroImagePos: shopBefore.heroImagePos },
        });
    } else {
        await prisma.shopPage.delete({ where: { slug: "yoga" } });
    }

    // --- SE2: live home preview + editor-mode invariants ---------------------
    // The editor's home view must preview the REAL home page in an iframe.
    const editorHtml = await (
        await fetch(`${BASE}/admin/slides`, {
            headers: { Cookie: cookie, "x-forwarded-for": nextIp() },
        })
    ).text();
    ok(
        "editor home view embeds the live home page (/?editor=1 iframe)",
        editorHtml.includes("/?editor=1"),
    );

    // Edit affordances are editor-iframe-only (client-side): the SSR HTML of
    // /?editor=1 must NOT contain them (real visitors / crawlers never see them).
    const homeEditorRes = await fetch(`${BASE}/?editor=1`, {
        headers: { "x-forwarded-for": nextIp() },
    });
    const homeEditorHtml = await homeEditorRes.text();
    ok(
        "GET /?editor=1 is 200 with no affordance markup in SSR HTML",
        homeEditorRes.status === 200 && !homeEditorHtml.includes("data-editor-affordance"),
        `status=${homeEditorRes.status}`,
    );

    // --- SE4: SiteSetting (contacts) -----------------------------------------
    const CONTACTS = {
        phoneDisplay: "+38 (011) 111-22-33",
        phoneTel: "+380111112233",
        hoursLabel: "Пн–Нд · 8:00–20:00",
        instagramUrl: "https://instagram.com/e2e.test",
        telegramUrl: "https://t.me/e2etest",
        viberPhone: "380111112233",
        whatsappPhone: "380111112233",
    };
    await prisma.$executeRaw`DELETE FROM "SiteSetting" WHERE "key" = 'contacts'`;

    await post(cookie, {
        intent: "update_site_settings",
        key: "contacts",
        value: JSON.stringify(CONTACTS),
    });
    const savedRow =
        await prisma.$queryRaw`SELECT "value" FROM "SiteSetting" WHERE "key" = 'contacts'`;
    ok(
        "valid contacts settings are saved",
        savedRow.length === 1 && JSON.parse(savedRow[0].value).phoneTel === CONTACTS.phoneTel,
    );

    // Saved contacts must actually render on the storefront (footer phone).
    const homeAfterSave = await (
        await fetch(`${BASE}/`, { headers: { "x-forwarded-for": nextIp() } })
    ).text();
    ok("saved contacts render on the storefront", homeAfterSave.includes(CONTACTS.phoneDisplay));

    // Invalid phone must be rejected and the row left unchanged.
    await post(cookie, {
        intent: "update_site_settings",
        key: "contacts",
        value: JSON.stringify({ ...CONTACTS, phoneTel: "not-a-phone" }),
    });
    const afterBadPhone =
        await prisma.$queryRaw`SELECT "value" FROM "SiteSetting" WHERE "key" = 'contacts'`;
    ok(
        "invalid contacts phone is rejected (row unchanged)",
        afterBadPhone.length === 1 &&
            JSON.parse(afterBadPhone[0].value).phoneTel === CONTACTS.phoneTel,
    );

    // Unknown key must not create a row.
    await post(cookie, { intent: "update_site_settings", key: "h4cker", value: "{}" });
    const phantomSetting =
        await prisma.$queryRaw`SELECT 1 FROM "SiteSetting" WHERE "key" = 'h4cker'`;
    ok("unknown settings key is rejected (no row)", phantomSetting.length === 0);

    // Restore the default contacts through the intent (also proves the
    // save → cache-invalidate → render loop end-to-end), then clean up the
    // row — mergeSiteSettings guarantees a missing row = defaults.
    const DEFAULT_CONTACTS = {
        phoneDisplay: "+38 (096) 665-08-55",
        phoneTel: "+380966650855",
        hoursLabel: "Пн–Пт · 9:00–18:00",
        instagramUrl: "https://instagram.com/mindbody.sportwear",
        telegramUrl: "https://t.me/Juliamindbody",
        viberPhone: "380509656737",
        whatsappPhone: "380973542848",
    };
    await post(cookie, {
        intent: "update_site_settings",
        key: "contacts",
        value: JSON.stringify(DEFAULT_CONTACTS),
    });
    const homeRestored = await (
        await fetch(`${BASE}/`, { headers: { "x-forwarded-for": nextIp() } })
    ).text();
    ok(
        "restoring default contacts renders the default phone again",
        homeRestored.includes("+38 (096) 665-08-55"),
    );
    await prisma.$executeRaw`DELETE FROM "SiteSetting" WHERE "key" = 'contacts'`;

    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("crashed:", e.message);
    await prisma.$disconnect();
    process.exit(1);
});
