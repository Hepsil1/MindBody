// Background Instagram refresh — the ONLY place that talks to Instagram.
// Flow: fetch web_profile_info (sessionid + optional proxy) → download the
// latest thumbnails + avatar server-side → generate the responsive variants the
// iPhone grid already expects → atomically swap the cache file → prune. Every
// step is wrapped so a failure NEVER wipes the last-good cache; the page keeps
// rendering whatever last succeeded (or the hardcoded fallback). Low volume:
// one run on boot, then ~hourly, with exponential backoff on 429/4xx.
//
// NOTE: this VPS's bare IP is already HTTP 429'd by Instagram on /api/v1/*, so a
// residential/mobile IG_SCRAPE_PROXY is required for a real fetch to succeed.
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { generateUploadVariants } from "../utils/image-variants.server";
import {
    IG_DIR,
    CACHE_FILE,
    setIgMemCache,
    setSessionLikelyExpired,
    type IgCache,
} from "./instagram.server";
import { logger } from "../utils/logger.server";

// ── Constants ─────────────────────────────────────────────────────────
const IG_APP_ID = "936619743392459"; // public web app id
const ENDPOINT = "https://www.instagram.com/api/v1/users/web_profile_info/?username=";
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SHORTCODE_RE = /^[A-Za-z0-9_-]{1,64}$/; // path-traversal guard
const MIN_INTERVAL_MS = 5 * 60 * 1000; // never-hammer hard floor
const HOUR_MS = 60 * 60 * 1000;

// Resolve undici's ProxyAgent without a static import (it's an optional dep used
// only when a proxy is configured). A variable specifier keeps the bundler from
// trying to resolve it at build time.
async function proxyDispatcher(proxy?: string): Promise<unknown> {
    if (!proxy) return undefined;
    const mod = "undici";
    const { ProxyAgent } = (await import(/* @vite-ignore */ mod)) as {
        ProxyAgent: new (url: string) => unknown;
    };
    return new ProxyAgent(proxy);
}

// ── Fetch + logged-out detection ──────────────────────────────────────
interface FetchResult {
    status: number;
    retryAfterMs: number | null;
    json: { data?: { user?: Record<string, unknown> | null } } | null;
    loggedOut: boolean;
}

async function fetchWebProfile(
    target: string,
    sessionid: string,
    proxy?: string,
): Promise<FetchResult> {
    const dispatcher = await proxyDispatcher(proxy);
    const res = await fetch(ENDPOINT + encodeURIComponent(target), {
        // @ts-expect-error - undici dispatcher option, honored by Node's fetch
        dispatcher,
        headers: {
            "x-ig-app-id": IG_APP_ID,
            "User-Agent": UA,
            Accept: "*/*",
            "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
            Referer: `https://www.instagram.com/${target}/`,
            Cookie: `sessionid=${sessionid}`,
        },
        signal: AbortSignal.timeout(10_000),
    });

    const retryAfter = res.headers.get("retry-after");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : null;

    if (res.status !== 200) {
        return { status: res.status, retryAfterMs, json: null, loggedOut: false };
    }

    const text = await res.text();
    // Logged-out responses are an HTML login shell, not JSON.
    if (text.includes("LoginAndSignupPage") || text.includes("accounts/login")) {
        return { status: 200, retryAfterMs, json: null, loggedOut: true };
    }
    let json: FetchResult["json"] = null;
    try {
        json = JSON.parse(text);
    } catch {
        return { status: 200, retryAfterMs, json: null, loggedOut: true };
    }
    const loggedOut =
        !json?.data?.user || !(json.data.user as Record<string, unknown>).edge_followed_by;
    return { status: 200, retryAfterMs, json, loggedOut };
}

