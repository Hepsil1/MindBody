import { z } from "zod";
import { useRouteLoaderData } from "react-router";

/**
 * Owner-editable site content (client-safe module — types, defaults, Zod
 * schemas, and the read hook). Server I/O lives in site-settings.server.ts.
 *
 * Design: one SiteSetting DB row per group key, value = JSON validated by the
 * group's Zod schema before write. DEFAULTS mirror the previously hardcoded
 * values, and every read merges over them — an empty/missing/corrupt row
 * yields exactly the old behavior (zero-regression fallback).
 */

/** Contacts shown in the header top-bar, footer, floating widget, contacts page. */
export const contactsSettingsSchema = z.object({
    /** Human-readable phone, e.g. "+38 (096) 665-08-55". */
    phoneDisplay: z.string().trim().min(5).max(30),
    /** tel:-href digits, e.g. "+380966650855". */
    phoneTel: z
        .string()
        .trim()
        .regex(/^\+?[0-9]{9,15}$/, "Телефон: лише цифри (і необов'язковий +), 9–15 знаків"),
    /** Support hours line under the phone. */
    hoursLabel: z.string().trim().min(2).max(60),
    instagramUrl: z.string().trim().url().max(200),
    telegramUrl: z.string().trim().url().max(200),
    /** Viber number digits (no +), e.g. "380509656737". */
    viberPhone: z
        .string()
        .trim()
        .regex(/^[0-9]{9,15}$/, "Viber: лише цифри, 9–15 знаків"),
    /** WhatsApp number digits (no +). */
    whatsappPhone: z
        .string()
        .trim()
        .regex(/^[0-9]{9,15}$/, "WhatsApp: лише цифри, 9–15 знаків"),
});

export type ContactsSettings = z.infer<typeof contactsSettingsSchema>;

/**
 * Home "premium features" bar — exactly 4 items (the icons are hardcoded in
 * home.tsx and matched to items by index, so the count is fixed at 4).
 */
export const homeFeaturesSchema = z.object({
    items: z
        .array(
            z.object({
                title: z.string().trim().min(1).max(60),
                desc: z.string().trim().min(1).max(120),
            }),
        )
        .length(4),
});
export type HomeFeaturesSettings = z.infer<typeof homeFeaturesSchema>;

/** Home animated-counter stats — 4 items (count + suffix + label). */
export const homeStatsSchema = z.object({
    items: z
        .array(
            z.object({
                count: z.number().int().min(0).max(100_000_000),
                suffix: z.string().trim().max(8),
                label: z.string().trim().min(1).max(60),
            }),
        )
        .length(4),
});
export type HomeStatsSettings = z.infer<typeof homeStatsSchema>;

/** Brand World feature list — 4 items (title + desc), numbered 01–04 in code. */
export const homeBrandWorldSchema = z.object({
    items: z
        .array(
            z.object({
                title: z.string().trim().min(1).max(60),
                desc: z.string().trim().min(1).max(160),
            }),
        )
        .length(4),
});
export type HomeBrandWorldSettings = z.infer<typeof homeBrandWorldSchema>;

export interface SiteSettings {
    contacts: ContactsSettings;
    homeFeatures: HomeFeaturesSettings;
    homeStats: HomeStatsSettings;
    homeBrandWorld: HomeBrandWorldSettings;
}

/** Per-key Zod schema — the action validates value JSON against these. */
export const SITE_SETTING_SCHEMAS = {
    contacts: contactsSettingsSchema,
    homeFeatures: homeFeaturesSchema,
    homeStats: homeStatsSchema,
    homeBrandWorld: homeBrandWorldSchema,
} as const;

export type SiteSettingKey = keyof typeof SITE_SETTING_SCHEMAS;
export const SITE_SETTING_KEYS = Object.keys(SITE_SETTING_SCHEMAS) as SiteSettingKey[];

