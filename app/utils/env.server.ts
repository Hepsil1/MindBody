// Centralised env-var validation. Import { env } anywhere on the server.
//
// Why: silent fallbacks to wrong defaults (see saleid.icu incident) hide
// configuration drift for weeks. Failing fast at module load time means a
// misconfigured deploy crashes immediately with a clear message, instead of
// shipping subtly-broken emails or auth flows to real users.

import { z } from "zod";
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { parse as parseDotenv } from "dotenv";

// Vite (dev server / vite-node) pre-loads .env through dotenv-expand, which
// treats every `$x` as a variable reference — a bcrypt hash like "$2b$12$…"
// arrives truncated to "$2b$12", and plain dotenv won't override it. Restore
// the literal .env value for any key whose raw value contains "$" and was
// mangled. No-op when there is no .env file (prod injects real env vars).
(function restoreDollarValues() {
    try {
        if (!existsSync(".env")) return;
        const raw = parseDotenv(readFileSync(".env"));
        for (const [k, v] of Object.entries(raw)) {
            if (
                v.includes("$") &&
                process.env[k] !== undefined &&
                process.env[k] !== v &&
                v.startsWith(process.env[k]!)
            ) {
                process.env[k] = v;
            }
        }
    } catch {
        /* unreadable .env — keep whatever the environment provides */
    }
})();

const EnvSchema = z.object({
    // ─── Required ─────────────────────────────────────────────────────
    DATABASE_URL: z
        .string()
        .min(1, "DATABASE_URL is required")
        .refine(
            (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
            "DATABASE_URL must be a postgresql:// connection string",
        ),
    SESSION_SECRET: z
        .string()
        .min(32, "SESSION_SECRET must be at least 32 chars (use crypto.randomBytes(48))"),
    // SITE_URL is the canonical production domain (mindbody-sportwear.com
    // since 2026-06-11; the saleid.icu launch placeholder was fully retired
    // 2026-06-26). We deliberately do NOT hard-code an allow-list of accepted
    // hostnames, so a future domain change still validates cleanly.
    SITE_URL: z
        .string()
        .url("SITE_URL must be a valid URL")
        .refine((v) => !v.endsWith("/"), "SITE_URL must not have a trailing slash"),
    // NOTE: min lowered 8 → 4 at the operator's explicit request so a short
    // admin password (e.g. "Admin") is accepted. This intentionally weakens
    // the previous guard — a longer random password is strongly preferred.
    // Either ADMIN_PASSWORD_HASH (preferred, bcrypt) or the legacy plaintext
    // ADMIN_PASSWORD must be set — enforced in the cross-field check below.
    ADMIN_PASSWORD: z.string().min(4, "ADMIN_PASSWORD must be at least 4 chars").optional(),
    ADMIN_PASSWORD_HASH: z.string().optional(),
    // Optional admin username; the login form gates on username + password.
    ADMIN_USERNAME: z.string().min(1).optional(),
    NOVA_POSHTA_API_KEY: z.string().min(1, "NOVA_POSHTA_API_KEY is required for checkout"),

    // ─── Optional ─────────────────────────────────────────────────────
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Telegram order notifications — both must be present together or both absent.
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    // Google OAuth — all three together or all absent.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),

    // Resend email — soft-fail if missing (emails are best-effort).
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),
    EMAIL_FROM_NAME: z.string().optional(),
    EMAIL_REPLY_TO: z.string().email().optional(),

    // Legacy Supabase fields — accepted but unused; planned for removal.
    VITE_SUPABASE_URL: z.string().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
        // Build a human-readable failure summary instead of dumping the full
        // ZodError. Operators see exactly which vars are wrong and why.
        const lines = result.error.issues.map((issue) => {
            const key = issue.path.join(".");
            return `  ✖ ${key}: ${issue.message}`;
        });
        console.error(
            "[env] Environment validation failed:\n" +
                lines.join("\n") +
                "\n\nFix .env (see .env.example for required vars) and restart.",
        );
        throw new Error("Invalid environment configuration");
    }

    // Cross-field rules — flagged together because individual fields can't see siblings.
    const e = result.data;
    const telegramSet = Boolean(e.TELEGRAM_BOT_TOKEN) === Boolean(e.TELEGRAM_CHAT_ID);
    if (!telegramSet) {
        throw new Error(
            "[env] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be set or both empty",
        );
    }
    const googleVars = [e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET, e.GOOGLE_REDIRECT_URI];
    const googleAllSet = googleVars.every(Boolean);
    const googleAllEmpty = googleVars.every((v) => !v);
    if (!googleAllSet && !googleAllEmpty) {
        throw new Error(
            "[env] GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI must all be set or all empty",
        );
    }

    if (!e.ADMIN_PASSWORD && !e.ADMIN_PASSWORD_HASH) {
        throw new Error(
            "[env] Set ADMIN_PASSWORD (plaintext) or ADMIN_PASSWORD_HASH (bcrypt) for admin login",
        );
    }

    return e;
}

export const env = parseEnv();
