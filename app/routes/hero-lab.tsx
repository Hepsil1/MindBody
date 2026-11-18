/**
 * /hero-lab/:n — experiment sandbox, fully separate from /hero-gallery (that
 * page stays the client's untouched review set). Each page shows ONE concept on
 * a stack of slides with different models, so it can be judged on more than a
 * single photo.
 *   /hero-lab     the set offered to the client: ONE full hero + a dock below it to
 *                 pick the effect (4) and the slide (15). The slide is a layered
 *                 scene (HeroLabLive, scratch/build_hero_lab_v6.py), so the
 *                 effects come from the model herself and follow the pointer.
 * Older experiments, kept for reference only:
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
import { useEffect, useState } from "react";
import { data, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import SingleLookHero from "../components/SingleLookHero";
import HeroLabStage, { type LabMode, type LabModel } from "../components/HeroLabStage";
import HeroLabLive, { type LiveMode, type LiveModel } from "../components/HeroLabLive";
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

/** slides of /hero-lab: the five above + ten more, so the variants meet different models */
const LAB_SLIDES: typeof SLIDES = [
    ...SLIDES,
    { sid: "s2_cocoa360", variant: "match" },
    { sid: "u01_leo", variant: "match" },
    { sid: "u04_violet", variant: "match" },
    { sid: "u06_rose_set", variant: "match" },
    { sid: "u09_navy", variant: "match" },
    { sid: "u12_noir", variant: "match" },
    { sid: "u13_stripe", variant: "match" },
    { sid: "u16_lilac", variant: "match" },
    { sid: "u17_piping", variant: "match" },
    { sid: "u18_sky_zip", variant: "match" },
];

/** /hero-lab: the effects, in the order of the dock */
const EFFECTS: Array<{ mode: LiveMode; label: string; hint: string }> = [
    {
        mode: "contour",
        label: "Контур",
        hint: "Лінія починається там, де ви торкнулись моделі, і обходить її; намистинка їде по лінії за курсором",
    },
    {
        mode: "arch",
        label: "Арка",
        hint: "Арка малюється двома лініями від підлоги до вершини, назва лягає на її дугу",
    },
    {
        mode: "shadow",
        label: "Тінь",
        hint: "Курсор — це лампа: тінь виростає зі ступнів і хилиться від світла",
    },
    {
        mode: "duo",
        label: "Кольорові тіні",
        hint: "Дві лампи — дві тіні в кольорах костюма, рухаються за курсором",
    },
    {
        mode: "ripple",
        label: "Хвилі",
        hint: "Чотири контури розходяться від моделі, як кола на воді, і дихають",
    },
    {
        mode: "loop",
        label: "Рядок",
        hint: "Назва безперервно біжить навколо моделі вздовж її силуету",
    },
    {
        mode: "stitch",
        label: "Викрійка",
        hint: "Кравецький шов обходить модель, по ньому ходить голка",
    },
    {
        mode: "measure",
        label: "Мірка",
        hint: "Кравецька мірка на весь зріст: поділки відлічуються зверху вниз",
    },
    {
        mode: "offset",
        label: "Зсув",
        hint: "Два контури — білий і в кольорі костюма — розходяться за курсором, як друк зі зсувом",
    },
    {
        mode: "duet",
        label: "Контур і тінь",
        hint: "Тінь від лампи і лінія навколо моделі разом",
    },
];

