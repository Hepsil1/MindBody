/**
 * /hero-lab/:n — experiment sandbox, fully separate from /hero-gallery (that
 * page stays the client's untouched review set). Each page shows ONE concept on
 * a stack of slides with different models, so it can be judged on more than a
 * single photo.
 *   /hero-lab/1   reference — the DUO CONTRAST slide exactly as in the gallery
 *   /hero-lab/2   tap/hover a model → spotlight (the rest sinks into shade)
 *   /hero-lab/3   → white back-light on the wall behind her
 *   /hero-lab/4   → camera push-in, light wave up the outfit, back-light;
 *                 idle: the models take turns glowing ("tap me")
 *   /hero-lab/5   → light spotlight + quiet caption under the feet
 *   /hero-lab/6   → colour aura: the wall takes the outfit's colour
 *   /hero-lab/7   → light ripples spread over the mirror floor from the feet
 *   /hero-lab/8   → a scan line runs head → feet and switches the fabric on
 *   /hero-lab/9   → stage beams fall behind the model, the rest goes dark
 *   /hero-lab/10  → cinema: the slide shows each model in turn by itself
 * With minimal info (name · colour · price) on the chosen model:
 *   /hero-lab/11  → glass tag above the head (colour aura)
 *   /hero-lab/12  → name printed on the mirror floor under the feet (light wave)
 *   /hero-lab/13  → editorial: the name in huge type BEHIND the model
 *   /hero-lab/14  → the cursor itself becomes the label (tag on touch)
 *   /hero-lab/15  → no new element: the CTA button turns into that outfit
 * 2–10: click / second tap opens that outfit; on phones the view glides from
 * model to model. Light frames + masks: scratch/build_hero_lab_v2.py.
 * Not linked anywhere; noindex.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { data, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import HeroLabStage, { type LabMode } from "../components/HeroLabStage";
import { useI18n, useMoney } from "../i18n";
import { getColorLabel } from "../utils/colors";
import { getHeroLooks } from "../utils/heroLooks.server";

/** slides that have light frames in public/hero/lab/<sid>/ (variant = wall colour set) */
// `colors`: per model, left → right, only where the slide is tied to a real product.
// The other slides are concept shots with no product behind them yet, so they show
// the look's own name and NO price (never invent one).
const SLIDES: Array<{ sid: string; variant: "" | "match"; colors?: string[] }> = [
    { sid: "s1_duo", variant: "match", colors: ["green", "marsala"] },
    { sid: "u21_palette", variant: "match" },
    { sid: "n3_red360", variant: "match" },
    { sid: "u15_fuchsia", variant: "" },
    { sid: "u05_forest_set", variant: "match" },
];

const MODES: Record<string, LabMode | null> = {
    "1": null,
    "2": "spot",
    "3": "rim",
    "4": "fabric",
    "5": "caption",
    "6": "aura",
    "7": "ripple",
    "8": "scan",
    "9": "beams",
    "10": "cinema",
    "11": "tag",
    "12": "floor",
    "13": "editorial",
    "14": "cursor",
    "15": "cta",
};

interface LabMeta {
    models: Array<{ cx: number; head: number; feet: number }>;
}

export function meta() {
    return [{ title: "Hero lab — MIND BODY" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ params }: LoaderFunctionArgs) {
    if (!params.n) throw redirect("/hero-lab/1");
    if (!(params.n in MODES)) throw data("Not found", { status: 404 });
    const mode = MODES[params.n];
    const looks = await getHeroLooks({ includeReview: true });
    const slides = [];
    for (const { sid, variant, colors } of mode ? SLIDES : SLIDES.slice(0, 1)) {
        const look = looks.find((l) => l.imageDesktop === `/hero/masters/v4_${sid}`);
        if (!look) continue;
        const metaPath = path.join(process.cwd(), "public", "hero", "lab", sid, "meta.json");
        const labMeta = JSON.parse(await readFile(metaPath, "utf8")) as LabMeta;
        slides.push({
            sid,
            colors: colors ?? null,
            models: labMeta.models,
            look: variant
                ? {
                      ...look,
                      imageDesktop: `${look.imageDesktop}__${variant}`,
                      imageMobile: look.imageMobile.replace(/_mobile$/, `__${variant}_mobile`),
                  }
                : look,
        });
    }
    if (!slides.length) throw data("Not found", { status: 404 });
    return { mode, slides };
}

export default function HeroLab() {
    const { mode, slides } = useLoaderData<typeof loader>();
    const { t } = useI18n();
    const money = useMoney();
    return (
        <main style={{ background: "#f4f1ec" }}>
            {slides.map(({ sid, look, models, colors }) => {
                const short = (look.name.match(/«([^»]+)»/)?.[1] ?? look.name).toUpperCase();
                const [lookName, lookNote] = look.kicker.split(" · ");
                return (
                    <div key={sid} style={{ marginBottom: 12 }}>
                        {mode ? (
                            <HeroLabStage
                                image={look.imageDesktop}
                                maskDir={`/hero/lab/${sid}`}
                                mode={mode}
                                studioBg={look.studioBg}
                                models={models.map((m, k) => ({
                                    href: colors
                                        ? `/p/${look.productSlug}?color=${colors[k]}`
                                        : `/p/${look.productSlug}`,
                                    title: colors ? short : lookName,
                                    sub: colors
                                        ? `${t(getColorLabel(colors[k]))} · ${money(look.price)}`
                                        : (lookNote ?? ""),
                                    cx: m.cx,
                                    head: m.head,
                                    feet: m.feet,
                                }))}
                            />
                        ) : (
                            <SingleLookHero looks={[look]} />
                        )}
                    </div>
                );
            })}
        </main>
    );
}
