/**
 * /hero-gallery — review page: every hero slide stacked, each rendered by the
 * real SingleLookHero (same header, logo, CTA, crops) so the owner can compare
 * all concepts on the live layout. The view is chosen only by URL (no switcher
 * bar — the client sees just the slides):
 *   (no param)   the curated mix: MIX_MATCH slides on their outfit-matched wall
 *                colour with stage light (v4_<slide>__match), the rest on the
 *                classic studio grey
 *   ?bg=orig     every slide on the classic studio grey
 *   ?bg=match    every slide on its outfit-matched colour
 *   ?bg=sand|clay|sage|mist|blush|lilac   one wall colour for all (local only —
 *                these variant files are not shipped to prod)
 * Not linked anywhere; noindex.
 */
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import { getHeroLooks } from "../utils/heroLooks.server";

const VARIANTS = ["match", "sand", "clay", "sage", "mist", "blush", "lilac"] as const;

// Slides whose matched colour clearly lifts the outfit. Left out: outfits that
// melt into their colour (cobalt on mist, lilac on lilac, cream on sand…),
// which stay on the classic grey.
const MIX_MATCH = new Set([
    "v4_s1_duo",
    "v4_s2_cocoa360",
    "v4_c6_nocturne360",
    "v4_c8_balance",
    "v4_c9_duo_real",
    "v4_n1_pair360",
    "v4_n3_red360",
    "v4_n5_icecream",
    "v4_u03_sky_back",
    "v4_u05_forest_set",
    "v4_u07_linen",
    "v4_u08_plaid_duo",
    "v4_u09_navy",
    "v4_u12_noir",
    "v4_u14_graphite_duo",
    "v4_u17_piping",
    "v4_u20_cherry_plaid",
    "v4_u21_palette",
]);

export function meta() {
    return [
        { title: "Hero gallery — MIND BODY" },
        { name: "robots", content: "noindex, nofollow" },
    ];
}

export async function loader({ request }: LoaderFunctionArgs) {
    const raw = new URL(request.url).searchParams.get("bg") ?? "";
    const bg = raw === "orig" || (VARIANTS as readonly string[]).includes(raw) ? raw : "mix";
    const looks = (await getHeroLooks({ includeReview: true })).map((l) => {
        if (!l.imageDesktop.includes("/hero/masters/v4_")) return l;
        const base = l.imageDesktop.split("/").pop() ?? "";
        const variant =
            bg === "mix" ? (MIX_MATCH.has(base) ? "match" : "") : bg === "orig" ? "" : bg;
        return variant
            ? {
                  ...l,
                  imageDesktop: `${l.imageDesktop}__${variant}`,
                  imageMobile: l.imageMobile.replace(/_mobile$/, `__${variant}_mobile`),
              }
            : l;
    });
    return { looks, bg };
}

export default function HeroGallery() {
    const { looks } = useLoaderData<typeof loader>();
    return (
        <main style={{ background: "#f4f1ec" }}>
            {looks.map((look) => (
                <div key={look.slug} style={{ position: "relative", marginBottom: 12 }}>
                    <div
                        style={{
                            position: "absolute",
                            top: 132,
                            left: 16,
                            zIndex: 50,
                            background: "#D97757",
                            color: "#fff",
                            font: "700 14px/1 Onest, sans-serif",
                            letterSpacing: "0.08em",
                            padding: "8px 12px",
                            borderRadius: 4,
                        }}
                    >
                        {look.shortTitle} · {look.kicker}
                    </div>
                    <SingleLookHero looks={[look]} />
                </div>
            ))}
        </main>
    );
}
