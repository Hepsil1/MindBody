/**
 * Display labels for the 6 real shop pages (taxonomy.ts SHOP_SLUGS), used by
 * the visual editor (admin/slides.tsx) and the shop-page hero editor. This is
 * the single source of truth that replaces the old hardcoded women/kids
 * ternaries — every shop slug now has a proper title + hero overlay copy.
 *
 *   title   — admin/heading label (e.g. "Yoga")
 *   tagline — small accent line under the hero title ("для йоги")
 *   stroke  — large background watermark on the hero ("YOGA")
 */
import { SHOP_SLUGS } from "./taxonomy";

export interface ShopPageLabel {
    title: string;
    tagline: string;
    stroke: string;
}

export const SHOP_PAGE_LABELS: Record<string, ShopPageLabel> = {
    yoga: { title: "Yoga", tagline: "для йоги", stroke: "YOGA" },
    sport: { title: "Sport", tagline: "для спорту", stroke: "SPORT" },
    dance: { title: "Dance", tagline: "для танців", stroke: "DANCE" },
    casual: { title: "Casual", tagline: "на щодень", stroke: "CASUAL" },
    kids: { title: "Діти", tagline: "для малечі", stroke: "KIDS" },
    yogatools: { title: "Yoga Tools", tagline: "інвентар", stroke: "YOGATOOLS" },
};

/** Labels for a slug, falling back to a sane derived label for unknown slugs. */
export function shopPageLabel(slug: string | null | undefined): ShopPageLabel {
    if (slug && SHOP_PAGE_LABELS[slug]) return SHOP_PAGE_LABELS[slug];
    const s = slug ?? "";
    return { title: s, tagline: "", stroke: s.toUpperCase() };
}

export function shopPageTitle(slug: string | null | undefined): string {
    return shopPageLabel(slug).title;
}

/** True when the slug is one of the 6 real shop pages. */
export function isRealShopSlug(slug: string | null | undefined): slug is string {
    return !!slug && SHOP_SLUGS.includes(slug);
}

/** Ordered list of { slug, ...label } for rendering the shop selector. */
export const SHOP_PAGE_OPTIONS: Array<{ slug: string } & ShopPageLabel> = SHOP_SLUGS.map(
    (slug) => ({ slug, ...shopPageLabel(slug) }),
);
