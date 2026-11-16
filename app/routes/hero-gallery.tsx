/**
 * /hero-gallery — review page: every hero slide stacked, each rendered by the
 * real SingleLookHero (same header, logo, CTA, crops) so the owner can compare
 * all concepts on the live layout. `?bg=sand|clay|sage|mist|blush|lilac` swaps in the
 * background-colour variants (v4_<slide>__<colour>); `?bg=match` shows each slide on
 * the wall colour picked for its outfit, with stage light (v4_<slide>__match).
 * The colour is chosen only by URL (no switcher bar — the client sees just the
 * slides). Not linked anywhere; noindex.
 */
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import { getHeroLooks } from "../utils/heroLooks.server";

const COLORS = [
    { id: "", label: "Оригінал", swatch: "#d9d6da" },
    {
        id: "match",
        label: "В тон образу + світло",
        swatch: "conic-gradient(#c4b29c, #b28068, #96a08c, #9caaba, #c4a098, #b0a4c0, #c4b29c)",
    },
    { id: "sand", label: "Sand", swatch: "#c4b29c" },
    { id: "clay", label: "Clay", swatch: "#b28068" },
    { id: "sage", label: "Sage", swatch: "#96a08c" },
    { id: "mist", label: "Mist", swatch: "#9caaba" },
    { id: "blush", label: "Blush", swatch: "#c4a098" },
    { id: "lilac", label: "Lilac", swatch: "#b0a4c0" },
] as const;

export function meta() {
    return [
        { title: "Hero gallery — MIND BODY" },
        { name: "robots", content: "noindex, nofollow" },
    ];
}

export async function loader({ request }: LoaderFunctionArgs) {
    const raw = new URL(request.url).searchParams.get("bg") ?? "";
    const bg = COLORS.some((c) => c.id === raw) ? raw : "";
    const looks = (await getHeroLooks({ includeReview: true })).map((l) =>
        bg && l.imageDesktop.includes("/hero/masters/v4_")
            ? {
                  ...l,
                  imageDesktop: `${l.imageDesktop}__${bg}`,
                  imageMobile: l.imageMobile.replace(/_mobile$/, `__${bg}_mobile`),
              }
            : l,
    );
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
