/**
 * Mood preset registry — Batch 41.
 *
 * Each Category row may have a `moodType` field that maps to one of
 * these presets.  Components apply the tint + typography deltas on
 * top of the existing brand styling so /shop/yoga reads visually
 * distinct from /shop/sport without forking layouts.
 *
 * Pilot ships YOGA only.  The other moods are stubbed out so the type
 * stays exhaustive and the admin dropdown can show them as "coming
 * soon" — once we validate the Yoga look on prod, Batch 42 will fill
 * in sport / dance / casual / kids.
 *
 * Industry pattern: Sézane, Cuyana, Polène all differentiate
 * categories with subtle tint overlays + typography weight changes,
 * NOT by forking page templates.  Brand cohesion stays intact.
 */

export type MoodType = "yoga" | "sport" | "dance" | "casual" | "kids";

export interface MoodPreset {
    /** rgba — applied as `background` on the category card overlay. Keep
        opacity ≤ 0.12 so the underlying photo still reads. */
    tintOverlay: string;
    /** Cormorant Garamond weight — 400 (light, calm) to 600 (bold, energy). */
    titleWeight: number;
    /** letter-spacing on the category title — wider = more breathable. */
    titleLetterSpacing: string;
    /** Optional path to the photography brief markdown for admin help text. */
    photoBriefRef?: string;
    /** Human-readable label for the admin dropdown. */
    label: string;
    /** Whether this preset is enabled for selection in admin UI.
        Pilot moods set this to true; "coming soon" placeholders stay false. */
    enabled: boolean;
}

export const MOOD_PRESETS: Record<MoodType, MoodPreset> = {
    yoga: {
        tintOverlay: "rgba(74, 138, 138, 0.10)", // 10% brand teal — calm
        titleWeight: 400,
        titleLetterSpacing: "0.18em",
        photoBriefRef: "/mockups/photography-brief-yoga.md",
        label: "Yoga — calm teal, light Cormorant",
        enabled: true,
    },
    // Batch 42+ will flesh these out.  Keeping them stubbed so the
    // dropdown can list them as disabled "coming soon" rather than
    // surprising the admin with an empty menu later.
    sport: {
        tintOverlay: "rgba(0, 0, 0, 0)",
        titleWeight: 500,
        titleLetterSpacing: "0.14em",
        label: "Sport (скоро)",
        enabled: false,
    },
    dance: {
        tintOverlay: "rgba(0, 0, 0, 0)",
        titleWeight: 500,
        titleLetterSpacing: "0.14em",
        label: "Dance (скоро)",
        enabled: false,
    },
    casual: {
        tintOverlay: "rgba(0, 0, 0, 0)",
        titleWeight: 500,
        titleLetterSpacing: "0.14em",
        label: "Casual (скоро)",
        enabled: false,
    },
    kids: {
        tintOverlay: "rgba(0, 0, 0, 0)",
        titleWeight: 500,
        titleLetterSpacing: "0.14em",
        label: "Kids (скоро)",
        enabled: false,
    },
};

/**
 * Safe lookup: returns the preset only if the string is a known mood AND
 * that mood is enabled.  Anything else (null, "", "unknown-string") returns
 * undefined so the caller falls back to the default neutral styling.
 */
export function getMoodPreset(value: string | null | undefined): MoodPreset | undefined {
    if (!value) return undefined;
    const preset = MOOD_PRESETS[value as MoodType];
    if (!preset || !preset.enabled) return undefined;
    return preset;
}

/** Convenience for admin dropdowns — list ALL moods including disabled ones. */
export function listMoods(): Array<{ value: MoodType; preset: MoodPreset }> {
    return (Object.keys(MOOD_PRESETS) as MoodType[]).map((value) => ({
        value,
        preset: MOOD_PRESETS[value],
    }));
}
