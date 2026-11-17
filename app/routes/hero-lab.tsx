/**
 * /hero-lab/:n — experiment sandbox, fully separate from /hero-gallery (that
 * page stays the client's untouched review set). Each page shows ONE concept on
 * a stack of slides with different models, so it can be judged on more than a
 * single photo.
 *   /hero-lab/best  12 new concepts (HeroLabStage2), each on its own slide; none
 *                   of the effects of pages 2-15 are reused there
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
import HeroLabStage, { type LabMode, type LabModel } from "../components/HeroLabStage";
import HeroLabStage2, { type Lab2Mode, type Lab2Model } from "../components/HeroLabStage2";
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

/** /hero-lab/best: concept → label + which slide (index in SLIDES) it is shown on */
const CONCEPTS: Array<{ mode: Lab2Mode; label: string; slide: number }> = [
    { mode: "step", label: "Крок уперед", slide: 0 },
    { mode: "depth", label: "Глибина", slide: 1 },
    { mode: "mono", label: "Чорно-біла студія", slide: 2 },
    { mode: "focus", label: "Фокус", slide: 3 },
    { mode: "column", label: "Колона кольору", slide: 1 },
    { mode: "contour", label: "Контур", slide: 4 },
    { mode: "finder", label: "Видошукач", slide: 0 },
    { mode: "marquee", label: "Рухомий рядок", slide: 2 },
    { mode: "callout", label: "Виноска", slide: 3 },
    { mode: "flash", label: "Спалах", slide: 4 },
    { mode: "thread", label: "Нитка", slide: 2 },
    { mode: "window", label: "Світло з вікна", slide: 3 },
];

type Geo = Omit<Lab2Model, "href" | "title" | "sub">;

interface LabMeta {
    models: Array<{
        cx: number;
        head: number;
        feet: number;
        frames: Record<"lit" | "back" | "aura", number[]>;
    }>;
}

export function meta() {
    return [{ title: "Hero lab — MIND BODY" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ params }: LoaderFunctionArgs) {
    if (!params.n) throw redirect("/hero-lab/best");
    const best = params.n === "best";
    if (!best && !(params.n in MODES)) throw data("Not found", { status: 404 });
    const mode = best ? ("signature" as LabMode) : MODES[params.n];
    const looks = await getHeroLooks({ includeReview: true });
    const slides = [];
    for (const { sid, variant, colors } of mode ? SLIDES : SLIDES.slice(0, 1)) {
        const look = looks.find((l) => l.imageDesktop === `/hero/masters/v4_${sid}`);
        if (!look) continue;
        const metaPath = path.join(process.cwd(), "public", "hero", "lab", sid, "meta.json");
        const labMeta = JSON.parse(await readFile(metaPath, "utf8")) as LabMeta;
        const geo = best
            ? (
                  JSON.parse(
                      await readFile(metaPath.replace("meta.json", "meta3.json"), "utf8"),
                  ) as { models: Geo[] }
              ).models
            : null;
        slides.push({
            sid,
            geo,
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
    return { mode, slides, best };
}

const chip: React.CSSProperties = {
    position: "absolute",
    bottom: 16,
    left: 16,
    zIndex: 50,
    background: "#D97757",
    color: "#fff",
    font: "700 13px/1 Onest, sans-serif",
    letterSpacing: "0.08em",
    padding: "8px 12px",
    borderRadius: 4,
};

export default function HeroLab() {
    const { mode, slides, best } = useLoaderData<typeof loader>();
    const { t } = useI18n();
    const money = useMoney();

    const stages = slides.map(({ sid, look, models, colors, geo }) => {
        const short = (look.name.match(/«([^»]+)»/)?.[1] ?? look.name).toUpperCase();
        const [lookName, lookNote] = look.kicker.split(" · ");
        return {
            sid,
            look,
            geo,
            maskDir: `/hero/lab/${sid}`,
            studioBg: look.studioBg,
            models: models.map(
                (m, k): LabModel => ({
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
                    frames: m.frames,
                    linked: !!colors,
                }),
            ),
        };
    });

    if (best) {
        return (
            <main style={{ background: "#f4f1ec" }}>
                {CONCEPTS.map(({ mode: m2, label, slide }, i) => {
                    const st = stages[slide];
                    if (!st?.geo) return null;
                    const models2 = st.geo.map(
                        (g, k): Lab2Model => ({
                            ...g,
                            href: st.models[k].href,
                            title: st.models[k].title,
                            sub: st.models[k].sub,
                        }),
                    );
                    return (
                        <div key={m2} style={{ position: "relative", marginBottom: 12 }}>
                            <div style={chip}>
                                {String(i + 1).padStart(2, "0")} · {label.toUpperCase()}
                            </div>
                            <HeroLabStage2
                                maskDir={st.maskDir}
                                studioBg={st.studioBg}
                                models={models2}
                                mode={m2}
                            />
                        </div>
                    );
                })}
            </main>
        );
    }

    return (
        <main style={{ background: "#f4f1ec" }}>
            {stages.map(({ sid, look, geo: _geo, ...stage }) => (
                <div key={sid} style={{ marginBottom: 12 }}>
                    {mode ? (
                        <HeroLabStage {...stage} mode={mode} />
                    ) : (
                        <SingleLookHero looks={[look]} />
                    )}
                </div>
            ))}
        </main>
    );
}