// ── Image download → master .webp → responsive variants ───────────────
async function downloadToWebp(url: string, absWebpPath: string, proxy?: string): Promise<void> {
    const dispatcher = await proxyDispatcher(proxy);
    const res = await fetch(url, {
        // @ts-expect-error - undici dispatcher option
        dispatcher,
        headers: { "User-Agent": UA, Referer: "https://www.instagram.com/" },
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`img ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(absWebpPath);
}

async function materialize(url: string, base: string, proxy?: string): Promise<void> {
    const absWebp = path.join(IG_DIR, `${base}.webp`);
    await downloadToWebp(url, absWebp, proxy); // master
    // -400w.{webp,avif} + .avif master + LQIP — exactly what buildWebpSrcset reads. Never throws.
    await generateUploadVariants(absWebp, `/instagram/${base}.webp`);
}

async function pruneOldImages(keep: Set<string>): Promise<void> {
    try {
        keep.add("avatar");
        const files = await fs.readdir(IG_DIR);
        for (const f of files) {
            if (f === "ig-cache.json" || f === ".gitkeep") continue;
            const fileBase = f.replace(/(-\d{3,4}w)?\.(webp|avif)$/i, "");
            if (!keep.has(fileBase)) {
                await fs.unlink(path.join(IG_DIR, f)).catch(() => {});
            }
        }
    } catch (e) {
        logger.warn({ err: String(e) }, "[ig-refresh] prune failed (non-fatal)");
    }
}

// ── Run state (single PM2 fork → module-level is safe) ────────────────
let running = false;
let lastRunAt = 0;
let backoffN = 0;
let nextNormalDelayMs = HOUR_MS;

function backoffMs(retryAfterMs: number | null): number {
    const exp = Math.min(HOUR_MS, Math.pow(2, backoffN) * 5 * 60 * 1000); // 5,10,20,40,60 cap
    return retryAfterMs ? Math.max(retryAfterMs, exp) : exp;
}

export interface RefreshResult {
    ok: boolean;
    skipped?: string;
    fetchedAt?: string;
    postsCount?: number;
    sessionLikelyExpired?: boolean;
    error?: string;
}

/** The single entry point. Locked, rate-floored, never throws to the caller. */
export async function runRefresh(): Promise<RefreshResult> {
    if (process.env.IG_SCRAPE_ENABLED !== "true") return { ok: false, skipped: "disabled" };
    const sessionid = process.env.IG_SCRAPE_SESSIONID?.trim();
    if (!sessionid) return { ok: false, skipped: "no-sessionid" };
    if (running) return { ok: false, skipped: "in-progress" };
    if (Date.now() - lastRunAt < MIN_INTERVAL_MS) return { ok: false, skipped: "rate-floor" };

    running = true;
    lastRunAt = Date.now();
    const proxy = process.env.IG_SCRAPE_PROXY || undefined;
    const target = process.env.IG_SCRAPE_TARGET || "mindbody_sportwear";

    try {
        const r = await fetchWebProfile(target, sessionid, proxy);

        if (r.loggedOut) {
            setSessionLikelyExpired(true);
            logger.warn(
                "[ig-refresh] response looks logged-out — IG_SCRAPE_SESSIONID likely expired. " +
                    "Refresh it (docs/instagram-scrape.md). Keeping last-good cache.",
            );
            backoffN = Math.min(backoffN + 1, 6);
            return { ok: false, skipped: "logged-out", sessionLikelyExpired: true };
        }
        if (r.status !== 200 || !r.json?.data?.user) {
            backoffN = Math.min(backoffN + 1, 6);
            if (r.status === 429) nextNormalDelayMs = Math.min(HOUR_MS * 2, nextNormalDelayMs * 2);
            logger.warn(
                { status: r.status, attempt: backoffN, willRetryInMs: backoffMs(r.retryAfterMs) },
                "[ig-refresh] non-200/empty — keeping last-good",
            );
            return { ok: false, skipped: `http-${r.status}` };
        }

        const u = r.json.data.user as Record<string, any>;
        const postsCount = u.edge_owner_to_timeline_media?.count;
        const followersCount = u.edge_followed_by?.count;
        const followingCount = u.edge_follow?.count;
        if (![postsCount, followersCount, followingCount].every((n) => Number.isFinite(n))) {
            backoffN = Math.min(backoffN + 1, 6);
            return { ok: false, skipped: "bad-shape" };
        }

        await fs.mkdir(IG_DIR, { recursive: true });

        const edges = (u.edge_owner_to_timeline_media?.edges ?? []).slice(0, 12);
        const posts: IgCache["posts"] = [];
        for (const edge of edges) {
            const node = edge?.node;
            const shortcode = node?.shortcode;
            if (!shortcode || !SHORTCODE_RE.test(shortcode)) continue;
            const imgUrl = node.thumbnail_src || node.display_url;
            if (!imgUrl) continue;
            try {
                await materialize(imgUrl, shortcode, proxy);
                posts.push({
                    id: shortcode,
                    mediaUrl: `/instagram/${shortcode}.webp`,
                    permalink: `https://www.instagram.com/p/${shortcode}/`,
                });
            } catch (e) {
                logger.warn({ shortcode, err: String(e) }, "[ig-refresh] image failed, skipping");
            }
        }

        let profilePictureUrl = "/instagram/avatar.webp";
        try {
            await materialize(u.profile_pic_url_hd || u.profile_pic_url, "avatar", proxy);
        } catch (e) {
            logger.warn({ err: String(e) }, "[ig-refresh] avatar failed, keeping previous");
            profilePictureUrl = "/instagram/avatar.webp";
        }

        if (posts.length < 1) {
            backoffN = Math.min(backoffN + 1, 6);
            return { ok: false, skipped: "no-images" };
        }

        const next: IgCache = {
            ok: true,
            fetchedAt: new Date().toISOString(),
            username: u.username || target,
            profilePictureUrl,
            postsCount,
            followersCount,
            followingCount,
            posts,
        };
        const tmp = CACHE_FILE + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(next));
        await fs.rename(tmp, CACHE_FILE); // atomic swap on the same volume
        setIgMemCache(next);
        setSessionLikelyExpired(false);

        await pruneOldImages(new Set(posts.map((p) => p.id)));

        backoffN = 0;
        nextNormalDelayMs = HOUR_MS;
        logger.info(
            { postsCount, followers: followersCount, fetchedAt: next.fetchedAt },
            "[ig-refresh] ok",
        );
        return { ok: true, fetchedAt: next.fetchedAt, postsCount };
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

    if (process.env.IG_SCRAPE_ENABLED !== "true" || !process.env.IG_SCRAPE_SESSIONID?.trim()) {
        logger.info(
            "[ig-refresh] disabled (no sessionid / not enabled) — using hardcoded fallback",
        );
        return; // zero overhead, safe before credentials exist
    }
    started = true;
    g.__igSchedulerStarted = true;

    // Boot run ~25s after start (let the server warm; don't fight cold-start traffic).
    const bootJitter = Math.floor(Math.random() * 5000);
    const boot = setTimeout(() => {
        void runRefresh();
    }, 25_000 + bootJitter);
    boot.unref?.();

    // Reschedule each tick so 429-backoff can stretch the interval.
    const tick = () => {
        void runRefresh().finally(() => {
            const delay = backoffN > 0 ? backoffMs(null) : nextNormalDelayMs;
            const t = setTimeout(tick, delay);
            t.unref?.();
        });
    };
    const first = setTimeout(tick, nextNormalDelayMs);
    first.unref?.();
}