/**
 * The exact values that were hardcoded across Header/Footer/FloatingContact
 * before SE4. NOTE: the header top-bar used a separate placeholder number
 * (+380 67 123 45 67) — unified onto the footer/contacts number, which is the
 * one repeated everywhere customer-facing.
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
    contacts: {
        phoneDisplay: "+38 (096) 665-08-55",
        phoneTel: "+380966650855",
        hoursLabel: "Пн–Пт · 9:00–18:00",
        instagramUrl: "https://instagram.com/mindbody.sportwear",
        telegramUrl: "https://t.me/Juliamindbody",
        viberPhone: "380509656737",
        whatsappPhone: "380973542848",
    },
    homeFeatures: {
        items: [
            { title: "Українське виробництво", desc: "100% контроль якості у своєму цеху" },
            { title: "Premium Supplex", desc: "Технологічні тканини, що дихають" },
            { title: "Повернення 14 днів", desc: "Обмін та повернення без проблем" },
            { title: "Швидка оплата", desc: "Безпечно карткою або при отриманні" },
        ],
    },
    homeStats: {
        items: [
            { count: 63900, suffix: "+", label: "Підписників в Instagram" },
            { count: 2168, suffix: "+", label: "Публікацій у соцмережах" },
            { count: 10, suffix: "+", label: "Років на ринку" },
            { count: 5000, suffix: "+", label: "Задоволених клієнтів" },
        ],
    },
    homeBrandWorld: {
        items: [
            {
                title: "Дихаючі тканини",
                desc: "Преміальні матеріали, що забезпечують ідеальну терморегуляцію.",
            },
            {
                title: "Ексклюзивний дизайн",
                desc: "Естетика, що надихає навіть під час найважчих тренувань.",
            },
            {
                title: "Ідеальна посадка",
                desc: "Анатомічний крій, що бездоганно підкреслює вашу фігуру.",
            },
            {
                title: "Сертифікована якість",
                desc: "100% контроль, створено з любов'ю та увагою до кожної деталі.",
            },
        ],
    },
};

/**
 * Final/fallback display text for a stat counter — mirrors the animation's
 * last frame (home.tsx animateCounter): ≥10000 renders as "63.9K", smaller
 * numbers use uk-UA grouping; the suffix is appended either way. The animated
 * JS overwrites this on scroll, but it's the SSR/no-JS value.
 */
export function formatStatDisplay(count: number, suffix: string): string {
    if (count >= 10000) return (count / 1000).toFixed(1) + "K" + suffix;
    return count.toLocaleString("uk-UA") + suffix;
}

/** viber:// deep link from the stored digits. */
export function viberChatUrl(viberPhone: string): string {
    return `viber://chat?number=%2B${viberPhone}`;
}

/** https://wa.me/ link from the stored digits. */
export function whatsappUrl(whatsappPhone: string): string {
    return `https://wa.me/${whatsappPhone}`;
}

/**
 * Merge raw DB rows over the defaults. Each row's JSON is schema-validated —
 * an unknown key, broken JSON, or shape mismatch is ignored (defaults win),
 * so bad data can never break the storefront render.
 */
export function mergeSiteSettings(rows: Array<{ key: string; value: string }>): SiteSettings {
    const merged: SiteSettings = structuredClone(DEFAULT_SITE_SETTINGS);
    // Heterogeneous key→group map: index through `unknown` so the per-key
    // assignment doesn't trip the union-intersection check (the schema for
    // `key` guarantees `parsed.data` matches `merged[key]` at runtime).
    const mutable = merged as unknown as Record<string, unknown>;
    for (const row of rows) {
        const schema = SITE_SETTING_SCHEMAS[row.key as SiteSettingKey];
        if (!schema) continue;
        try {
            const parsed = schema.safeParse(JSON.parse(row.value));
            if (parsed.success) {
                mutable[row.key] = parsed.data;
            }
        } catch {
            // broken JSON in the row — keep defaults
        }
    }
    return merged;
}

/**
 * Read the settings the root loader provided. Falls back to defaults when the
 * root data is unavailable (e.g. inside the root ErrorBoundary, which renders
 * Header/Footer outside a loader context).
 */
export function useSiteSettings(): SiteSettings {
    const data = useRouteLoaderData("root") as { siteSettings?: SiteSettings } | undefined;
    return data?.siteSettings ?? DEFAULT_SITE_SETTINGS;
}
