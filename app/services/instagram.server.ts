// Read side of the Instagram cache — imported by the home loader.
// NEVER makes a network call: a pure on-disk read with an in-process hot copy.
// `.server.ts` → stripped from the client bundle, so the sessionid (read only
// in the refresh module) can never reach the browser through here.
import { promises as fs, existsSync } from "fs";
import path from "path";

// The cache JSON + downloaded images live in one ignored dir (simplest pruning).
// The JSON exposes only PUBLIC profile numbers + LOCAL image paths — never the
// sessionid — so it being under public/ is harmless.
export const IG_DIR = path.resolve("public/instagram");
export const CACHE_FILE = path.join(IG_DIR, "ig-cache.json");

// A story-highlight bubble (real cover + title, scraped from the profile DOM).
export interface IgHighlight {
    id: string; // slug derived from the title (stable filename key)
    title: string; // e.g. "SALE FLUID"
    cover: string; // "/instagram/hl_<slug>.webp" (LOCAL)
    hasVariants?: boolean;
}

// On-disk shape: RAW numbers + LOCAL image urls. Locale-agnostic — the loader
// formats the display strings per request.
export interface IgCache {
    ok: boolean;
    fetchedAt: string; // ISO
    username: string;
    fullName: string;
    biography: string; // raw bio text (newlines, @mentions kept — loader linkifies)
    externalUrl: string; // bio link, e.g. "http://t.me/mindbody_sportwear"
    profilePictureUrl: string; // "/instagram/avatar.webp"
    postsCount: number; // edge_owner_to_timeline_media.count
    followersCount: number; // edge_followed_by.count
    followingCount: number; // edge_follow.count
    highlights: IgHighlight[];
    posts: {
        id: string; // shortcode
        mediaUrl: string; // "/instagram/<shortcode>.webp" (LOCAL master)
        permalink: string; // https://www.instagram.com/p/<shortcode>/ (or /reel/)
        isVideo: boolean; // reel/video → show the play badge
        hasVariants?: boolean;
    }[];
}

// Hot in-process copy with TTL so disk changes take effect without server restart.
let _mem: IgCache | null = null;
let _loaded = false;
let _lastReadTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

// Surfaced via the manual refresh route so the owner can tell "cookie expired".
let _sessionLikelyExpired = false;
export function getSessionState() {
    return { sessionLikelyExpired: _sessionLikelyExpired };
}
export function setSessionLikelyExpired(v: boolean) {
    _sessionLikelyExpired = v;
}

export function setIgMemCache(c: IgCache) {
    _mem = c;
    _loaded = true;
}

const variantExistsCache = new Set<string>();
export function checkImageVariantsExist(url?: string): boolean {
    if (!url || typeof url !== "string" || !url.startsWith("/")) return false;
    if (variantExistsCache.has(url)) return true;
    try {
        const cleanPath = url.split("?")[0].replace(/^\//, "");
        const extMatch = cleanPath.match(/\.(webp|avif|jpg|jpeg|png)$/i);
        if (!extMatch) return false;
        const base = cleanPath.slice(0, -extMatch[0].length);
        const variantDiskPath = path.resolve("public", `${base}-400w.webp`);
        const exists = existsSync(variantDiskPath);
        if (exists) variantExistsCache.add(url);
        return exists;
    } catch {
        return false;
    }
}

/** Pure file read with 30s cache TTL. Returns null until the first successful scrape has run. */
export async function readIgCache(): Promise<IgCache | null> {
    const now = Date.now();
    if (_loaded && now - _lastReadTime < CACHE_TTL_MS) return _mem;
    try {
        const raw = await fs.readFile(CACHE_FILE, "utf8");
        const parsed = JSON.parse(raw) as IgCache;
        _mem = parsed.ok ? parsed : null; // never trust a non-ok cache
    } catch {
        if (!_mem) _mem = null; // no file yet / unreadable → caller uses hardcoded fallback
    }
    _lastReadTime = now;
    _loaded = true;
    return _mem;
}
