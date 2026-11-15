/**
 * "The Single Look" — 4 Ultra-Luxury Flagship Supplex 280 Jumpsuit Campaigns
 * Native 16:9 Desktop (2560x1440) & 9:16 Mobile (1600x2844) Retina 4K Masters
 *
 * Real DB sync: name, price, colours, inventory, status from Prisma DB.
 */
import { prisma } from "../db.server";
import { cachedFetch } from "./cache.server";

interface LookConfig {
    slug: string;
    shortTitle: string;
    kicker: string;
    photoColor: string;
    imageDesktop: string;
    imageMobile: string;
    frontImage: string;
    backImage: string;
    frontPos?: string;
    backPos?: string;
    studioBg?: string;
}

const LOOKS: LookConfig[] = [
    {
        slug: "kombinezon-wings-z-dovhym-rukavom",
        shortTitle: "1. DUO CONTRAST",
        photoColor: "purple",
        kicker: "WINGS · TEAL + PLUM",
        imageDesktop: "/hero/masters/v4_s1_duo",
        imageMobile: "/hero/masters/v4_s1_duo_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/333_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "kombinezon-wings-plum-monochrome",
        shortTitle: "2. MONOCHROME",
        photoColor: "purple",
        kicker: "COCOA · 360°",
        imageDesktop: "/hero/masters/v4_s2_cocoa360",
        imageMobile: "/hero/masters/v4_s2_cocoa360_mobile",
        frontImage: "/generalpics/585_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "kombinezon-wings-asymmetric-editorial",
        shortTitle: "3. ASYMMETRIC",
        photoColor: "purple",
        kicker: "WINGS PLUM · EDITORIAL",
        imageDesktop: "/hero/masters/v4_s3_editorial",
        imageMobile: "/hero/masters/v4_s3_editorial_mobile",
        frontImage: "/generalpics/588_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "kombinezon-wings-triptych-balanced",
        shortTitle: "4. TRIPTYCH",
        photoColor: "purple",
        kicker: "WINGS TEAL · FLOW",
        imageDesktop: "/hero/masters/v4_s4_seated",
        imageMobile: "/hero/masters/v4_s4_seated_mobile",
        frontImage: "/generalpics/588_131123",
        backImage: "/generalpics/602_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "kombinezon-wings-monolithic-minimal",
        shortTitle: "5. MONOLITH",
        photoColor: "purple",
        kicker: "WINGS PLUM · MONOLITH",
        imageDesktop: "/hero/masters/v4_s5_monolith",
        imageMobile: "/hero/masters/v4_s5_monolith_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-6",
        shortTitle: "6. NOCTURNE",
        photoColor: "purple",
        kicker: "CORE · NOCTURNE (BACK)",
        imageDesktop: "/hero/masters/v4_s5b_nocturne",
        imageMobile: "/hero/masters/v4_s5b_nocturne_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-7",
        shortTitle: "7. NOCTURNE 360",
        photoColor: "purple",
        kicker: "CORE · BLACK 360°",
        imageDesktop: "/hero/masters/v4_c6_nocturne360",
        imageMobile: "/hero/masters/v4_c6_nocturne360_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-8",
        shortTitle: "8. COBALT",
        photoColor: "purple",
        kicker: "WINGS · COBALT WHITE",
        imageDesktop: "/hero/masters/v4_c7_cobalt_white",
        imageMobile: "/hero/masters/v4_c7_cobalt_white_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-9",
        shortTitle: "9. BALANCE",
        photoColor: "purple",
        kicker: "EARTH · BALANCE",
        imageDesktop: "/hero/masters/v4_c8_balance",
        imageMobile: "/hero/masters/v4_c8_balance_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-10",
        shortTitle: "10. DUO",
        photoColor: "purple",
        kicker: "CORE · BLACK + PLUM DUO",
        imageDesktop: "/hero/masters/v4_c9_duo_real",
        imageMobile: "/hero/masters/v4_c9_duo_real_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-11",
        shortTitle: "11. LUNGE",
        photoColor: "purple",
        kicker: "EARTH · MOVEMENT",
        imageDesktop: "/hero/masters/v4_c10_lunge",
        imageMobile: "/hero/masters/v4_c10_lunge_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-12",
        shortTitle: "12. NEW · PAIR 360°",
        photoColor: "purple",
        kicker: "TEAL + RED · 360°",
        imageDesktop: "/hero/masters/v4_n1_pair360",
        imageMobile: "/hero/masters/v4_n1_pair360_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-13",
        shortTitle: "13. NEW · BUTTERFLY",
        photoColor: "purple",
        kicker: "BUTTERFLY · DUO",
        imageDesktop: "/hero/masters/v4_n2_butterfly",
        imageMobile: "/hero/masters/v4_n2_butterfly_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-14",
        shortTitle: "14. NEW · RED 360°",
        photoColor: "purple",
        kicker: "RED · FRONT / BACK",
        imageDesktop: "/hero/masters/v4_n3_red360",
        imageMobile: "/hero/masters/v4_n3_red360_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-15",
        shortTitle: "15. NEW · BERRY DUO",
        photoColor: "purple",
        kicker: "PLUM + RASPBERRY",
        imageDesktop: "/hero/masters/v4_n4_duo_berry",
        imageMobile: "/hero/masters/v4_n4_duo_berry_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
    {
        slug: "hero-review-16",
        shortTitle: "16. NEW · ICE CREAM",
        photoColor: "purple",
        kicker: "CHOCOLATE · SCULPT",
        imageDesktop: "/hero/masters/v4_n5_icecream",
        imageMobile: "/hero/masters/v4_n5_icecream_mobile",
        frontImage: "/generalpics/595_131123",
        backImage: "/generalpics/595_131123",
        frontPos: "center bottom",
        backPos: "center bottom",
        studioBg: "#dcd9dd",
    },
];

export interface HeroLook {
    slug: string;
    name: string;
    shortTitle: string;
    kicker: string;
    price: number;
    comparePrice: number | null;
    colors: string[];
    imageDesktop: string;
    imageMobile: string;
    frontImage: string;
    backImage: string;
    frontPos?: string;
    backPos?: string;
    studioBg?: string;
    /** Real product slug for the CTA link (`slug` is only a unique look key). */
    productSlug: string;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
    try {
        const v = JSON.parse(raw || "");
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

/** Looks with a `hero-review-*` slug are concept candidates shown only on /hero-gallery. */
const isReviewLook = (slug: string) => slug.startsWith("hero-review-");

export async function getHeroLooks(opts: { includeReview?: boolean } = {}): Promise<HeroLook[]> {
    const includeReview = !!opts.includeReview;
    return cachedFetch(`home:hero-looks-v9${includeReview ? "-review" : ""}`, 60_000, async () => {
        const rows = await prisma.product.findMany({
            where: { status: "active" },
            select: {
                slug: true,
                name: true,
                price: true,
                comparePrice: true,
                colors: true,
                inventory: true,
            },
        });
        const bySlug = new Map(rows.map((r) => [r.slug, r]));
        const wingsFallback = bySlug.get("kombinezon-wings-z-dovhym-rukavom") || rows[0];

        const results: HeroLook[] = [];
        for (const cfg of LOOKS) {
            if (!includeReview && isReviewLook(cfg.slug)) continue;
            const row = bySlug.get(cfg.slug) || wingsFallback;
            if (!row || !row.slug) continue;

            const allColors = parseJson<string[]>(row.colors, []);
            // Put the photo color first in the swatches
            const sortedColors = [cfg.photoColor, ...allColors.filter((c) => c !== cfg.photoColor)];

            results.push({
                slug: cfg.slug,
                name: row.name || "Комбінезон Wings",
                shortTitle: cfg.shortTitle,
                kicker: cfg.kicker,
                price: Number(row.price),
                comparePrice: row.comparePrice ? Number(row.comparePrice) : null,
                colors: sortedColors,
                imageDesktop: cfg.imageDesktop,
                imageMobile: cfg.imageMobile,
                frontImage: cfg.frontImage,
                backImage: cfg.backImage,
                frontPos: cfg.frontPos,
                backPos: cfg.backPos,
                studioBg: cfg.studioBg,
                // Link to the product the data actually came from — a config slug
                // that isn't a live product would otherwise produce a 404 CTA.
                productSlug: row.slug,
            });
        }
        return results;
    });
}
