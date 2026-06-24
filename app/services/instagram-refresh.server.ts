// Background Instagram refresh — the ONLY place that talks to Instagram.
//
// Instagram's /api/v1/* endpoints HTTP-429 any non-browser request. The one
// thing that works is what a real browser does: RENDER the profile page in
// headless Chromium so the page's OWN JS fetches the data (200, even logged-out)
// and we intercept it.
//
// Two-phase render:
//   Phase 1 (anonymous) — fires web_profile_info → CLEAN counts, bio, external
//     link, avatar, first ~12 posts; DOM gives the real story-highlights row.
//   Phase 2 (logged-in, optional) — scrolls the grid so the page's graphql
//     pagination loads 30-50 posts. Only run when we don't yet have enough
//     cached (after the first deep build, hourly refreshes stay shallow+cheap).
//
// Images are downloaded through the same browser context, INCREMENTALLY — a post
// whose .webp already exists on disk is reused, so hourly refreshes pull only the
// 1-2 genuinely new posts (the proxy is pay-per-GB). Every step is wrapped so a
// failure NEVER wipes the last-good cache. Residential IG_SCRAPE_PROXY required.
import { promises as fs, existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import {
    IG_DIR,
    CACHE_FILE,
    readIgCache,
    setIgMemCache,
    setSessionLikelyExpired,
    type IgCache,
} from "./instagram.server";
import { logger } from "../utils/logger.server";

// ── Constants ─────────────────────────────────────────────────────────
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SHORTCODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // auto-refresh cadence (safe for the server IP)
const NAV_TIMEOUT_MS = 45_000;
const CAPTURE_WAIT_MS = 10_000;
const IMG_TIMEOUT_MS = 20_000;
const TARGET_POSTS = 30; // how many of the NEWEST posts to show in the grid
const SCROLL_ROUNDS = 10; // scroll iterations to collect the newest posts
const MAX_HIGHLIGHTS = 10;

// ── Proxy parsing (Playwright shape) ──────────────────────────────────
interface PwProxy {
    server: string;
    username?: string;
    password?: string;
}
function parseProxy(raw?: string): PwProxy | undefined {
    const v = raw?.trim();
    if (!v) return undefined;
    try {
        const u = new URL(v);
        return {
            server: `${u.protocol}//${u.host}`,
            username: u.username ? decodeURIComponent(u.username) : undefined,
            password: u.password ? decodeURIComponent(u.password) : undefined,
        };
    } catch {
        logger.warn("[ig-refresh] IG_SCRAPE_PROXY is not a valid URL — ignoring");
        return undefined;
    }
}

async function loadChromium() {
    const mod = "playwright";
    const pw = (await import(/* @vite-ignore */ mod)) as typeof import("playwright");
    return pw.chromium;
}

// Stable, filename-safe key from a (possibly Cyrillic) highlight title.
function slugify(title: string): string {
    let h = 5381;
    for (let i = 0; i < title.length; i++) h = ((h << 5) + h + title.charCodeAt(i)) >>> 0;
    return h.toString(16);
}
// Cheap content hash (sampled) — used to give the avatar a content-addressed
// filename so a changed avatar writes a NEW file instead of overwriting one the
// server may be streaming.
function hashBuf(buf: Buffer): string {
    let h = 5381;
    for (let i = 0; i < buf.length; i += 997) h = ((h << 5) + h + buf[i]) >>> 0;
    return h.toString(16);
}

// ── Recursive post collector — works across web_profile_info AND the various
// graphql/feed pagination shapes (edge_owner_to_timeline_media nodes,
// xdt_api timeline connection nodes, etc.). ───────────────────────────
interface RawPost {
    code: string;
    isVideo: boolean;
    thumb: string | null;
}
function walk(o: any, cb: (o: any) => void) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, cb));
    cb(o);
    for (const k in o) walk(o[k], cb);
}
function addEdges(edges: any, map: Map<string, RawPost>) {
    if (!Array.isArray(edges)) return;
    for (const e of edges) {
        const n = e?.node || e;
        if (!n || typeof n !== "object") continue;
        const code: string | undefined = n.code || n.shortcode;
        if (
            !code ||
            typeof code !== "string" ||
            !/^[A-Za-z0-9_-]{5,20}$/.test(code) ||
            map.has(code)
        )
            continue;
        let thumb: string | null = n.thumbnail_src || n.display_url || null;
        if (
            !thumb &&
            Array.isArray(n.image_versions2?.candidates) &&
            n.image_versions2.candidates.length
        ) {
            const c = n.image_versions2.candidates;
            thumb =
                (c.find((x: any) => x.width >= 600 && x.width <= 820) || c[c.length - 1])?.url ||
                null;
        }
        if (!thumb) continue;
        const isVideo = !!(n.is_video || n.media_type === 2 || n.product_type === "clips");
        map.set(code, { code, isVideo, thumb });
    }
}
// ONLY the main grid timeline (recent→old order preserved). We deliberately skip
// edge_felix_video_timeline (the separate older reels tab) which otherwise floods
// the front of the feed with stale clips.
function collectTimeline(json: any, map: Map<string, RawPost>) {
    walk(json, (o) => {
        if (o.edge_owner_to_timeline_media?.edges)
            addEdges(o.edge_owner_to_timeline_media.edges, map);
        for (const k in o) {
            if (/timeline.*connection|connection.*timeline/i.test(k) && o[k]?.edges)
                addEdges(o[k].edges, map);
        }
    });
}