type Geo = Omit<LiveModel, "href" | "title" | "sub">;

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
    if (params.n === "best") throw redirect("/hero-lab");
    const best = !params.n;
    if (!best && !(params.n! in MODES)) throw data("Not found", { status: 404 });
    const mode = best ? ("spot" as LabMode) : MODES[params.n!];
    const looks = await getHeroLooks({ includeReview: true });
    const slides = [];
    const list = best ? LAB_SLIDES : mode ? SLIDES : SLIDES.slice(0, 1);
    for (const { sid, variant, colors } of list) {
        const look = looks.find((l) => l.imageDesktop === `/hero/masters/v4_${sid}`);
        if (!look) continue;
        const metaPath = path.join(process.cwd(), "public", "hero", "lab", sid, "meta.json");
        const labMeta = best
            ? { models: [] }
            : (JSON.parse(await readFile(metaPath, "utf8")) as LabMeta);
        const geo = best
            ? (
                  JSON.parse(
                      await readFile(metaPath.replace("meta.json", "meta6.json"), "utf8"),
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

export default function HeroLab() {
    const { mode, slides, best } = useLoaderData<typeof loader>();
    const { t } = useI18n();
    const money = useMoney();

    const stages = slides.map(({ sid, look, models, colors, geo }) => {
        const short = (look.name.match(/«([^»]+)»/)?.[1] ?? look.name).toUpperCase();
        const [lookName, lookNote] = look.kicker.split(" · ");
        const info = (k: number) => ({
            href: colors ? `/p/${look.productSlug}?color=${colors[k]}` : `/p/${look.productSlug}`,
            title: colors ? short : lookName,
            sub: colors
                ? `${t(getColorLabel(colors[k]))} · ${money(look.price)}`
                : (lookNote ?? ""),
        });
        return {
            sid,
            look,
            maskDir: `/hero/lab/${sid}`,
            studioBg: look.studioBg,
            models2: (geo ?? []).map((g, k): LiveModel => ({ ...g, ...info(k) })),
            models: models.map(
                (m, k): LabModel => ({
                    ...info(k),
                    cx: m.cx,
                    head: m.head,
                    feet: m.feet,
                    frames: m.frames,
                    linked: !!colors,
                }),
            ),
        };
    });

    if (best) return <LabPlayer stages={stages} />;

    return (
        <main style={{ background: "#f4f1ec" }}>
            {stages.map(({ sid, look, models2: _m2, ...stage }) => (
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

interface StageData {
    sid: string;
    maskDir: string;
    studioBg?: string;
    models2: LiveModel[];
}

/** the lab page: one full hero, and a dock under it to pick effect + slide */
function LabPlayer({ stages }: { stages: StageData[] }) {
    const [fx, setFx] = useState(0);
    const [slide, setSlide] = useState(0);
    const go = (d: number) => setSlide((i) => (i + d + stages.length) % stages.length);
    // keyboard: 1-4 effect, arrows slide
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            const n = Number(e.key);
            if (e.key === "0") setFx(9);
            else if (n >= 1 && n <= EFFECTS.length) setFx(n - 1);
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // keep the chosen thumbnail in view
    useEffect(() => {
        document
            .querySelector(".hldock__thumbs .is-on")
            ?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [slide]);

    const st = stages[slide];
    const e = EFFECTS[fx];
    if (!st?.models2.length) return null;
    return (
        <main className="hllab">
            <HeroLabLive
                key={`${st.sid}-${e.mode}`}
                maskDir={st.maskDir}
                studioBg={st.studioBg}
                models={st.models2}
                mode={e.mode}
            />
            <nav className="hldock" aria-label="Hero lab">
                <div className="hldock__fx" role="tablist" aria-label="Ефект">
                    {EFFECTS.map((x, i) => (
                        <button
                            key={x.mode}
                            type="button"
                            role="tab"
                            aria-selected={i === fx}
                            className={i === fx ? "is-on" : ""}
                            onClick={() => setFx(i)}
                        >
                            <span>{i + 1}</span>
                            {x.label}
                        </button>
                    ))}
                </div>
                <div className="hldock__row">
                    <div className="hldock__slides">
                        <button
                            type="button"
                            className="hldock__arrow"
                            aria-label="Попередній слайд"
                            onClick={() => go(-1)}
                        >
                            ‹
                        </button>
                        <div className="hldock__thumbs" role="tablist" aria-label="Слайд">
                            {stages.map((s, i) => (
                                <button
                                    key={s.sid}
                                    type="button"
                                    role="tab"
                                    aria-selected={i === slide}
                                    aria-label={`Слайд ${i + 1}`}
                                    className={i === slide ? "is-on" : ""}
                                    onClick={() => setSlide(i)}
                                >
                                    <img src={`${s.maskDir}/thumb.webp`} alt="" loading="lazy" />
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="hldock__arrow"
                            aria-label="Наступний слайд"
                            onClick={() => go(1)}
                        >
                            ›
                        </button>
                    </div>
                    <p className="hldock__hint">
                        <b>{e.label}</b>
                        {e.hint}
                    </p>
                </div>
            </nav>
        </main>
    );
}
