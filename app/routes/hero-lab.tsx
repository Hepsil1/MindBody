/**
 * /hero-lab/:n — experiment sandbox, fully separate from /hero-gallery (that
 * page stays the client's untouched review set). Each page shows ONE concept on
 * a stack of slides with different models, so it can be judged on more than a
 * single photo.
 *   /hero-lab     the set offered to the client: the nine strongest variants grown
 *                 from the three ideas the owner kept (colour behind the model,
 *                 camera light, a drawn line) — HeroLabStage2. Every variant
 *                 can be switched to any of 15 slides.
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
import { useState } from "react";
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

/** /hero-lab: variant → group, label, what happens, and the slide (index in LAB_SLIDES) it opens on */
const GROUPS = ["Колір за моделлю", "Світло", "Лінія"];
const CONCEPTS: Array<{ mode: Lab2Mode; g: number; label: string; note: string; slide: number }> = [
    {
        mode: "column",
        g: 0,
        label: "Колона",
        note: "Паперовий фон кольору костюма розгортається згори, назва надрукована на ньому",
        slide: 1,
    },
    {
        mode: "arch",
        g: 0,
        label: "Арка",
        note: "Класична арка виростає від підлоги, назва курсивом у її склепінні",
        slide: 7,
    },
    {
        mode: "disc",
        g: 0,
        label: "Коло",
        note: "Коло кольору розкривається за плечима, підпис іде по дузі",
        slide: 3,
    },
    {
        mode: "silh",
        g: 0,
        label: "Силует",
        note: "З-за моделі виходять два її силуети в кольорі костюма, поруч назва курсивом",
        slide: 5,
    },
    {
        mode: "flash",
        g: 1,
        label: "Спалах",
        note: "Спалах камери: різка тінь на стіні, наліпки з назвою",
        slide: 13,
    },
    {
        mode: "colflash",
        g: 1,
        label: "Спалах на кольорі",
        note: "Спалах — і за моделлю вже кольоровий фон з її тінню",
        slide: 2,
    },
    {
        mode: "contour",
        g: 2,
        label: "Контур",
        note: "Тонка лінія обводить модель від стоп до голови, текст пишеться вздовж неї",
        slide: 4,
    },
    {
        mode: "archline",
        g: 2,
        label: "Арка лінією",
        note: "Арка малюється від підлоги до вершини, підпис висить під нею, як замковий камінь",
        slide: 10,
    },
    {
        mode: "frame",
        g: 2,
        label: "Рамка",
        note: "Подвійна рамка зі стиками, як у галереї, і табличка з назвою",
        slide: 11,
    },
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
                      await readFile(metaPath.replace("meta.json", "meta5.json"), "utf8"),
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
            models2: (geo ?? []).map((g, k): Lab2Model => ({ ...g, ...info(k) })),
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

    if (best) {
        return (
            <main className="hlabx">
                <section className="hlabx__index">
                    <h1>Hero lab · {CONCEPTS.length} варіантів</h1>
                    <p>
                        Наведіть на модель (на телефоні — торкніться): спрацює варіант, клік
                        відкриває товар. Кружечки з цифрами праворуч перемикають слайд — будь-який
                        варіант можна подивитися на {stages.length} слайдах з різними моделями.
                    </p>
                    <div className="hlabx__groups">
                        {GROUPS.map((g, gi) => (
                            <div key={g}>
                                <h3>{g}</h3>
                                {CONCEPTS.map((c, i) =>
                                    c.g === gi ? (
                                        <a key={c.mode} href={`#v${i + 1}`}>
                                            <span>{String(i + 1).padStart(2, "0")}</span>
                                            {c.label}
                                        </a>
                                    ) : null,
                                )}
                            </div>
                        ))}
                    </div>
                </section>
                {CONCEPTS.map((c, i) => (
                    <Variant key={c.mode} n={i + 1} concept={c} stages={stages} />
                ))}
            </main>
        );
    }

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
    models2: Lab2Model[];
}

/** one variant: a caption bar (outside the hero) + the hero on a chosen slide */
function Variant({
    n,
    concept,
    stages,
}: {
    n: number;
    concept: (typeof CONCEPTS)[number];
    stages: StageData[];
}) {
    const [slide, setSlide] = useState(Math.min(concept.slide, stages.length - 1));
    const st = stages[slide];
    if (!st?.models2.length) return null;
    return (
        <article className="hlabx__item" id={`v${n}`}>
            <header className="hlabx__bar">
                <b>{String(n).padStart(2, "0")}</b>
                <h2>{concept.label}</h2>
                <p>{concept.note}</p>
                <div className="hlabx__slides" role="tablist" aria-label="Слайд">
                    {stages.map((s, i) => (
                        <button
                            key={s.sid}
                            type="button"
                            role="tab"
                            aria-selected={i === slide}
                            className={i === slide ? "is-on" : ""}
                            onClick={() => setSlide(i)}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            </header>
            <HeroLabStage2
                key={st.sid}
                maskDir={st.maskDir}
                studioBg={st.studioBg}
                models={st.models2}
                mode={concept.mode}
            />
        </article>
    );
}