function mapMeta(u: any) {
    return {
        username: u.username as string,
        fullName: (u.full_name as string) || "",
        biography: (u.biography as string) || "",
        externalUrl: (u.external_url as string) || "",
        profilePicUrl: (u.profile_pic_url_hd || u.profile_pic_url) as string,
        postsCount: u.edge_owner_to_timeline_media?.count as number,
        followersCount: u.edge_followed_by?.count as number,
        followingCount: u.edge_follow?.count as number,
    };
}
type Meta = ReturnType<typeof mapMeta>;

// ── Render the profile → capture meta + posts + highlights + image buffers ──
interface RenderResult {
    ok: boolean;
    status: number;
    meta: Meta | null;
    posts: { code: string; isVideo: boolean; buf: Buffer | null }[]; // buf null = reuse cached file
    highlights: { title: string; slug: string; buf: Buffer | null }[]; // buf null = reuse cached
    avatarBuf: Buffer | null;
    triedSession: boolean;
}

// IMPORTANT: the evaluate callback must contain NO named inner functions and NO
// for-of loops. The bundler (keepNames / downlevel-iteration) emits module-scoped
// helpers (`__name`, `__values`) for those, and Playwright serializes ONLY this
// function — so any such helper is undefined in the page and the whole evaluate
// throws (which `.catch` then hides as "no highlights"). Plain for-loops only.
async function readHighlights(page: any): Promise<{ title: string; cover: string }[]> {
    return await page.evaluate(() => {
        const out: { title: string; cover: string }[] = [];
        const seen: Record<string, number> = {};
        const sels = ['a[href*="/stories/highlights/"]', "ul li"];
        for (let s = 0; s < sels.length && out.length === 0; s++) {
            const roots = [].slice.call(document.querySelectorAll(sels[s])) as Element[];
            for (let r = 0; r < roots.length; r++) {
                const img = roots[r].querySelector("img") as HTMLImageElement | null;
                if (!img) continue;
                // The label is a LEAF node with text — NOT the first span (often an
                // empty icon wrapper). Scan leaves for the first short text run.
                const leaves = [].slice.call(roots[r].querySelectorAll("span, div")) as Element[];
                let title = "";
                for (let i = 0; i < leaves.length && !title; i++) {
                    if (leaves[i].children.length === 0) {
                        const t = (leaves[i].textContent || "").replace(/\s+/g, " ").trim();
                        if (t && t.length <= 30) title = t;
                    }
                }
                title = title.replace(/^Story highlight:?\s*/i, "").trim();
                const cover = img.getAttribute("src") || img.src || "";
                if (title && cover && !seen[title]) {
                    seen[title] = 1;
                    out.push({ title, cover });
                }
            }
        }
        return out.slice(0, 12);
    });
}

