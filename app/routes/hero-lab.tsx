/**
 * /hero-lab/:n — experiment sandbox, one hero slide per example, fully
 * separate from /hero-gallery (that page stays the client's untouched
 * review set).
 *   /hero-lab/1   reference — the DUO CONTRAST slide exactly as in the gallery
 *   /hero-lab/2   tap/hover a model → spotlight (the rest sinks into shade)
 *   /hero-lab/3   → rim light traces the silhouette
 *   /hero-lab/4   → soft light sweep across the garment only
 *   /hero-lab/5   → light spotlight + quiet caption under the feet
 * 2–5: click / second tap opens that outfit (with its colour); on phones the
 * 16:9 frame pans between the two models. Masks: scratch/build_hero_lab_masks.py.
 * Not linked anywhere; noindex.
 */
import { data, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import HeroLabStage, { type LabMode } from "../components/HeroLabStage";
import { useMoney } from "../i18n";
import { getHeroLooks } from "../utils/heroLooks.server";
import { getColorLabel } from "../utils/colors";

const SLIDE = "v4_s1_duo";
const VARIANT = "match";
const MASKS = "/hero/lab/s1_duo";
/** left → right, matches the order of the generated masks */
const MODELS = [
    { color: "green", cx: 0.2191, head: 0.2222, feet: 0.8688 },
    { color: "marsala", cx: 0.7854, head: 0.2222, feet: 0.8688 },
];

const MODES: Record<string, LabMode | null> = {
    "1": null,
    "2": "spot",
    "3": "rim",
    "4": "fabric",
    "5": "caption",
};

export function meta() {
    return [{ title: "Hero lab — MIND BODY" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ params }: LoaderFunctionArgs) {
    if (!params.n) throw redirect("/hero-lab/1");
    if (!(params.n in MODES)) throw data("Not found", { status: 404 });
    const look = (await getHeroLooks({ includeReview: true })).find(
        (l) => l.imageDesktop === `/hero/masters/${SLIDE}`,
    );
    if (!look) throw data("Not found", { status: 404 });
    return {
        mode: MODES[params.n],
        look: {
            ...look,
            imageDesktop: `${look.imageDesktop}__${VARIANT}`,
            imageMobile: look.imageMobile.replace(/_mobile$/, `__${VARIANT}_mobile`),
        },
    };
}

export default function HeroLab() {
    const { look, mode } = useLoaderData<typeof loader>();
    const money = useMoney();
    const short = (look.name.match(/«([^»]+)»/)?.[1] ?? look.name).toUpperCase();
    return (
        <main style={{ background: "#f4f1ec" }}>
            {mode ? (
                <HeroLabStage
                    image={look.imageDesktop}
                    maskDir={MASKS}
                    mode={mode}
                    studioBg={look.studioBg}
                    models={MODELS.map((m) => ({
                        href: `/p/${look.productSlug}?color=${m.color}`,
                        caption: `${short} · ${getColorLabel(m.color)} · ${money(look.price)}`,
                        cx: m.cx,
                        head: m.head,
                        feet: m.feet,
                    }))}
                />
            ) : (
                <SingleLookHero looks={[look]} />
            )}
        </main>
    );
}
