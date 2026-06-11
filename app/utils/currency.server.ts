/**
 * UAH→USD rate for the en/ru storefronts — official NBU daily rate.
 *
 * Resolution order (never throws, never blocks a render for long):
 *   1. in-memory cache fresher than TTL
 *   2. SiteSetting row "usdRate" fresher than TTL (survives restarts)
 *   3. live NBU API fetch (5 s timeout) → persisted to memory + DB
 *   4. stale DB/memory value, however old
 *   5. FALLBACK_USD_RATE constant
 *
 * Raw SQL for the SiteSetting read/write — same rationale as
 * site-settings.server.ts (works against any generated client version).
 */
import { prisma } from "../db.server";
import { FALLBACK_USD_RATE } from "../i18n/config";

const SETTING_KEY = "usdRate";
const TTL_MS = 12 * 60 * 60 * 1000; // refresh twice a day
const NBU_URL = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json";

interface RateEntry {
    rate: number;
    fetchedAt: number; // epoch ms
}

let memory: RateEntry | null = null;

function isFresh(e: RateEntry): boolean {
    return Date.now() - e.fetchedAt < TTL_MS;
}

function isSaneRate(r: unknown): r is number {
    return typeof r === "number" && Number.isFinite(r) && r > 10 && r < 500;
}

async function readDbEntry(): Promise<RateEntry | null> {
    try {
        const rows = await prisma.$queryRaw<Array<{ value: string }>>`
            SELECT "value" FROM "SiteSetting" WHERE "key" = ${SETTING_KEY}
        `;
        if (!rows.length) return null;
        const parsed = JSON.parse(rows[0].value) as Partial<RateEntry>;
        if (isSaneRate(parsed.rate) && typeof parsed.fetchedAt === "number") {
            return { rate: parsed.rate, fetchedAt: parsed.fetchedAt };
        }
        return null;
    } catch {
        return null;
    }
}

async function writeDbEntry(entry: RateEntry): Promise<void> {
    try {
        const json = JSON.stringify(entry);
        await prisma.$executeRaw`
            INSERT INTO "SiteSetting" ("key", "value", "updatedAt")
            VALUES (${SETTING_KEY}, ${json}, NOW())
            ON CONFLICT ("key") DO UPDATE SET "value" = ${json}, "updatedAt" = NOW()
        `;
    } catch {
        // non-fatal — memory cache still serves the rate
    }
}

async function fetchNbuRate(): Promise<number | null> {
    try {
        const res = await fetch(NBU_URL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data: unknown = await res.json();
        const first = Array.isArray(data) ? data[0] : data;
        const rate = (first as { rate?: unknown } | null)?.rate;
        return isSaneRate(rate) ? rate : null;
    } catch {
        return null;
    }
}

/** Current UAH-per-USD rate. Cheap after the first call (memory cache). */
export async function getUsdRate(): Promise<number> {
    if (memory && isFresh(memory)) return memory.rate;

    const db = await readDbEntry();
    if (db && isFresh(db)) {
        memory = db;
        return db.rate;
    }

    const live = await fetchNbuRate();
    if (live !== null) {
        const entry: RateEntry = { rate: live, fetchedAt: Date.now() };
        memory = entry;
        void writeDbEntry(entry);
        return live;
    }

    // Stale beats hardcoded; hardcoded beats nothing.
    const stale = db ?? memory;
    if (stale) {
        memory = stale;
        return stale.rate;
    }
    return FALLBACK_USD_RATE;
}