// Read counts/bio/avatar/external-link from the LOGGED-IN profile header DOM.
// This is the proxy-less path: the anonymous web_profile_info API is IP-blocked
// from a flagged server IP, but the logged-in render works — so we scrape the
// rendered header instead. Same __name/for-of constraints as readHighlights.
async function readDomMeta(page: any, target: string): Promise<Meta | null> {
    const m = await page
        .evaluate((t: string) => {
            const header = document.querySelector("header");
            if (!header) return null;
            // counts: posts, followers, following (in order). Followers is shown
            // abbreviated ("67,1 тис.") but the exact value is in a span[title].
            // Counts: parse the visible "<n> публікації / <n> підписники / <n>
            // підписки" labels (highlight bubbles like "ВІДГУКИ 11" live in <li> too,
            // so we must NOT just read <li> numbers). Followers is abbreviated → take
            // the exact value from its span[title].
            const htext = header.innerText || "";
            const sp = "[\\d.,\\u00a0\\u202f ]+";
            let postsCount = 0;
            let followersCount = 0;
            let followingCount = 0;
            // posts — number-first ("2 240 дописів") then label-first fallback.
            let mm = htext.match(
                new RegExp("(" + sp + ")\\s*(?:публікац\\w*|допис\\w*|posts|публикац\\w*)", "i"),
            );
            if (!mm)
                mm = htext.match(
                    new RegExp(
                        "(?:публікац\\w*|допис\\w*|posts|публикац\\w*)\\s*:?\\s*(" + sp + ")",
                        "i",
                    ),
                );
            if (mm) postsCount = parseInt(mm[1].replace(/[^\d]/g, ""), 10) || 0;
            // following — logged-in is label-first ("Стежить: 1 269"); logged-out
            // is number-first ("1 269 підписки").
            // \\w does NOT match Cyrillic in JS regex, so to skip the label's tail
            // (e.g. "Стежить: ") use [^\\d]{0,15} between the label prefix and number.
            mm = htext.match(new RegExp("(?:Стеж|Подписк|following)[^\\d]{0,15}(" + sp + ")", "i"));
            if (!mm)
                mm = htext.match(
                    new RegExp("(" + sp + ")\\s*(?:підписки|following|подписок)", "i"),
                );
            if (mm) followingCount = parseInt(mm[1].replace(/[^\d]/g, ""), 10) || 0;
            // followers — exact from span[title]; else "Читачі: <n>" / "<n> підписники".
            const ts = header.querySelector("span[title]");
            if (ts)
                followersCount =
                    parseInt((ts.getAttribute("title") || "").replace(/[^\d]/g, ""), 10) || 0;
            if (!followersCount) {
                mm = htext.match(
                    new RegExp("(?:Чита|Подписчик|followers)[^\\d]{0,15}(" + sp + ")", "i"),
                );
                if (!mm)
                    mm = htext.match(
                        new RegExp("(" + sp + ")\\s*(?:підписник|followers|подписчик)", "i"),
                    );
                if (mm) followersCount = parseInt(mm[1].replace(/[^\d]/g, ""), 10) || 0;
            }
            if (!postsCount || !followersCount || !followingCount) return null;
            const nameEl = header.querySelector("h1, h2");
            const fullName = nameEl ? (nameEl.textContent || "").trim() : "";
            // bio: the header element with >=2 @mentions (or a newline + a mention),
            // shortest such (most specific) so we grab the bio, not a parent block.
            // Pick the element with the MOST @mentions (the full bio container that
            // wraps every line), tie-broken by shortest — so we don't grab a partial
            // sub-line (which truncated the bio at "KIDS") nor a huge parent.
            let biography = "";
            let bestMc = 0;
            const cand = [].slice.call(header.querySelectorAll("span, div")) as HTMLElement[];
            for (let i = 0; i < cand.length; i++) {
                const it = (cand[i].innerText || "").trim();
                const mc = (it.match(/@/g) || []).length;
                const ok =
                    (mc >= 2 || (it.indexOf("\n") >= 0 && mc >= 1)) &&
                    it.length >= 25 &&
                    it.length <= 600;
                if (ok && (mc > bestMc || (mc === bestMc && it.length < biography.length))) {
                    bestMc = mc;
                    biography = it;
                }
            }
            biography = biography.replace(/\s*(більше|more|ещё|ще)\s*$/i, "").trim();
            // external link is wrapped via l.instagram.com/?u=<encoded-real-url>
            let externalUrl = "";
            const links = [].slice.call(header.querySelectorAll("a")) as HTMLAnchorElement[];
            for (let i = 0; i < links.length; i++) {
                const h = links[i].getAttribute("href") || "";
                const mu = h.match(/[?&]u=([^&]+)/);
                if (h.indexOf("l.instagram.com") >= 0 && mu) {
                    externalUrl = decodeURIComponent(mu[1]);
                    break;
                }
                if (/^https?:\/\//i.test(h) && h.indexOf("instagram.com") < 0) {
                    externalUrl = h;
                    break;
                }
            }
            // last resort: a t.me / bare URL written in the bio text itself
            if (!externalUrl) {
                const bm = (header.innerText || "").match(
                    /\b(?:https?:\/\/)?(?:t\.me|[\w-]+\.[a-z]{2,})\/[\w./?=#-]+/i,
                );
                if (bm) externalUrl = bm[0].indexOf("http") === 0 ? bm[0] : "https://" + bm[0];
            }
            const av = header.querySelector("img");
            return {
                username: t,
                fullName: fullName,
                biography: biography,
                externalUrl: externalUrl,
                profilePicUrl: av ? av.getAttribute("src") || "" : "",
                postsCount: postsCount,
                followersCount: followersCount,
                followingCount: followingCount,
            };
        }, target)
        .catch(() => null);
    return m as Meta | null;
}

async function renderWebProfile(
    target: string,
    sessionid: string | undefined,
    proxy: string | undefined,
    deep: boolean,
    prevPosts: IgCache["posts"],
): Promise<RenderResult> {
    const chromium = await loadChromium();
    const profileUrl = `https://www.instagram.com/${target}/`;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    const empty: RenderResult = {
        ok: false,
        status: 0,
        meta: null,
        posts: [],
        highlights: [],
        avatarBuf: null,
        triedSession: false,
    };

    try {
        browser = await chromium.launch({
            headless: true,
            proxy: parseProxy(proxy),
            timeout: NAV_TIMEOUT_MS,
            args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        });
        const ctxOpts = {
            userAgent: UA,
            locale: "uk-UA",
            viewport: { width: 1366, height: 1200 },
            extraHTTPHeaders: { "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8" },
        };
        const stealth = () =>
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });

        const postMap = new Map<string, RawPost>();
        let meta: Meta | null = null; // from the anon web_profile_info API (needs proxy)
        let domMeta: Meta | null = null; // from the logged-in header DOM (proxy-less path)
        let status = 0;
        let triedSession = false;
        let rawHighlights: { title: string; cover: string }[] = [];
        let dlCtx: any = null; // context used for image downloads (proxy is browser-level)

        // ── Logged-in FIRST, on its own cold page so IG's SPA renders the full
        // profile — the story-highlights tray ONLY appears authenticated, and the
        // grid pagination loads as we deep-scroll. Done before the anonymous pass so
        // an anon retry can't rate-limit (and break) this render.
        if (sessionid) {
            triedSession = true;
            try {
                const ctxAuth = await browser.newContext(ctxOpts);
                await ctxAuth.addInitScript(stealth);
                await ctxAuth.addCookies([
                    {
                        name: "sessionid",
                        value: decodeURIComponent(sessionid),
                        domain: ".instagram.com",
                        path: "/",
                        httpOnly: true,
                        secure: true,
                    },
                ]);
                const pAuth = await ctxAuth.newPage();
                // NO route handler: a catch-all route (even continue()) breaks IG's
                // SPA profile render, so the highlights tray never appears.
                pAuth.on("response", async (res: any) => {
                    const url = res.url();
                    if (
                        !url.includes("/api/graphql") &&
                        !url.includes("graphql/query") &&
                        !url.includes("/feed/user")
                    )
                        return;
                    try {
                        collectTimeline(await res.json(), postMap);
                    } catch {
                        /* not it */
                    }
                });
                await pAuth.goto(profileUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: NAV_TIMEOUT_MS,
                });
                await pAuth.waitForTimeout(6000); // let the highlights tray render
                rawHighlights = await readHighlights(pAuth).catch(() => []);
                // Expand a "… більше"/more-collapsed bio so the DOM has every line
                // (the logged-in view truncates long bios behind a toggle).
                await pAuth
                    .locator("header")
                    .getByText(/^(більше|ещё|еще|more)$/i)
                    .first()
                    .click({ timeout: 1500 })
                    .catch(() => {});
                await pAuth.waitForTimeout(300);
                domMeta = await readDomMeta(pAuth, target); // proxy-less meta source
                // Always scroll enough to collect the NEWEST target posts (no proxy
                // → bandwidth is free); scroll a bit deeper on a cold build.
                const want = TARGET_POSTS + (deep ? 8 : 5);
                for (let i = 0; i < SCROLL_ROUNDS && postMap.size < want; i++) {
                    await pAuth.mouse.wheel(0, 6000);
                    await pAuth.waitForTimeout(1400);
                }
                dlCtx = ctxAuth;
            } catch (e) {
                logger.warn({ err: String(e) }, "[ig-refresh] logged-in render failed");
            }
        }

        // ── Anonymous web_profile_info — the CLEANEST meta source, but the API is
        // IP-blocked from a flagged server IP, so we only attempt it when a proxy is
        // configured. Without a proxy we fall back to domMeta (logged-in header DOM).
        const ctxAnon = await browser.newContext(ctxOpts);
        await ctxAnon.addInitScript(stealth);
        const pAnon = await ctxAnon.newPage();
        await pAnon.route("**/*", (route: any) => {
            const t = route.request().resourceType();
            return t === "image" || t === "media" || t === "font"
                ? route.abort()
                : route.continue();
        });
        pAnon.on("response", async (res: any) => {
            if (!res.url().includes("web_profile_info")) return;
            try {
                const u = (await res.json())?.data?.user;
                if (u?.edge_followed_by) {
                    meta = mapMeta(u);
                    collectTimeline(u, postMap);
                }
            } catch {
                /* not it */
            }
        });
        for (let attempt = 0; proxy && attempt < 2 && !meta; attempt++) {
            try {
                const resp = await pAnon.goto(profileUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: NAV_TIMEOUT_MS,
                });
                status = resp?.status() ?? status;
            } catch (e) {
                logger.warn({ err: String(e), attempt }, "[ig-refresh] anon goto failed");
            }
            for (const until = Date.now() + CAPTURE_WAIT_MS; !meta && Date.now() < until; ) {
                await pAnon.waitForTimeout(600);
            }
        }
        if (!dlCtx) dlCtx = ctxAnon;

        // Proxy-less path: the anon API gave nothing → use the logged-in DOM meta.
        if (!meta) meta = domMeta;
        if (!meta) return { ...empty, status, triedSession };

        // Final post order: fresh (recent-first) then previously-cached (older), capped.
        // Newest-first from THIS render (the grid is reverse-chronological). Fall
        // back to the previous cache ONLY if this render somehow got fewer than the
        // target — so the feed is "stably the newest 30", never padded with stale.
        const order: RawPost[] = [];
        const seen = new Set<string>();
        for (const p of postMap.values()) {
            if (!seen.has(p.code) && SHORTCODE_RE.test(p.code)) {
                seen.add(p.code);
                order.push(p);
            }
        }
        if (order.length < TARGET_POSTS) {
            for (const p of prevPosts || []) {
                if (order.length >= TARGET_POSTS) break;
                if (!seen.has(p.id) && SHORTCODE_RE.test(p.id)) {
                    seen.add(p.id);
                    order.push({ code: p.id, isVideo: !!p.isVideo, thumb: null });
                }
            }
        }
        const finalPosts = order.slice(0, TARGET_POSTS);

        // Download (incremental) through the same context/proxy/IP.
        const dl = async (u?: string | null): Promise<Buffer | null> => {
            if (!u) return null;
            try {
                const r = await dlCtx.request.get(u, {
                    timeout: IMG_TIMEOUT_MS,
                    headers: { Referer: "https://www.instagram.com/" },
                });
                return r.ok() ? Buffer.from(await r.body()) : null;
            } catch {
                return null;
            }
        };

        const posts: RenderResult["posts"] = [];
        for (const p of finalPosts) {
            const cached = existsSync(path.join(IG_DIR, `${p.code}.webp`));
            if (cached) {
                posts.push({ code: p.code, isVideo: p.isVideo, buf: null }); // reuse
                continue;
            }
            const buf = await dl(p.thumb);
            if (buf) posts.push({ code: p.code, isVideo: p.isVideo, buf });
        }

        const avatarBuf = await dl(meta!.profilePicUrl);

        const highlights: RenderResult["highlights"] = [];
        for (const h of rawHighlights.slice(0, MAX_HIGHLIGHTS)) {
            const slug = slugify(h.title);
            if (existsSync(path.join(IG_DIR, `hl_${slug}.webp`))) {
                highlights.push({ title: h.title, slug, buf: null }); // reuse cached cover
                continue;
            }
            const buf = await dl(h.cover);
            if (buf) highlights.push({ title: h.title, slug, buf });
        }

        return { ok: true, status, meta, posts, highlights, avatarBuf, triedSession };
    } finally {
        await browser?.close().catch(() => {});
    }
}

