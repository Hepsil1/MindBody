import { prisma } from "../db.server";
import { cachedFetch, invalidateCache } from "./cache.server";
import {
    DEFAULT_SITE_SETTINGS,
    mergeSiteSettings,
    SITE_SETTING_SCHEMAS,
    type SiteSettingKey,
    type SiteSettings,
} from "./site-settings";

const CACHE_KEY = "site:settings";
const CACHE_TTL = 5 * 60_000;

/**
 * Load all site settings, merged over code defaults. Raw SQL on purpose —
 * the moodType/fabric pattern: prod's generated Prisma client may predate the
 * SiteSetting model (prisma generate is blocked while PM2 holds the Windows
 * query-engine DLL), and raw SQL works against any client version. Any
 * failure (e.g. table not migrated yet) degrades to the hardcoded defaults.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
    try {
        return await cachedFetch(CACHE_KEY, CACHE_TTL, async () => {
            const rows = await prisma.$queryRaw<Array<{ key: string; value: string }>>`
                SELECT "key", "value" FROM "SiteSetting"
            `;
            return mergeSiteSettings(rows);
        });
    } catch (e) {
        console.error("getSiteSettings failed — serving defaults:", e);
        return DEFAULT_SITE_SETTINGS;
    }
}

/**
 * Validate + persist one settings group. Returns the canonical (trimmed,
 * schema-shaped) value or a human-readable error. Upsert via raw SQL — see
 * getSiteSettings() for why.
 */
export async function saveSiteSetting(
    key: SiteSettingKey,
    rawJson: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const schema = SITE_SETTING_SCHEMAS[key];
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(rawJson);
    } catch {
        return { ok: false, error: "Невалідний JSON налаштувань" };
    }
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
            ok: false,
            error: first ? `${first.path.join(".")}: ${first.message}` : "Невалідні дані",
        };
    }
    const canonical = JSON.stringify(parsed.data);
    await prisma.$executeRaw`
        INSERT INTO "SiteSetting" ("key", "value", "updatedAt")
        VALUES (${key}, ${canonical}, NOW())
        ON CONFLICT ("key") DO UPDATE SET "value" = ${canonical}, "updatedAt" = NOW()
    `;
    invalidateCache(CACHE_KEY);
    return { ok: true };
}
