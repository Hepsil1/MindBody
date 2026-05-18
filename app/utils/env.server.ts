// Centralised env-var validation. Import { env } anywhere on the server.
//
// Why: silent fallbacks to wrong defaults (see saleid.icu incident) hide
// configuration drift for weeks. Failing fast at module load time means a
// misconfigured deploy crashes immediately with a clear message, instead of
// shipping subtly-broken emails or auth flows to real users.

import { z } from "zod";
import "dotenv/config";

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
    // SITE_URL is the canonical production domain. We deliberately do NOT
    // hard-code an allow-list of accepted hostnames — the project sits on
    // saleid.icu today and will move to its permanent domain later; both
    // need to validate cleanly.
    SITE_URL: z
        .string()
        .url("SITE_URL must be a valid URL")
        .refine((v) => !v.endsWith("/"), "SITE_URL must not have a trailing slash"),
    ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 chars"),
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

    return e;
}

export const env = parseEnv();