// ── Image buffer → master .webp + -400w.webp (webp-only; grid never asks AVIF) ──
async function processIgImage(buf: Buffer, base: string, masterWidth = 1080): Promise<void> {
    await sharp(buf)
        .resize({ width: masterWidth, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(IG_DIR, `${base}.webp`));
    await sharp(buf)
        .resize({ width: 400, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(IG_DIR, `${base}-400w.webp`));
}

async function pruneOldImages(keep: Set<string>): Promise<void> {
    try {
        const files = await fs.readdir(IG_DIR);
        for (const f of files) {
            if (f === "ig-cache.json" || f === ".gitkeep") continue;
            const base = f.replace(/(-\d{3,4}w)?\.(webp|avif)$/i, "");
            if (!keep.has(base)) await fs.unlink(path.join(IG_DIR, f)).catch(() => {});
        }
    } catch (e) {
        logger.warn({ err: String(e) }, "[ig-refresh] prune failed (non-fatal)");
    }
}

// ── Run state ─────────────────────────────────────────────────────────
let running = false;
let lastRunAt = 0;
let backoffN = 0;
let nextNormalDelayMs = REFRESH_INTERVAL_MS;
function backoffMs(): number {
    return Math.min(HOUR_MS, Math.pow(2, backoffN) * 5 * 60 * 1000);
}

export interface RefreshResult {
    ok: boolean;
    skipped?: string;
    fetchedAt?: string;
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
    postsShown?: number;
    highlights?: number;
    sessionLikelyExpired?: boolean;
    error?: string;
}

/** The single entry point. Locked, rate-floored, never throws to the caller. */
export async function runRefresh(): Promise<RefreshResult> {
    if (process.env.IG_SCRAPE_ENABLED !== "true") return { ok: false, skipped: "disabled" };
    if (running) return { ok: false, skipped: "in-progress" };
    if (Date.now() - lastRunAt < MIN_INTERVAL_MS) return { ok: false, skipped: "rate-floor" };

    running = true;
    lastRunAt = Date.now();
    const proxy = process.env.IG_SCRAPE_PROXY || undefined;
    const sessionid = process.env.IG_SCRAPE_SESSIONID?.trim() || undefined;
    const target = process.env.IG_SCRAPE_TARGET || "mindbody_sportwear";

    try {
        const prev = await readIgCache();
        const deep = (prev?.posts?.length ?? 0) < TARGET_POSTS;
        const r = await renderWebProfile(target, sessionid, proxy, deep, prev?.posts ?? []);

        if (!r.ok || !r.meta) {
            backoffN = Math.min(backoffN + 1, 6);
            if (r.triedSession) setSessionLikelyExpired(true);
            logger.warn(
                { status: r.status, attempt: backoffN, willRetryInMs: backoffMs() },
                "[ig-refresh] no profile captured — keeping last-good",
            );
            return { ok: false, skipped: `no-data-${r.status}` };
        }

        const m = r.meta;
        if (![m.postsCount, m.followersCount, m.followingCount].every((n) => Number.isFinite(n))) {
            backoffN = Math.min(backoffN + 1, 6);
            return { ok: false, skipped: "bad-shape" };
        }

        await fs.mkdir(IG_DIR, { recursive: true });

        const posts: IgCache["posts"] = [];
        for (const p of r.posts) {
            try {
                if (p.buf) await processIgImage(p.buf, p.code);
                else if (!existsSync(path.join(IG_DIR, `${p.code}.webp`))) continue;
                posts.push({
                    id: p.code,
                    mediaUrl: `/instagram/${p.code}.webp`,
                    permalink: `https://www.instagram.com/p/${p.code}/`,
                    isVideo: p.isVideo,
                });
            } catch (e) {
                logger.warn({ code: p.code, err: String(e) }, "[ig-refresh] post image failed");
            }
        }
        if (posts.length < 1) {
            backoffN = Math.min(backoffN + 1, 6);
            return { ok: false, skipped: "no-images" };
        }

        const highlights: IgCache["highlights"] = [];
        for (const h of r.highlights) {
            try {
                if (h.buf) await processIgImage(h.buf, `hl_${h.slug}`, 320);
                else if (!existsSync(path.join(IG_DIR, `hl_${h.slug}.webp`))) continue;
                highlights.push({
                    id: h.slug,
                    title: h.title,
                    cover: `/instagram/hl_${h.slug}.webp`,
                });
            } catch (e) {
                logger.warn(
                    { title: h.title, err: String(e) },
                    "[ig-refresh] highlight image failed",
                );
            }
        }

        // Avatar: content-addressed filename → never overwrite a file the server
        // may be streaming (kills the Windows write race), and skip if unchanged.
        let profilePictureUrl = prev?.profilePictureUrl || "/logo-sun.png";
        if (r.avatarBuf) {
            try {
                const base = `avatar_${hashBuf(r.avatarBuf)}`;
                if (!existsSync(path.join(IG_DIR, `${base}.webp`)))
                    await processIgImage(r.avatarBuf, base, 320);
                profilePictureUrl = `/instagram/${base}.webp`;
            } catch (e) {
                logger.warn({ err: String(e) }, "[ig-refresh] avatar failed, keeping previous");
            }
        }

        const next: IgCache = {
            ok: true,
            fetchedAt: new Date().toISOString(),
            username: m.username || target,
            fullName: m.fullName,
            biography: m.biography,
            externalUrl: m.externalUrl,
            profilePictureUrl,
            postsCount: m.postsCount,
            followersCount: m.followersCount,
            followingCount: m.followingCount,
            highlights,
            posts,
        };
        const tmp = CACHE_FILE + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(next));
        await fs.rename(tmp, CACHE_FILE);
        setIgMemCache(next);
        setSessionLikelyExpired(false);

        const keep = new Set<string>(posts.map((p) => p.id));
        highlights.forEach((h) => keep.add(`hl_${h.id}`));
        if (profilePictureUrl.startsWith("/instagram/"))
            keep.add(profilePictureUrl.slice("/instagram/".length).replace(/\.webp$/, ""));
        await pruneOldImages(keep);

        backoffN = 0;
        nextNormalDelayMs = REFRESH_INTERVAL_MS;
        logger.info(
            {
                followers: m.followersCount,
                following: m.followingCount,
                postsShown: posts.length,
                highlights: highlights.length,
                deep,
            },
            "[ig-refresh] ok",
        );
        return {
            ok: true,
            fetchedAt: next.fetchedAt,
            postsCount: m.postsCount,
            followersCount: m.followersCount,
            followingCount: m.followingCount,
            postsShown: posts.length,
            highlights: highlights.length,
        };
    } catch (err) {
        backoffN = Math.min(backoffN + 1, 6);
        logger.warn(
            { err: String(err), attempt: backoffN },
            "[ig-refresh] failed, keeping last-good",
        );
        return { ok: false, error: "refresh-failed" };
    } finally {
        running = false;
    }
}

// ── Scheduler (boot + hourly, double-start guarded) ───────────────────
let started = false;
export function startInstagramScheduler(): void {
    const g = globalThis as unknown as { __igSchedulerStarted?: boolean };
    if (started || g.__igSchedulerStarted) return;

    if (process.env.IG_SCRAPE_ENABLED !== "true") {
        logger.info("[ig-refresh] disabled (IG_SCRAPE_ENABLED!=true) — using hardcoded fallback");
        return;
    }
    if (!process.env.IG_SCRAPE_PROXY?.trim()) {
        logger.warn(
            "[ig-refresh] enabled but IG_SCRAPE_PROXY is empty — refreshes will fail; fallback stays.",
        );
    }
    started = true;
    g.__igSchedulerStarted = true;

    const bootJitter = Math.floor(Math.random() * 5000);
    const boot = setTimeout(() => void runRefresh(), 25_000 + bootJitter);
    boot.unref?.();

    const tick = () => {
        void runRefresh().finally(() => {
            const delay = backoffN > 0 ? backoffMs() : nextNormalDelayMs;
            const t = setTimeout(tick, delay);
            t.unref?.();
        });
    };
    const first = setTimeout(tick, nextNormalDelayMs);
    first.unref?.();
}
