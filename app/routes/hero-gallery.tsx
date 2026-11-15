/**
 * /hero-gallery — review page: every hero slide stacked, each rendered by the
 * real SingleLookHero (same header, logo, CTA, crops) so the owner can compare
 * all concepts on the live layout. `?bg=sand|clay|sage|mist|blush` swaps in the
 * background-colour variants (v4_<slide>__<colour>). Not linked anywhere; noindex.
 */
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import { getHeroLooks } from "../utils/heroLooks.server";

const COLORS = [
    { id: "", label: "Оригінал", swatch: "#d9d6da" },
    { id: "sand", label: "Sand", swatch: "#c4b29c" },
    { id: "clay", label: "Clay", swatch: "#b28068" },
    { id: "sage", label: "Sage", swatch: "#96a08c" },
    { id: "mist", label: "Mist", swatch: "#9caaba" },
    { id: "blush", label: "Blush", swatch: "#c4a098" },
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
    const { looks, bg } = useLoaderData<typeof loader>();
    return (
        <main style={{ background: "#111" }}>
            <nav
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 100,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "10px 16px",
                    background: "rgba(17,17,17,.92)",
                    font: "600 13px/1 Onest, sans-serif",
                }}
            >
                {COLORS.map((c) => (
                    <Link
                        key={c.id || "orig"}
                        to={c.id ? `?bg=${c.id}` : "?"}
                        reloadDocument
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: 999,
                            color: "#fff",
                            textDecoration: "none",
                            border: `1px solid ${bg === c.id ? "#fff" : "rgba(255,255,255,.2)"}`,
                        }}
                    >
                        <span
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                background: c.swatch,
                            }}
                        />
                        {c.label}
                    </Link>
                ))}
            </nav>
            {looks.map((look) => (
                <div key={look.slug} style={{ position: "relative", marginBottom: 24 }}>
                    <div
                        style={{
                            position: "absolute",
                            top: 76,
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
