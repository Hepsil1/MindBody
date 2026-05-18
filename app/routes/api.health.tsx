// GET /api/health — lightweight liveness probe.
//
// Purpose: lets monitoring (UptimeRobot, Cloudflare health checks, the
// deploy.ps1 smoke step, manual curl) confirm the server is up AND the
// database connection is alive WITHOUT touching customer data.
//
// Why a dedicated route vs the home page:
// - Cheaper (no Prisma .findMany, no React render, no asset preloading)
// - Stable contract (JSON shape, no design churn)
// - Distinguishes "server up" from "DB reachable"
//
// Response shape:
//   200 { status: "ok", db: "ok", uptime, ts }       (everything healthy)
//   503 { status: "degraded", db: "down", uptime, ts } (DB unreachable)
//
// We DON'T expose:
// - Version/git SHA  (would help attackers fingerprint vulnerabilities)
// - Process memory   (info leakage; PM2 already exposes this internally)
// - Detailed errors  (raw error strings can leak SQL fragments / paths)

import { prisma } from "../db.server";

const STARTED_AT = Date.now();

export async function loader() {
    let dbOk = false;
    try {
        // Cheapest possible query — no table scan, no row materialisation.
        await prisma.$queryRaw`SELECT 1`;
        dbOk = true;
    } catch {
        dbOk = false;
    }

    const body = {
        status: dbOk ? "ok" : "degraded",
        db: dbOk ? "ok" : "down",
        uptime_ms: Date.now() - STARTED_AT,
        ts: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
        status: dbOk ? 200 : 503,
        headers: {
            "Content-Type": "application/json",
            // Never cache health checks — every probe must hit the live process.
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    });
}
