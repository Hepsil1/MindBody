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

/** /hero-lab: the effects, in the order of the bar - first the ones on her outfit */
const EFFECTS: Array<{ mode: LiveMode; label: string; hint: string }> = [
    {
        mode: "sheen",
        label: "Блік",
        hint: "Смуга світла пробігає по тканині костюма, як по атласу під лампою",
    },
    {
        mode: "touch",
        label: "Дотик",
        hint: "Від точки дотику світло розходиться по тканині і лишається",
    },
    {
        mode: "scan",
        label: "Скан",
        hint: "Лінія світла проходить згори донизу і вмикає тканину",
    },
    {
        mode: "contour",
        label: "Контур",
        hint: "Лінія починається там, де ви торкнулись моделі, і обходить її",
    },
    {
        mode: "shadow",
        label: "Тінь",
        hint: "Тінь моделі виходить з-за неї на стіну і лишається",
    },
    {
        mode: "arch",
        label: "Арка",
        hint: "Арка малюється за моделлю двома лініями, назва лягає на її дугу",
    },
    {
        mode: "measure",
        label: "Мірка",
        hint: "Кравецька мірка на весь зріст: поділки відлічуються зверху вниз",
    },
    {
        mode: "loop",
        label: "Рядок",
        hint: "Назва безперервно біжить навколо моделі вздовж її силуету",
    },
    {
        mode: "focus",
        label: "Фокус",
        hint: "Камера переводить фокус на модель: студія й інші м'яко розмиваються, різка лише вона",
    },
    {
        mode: "frame",
        label: "Видошукач",
        hint: "Рамка видошукача стягується на модель, фокус ловить її, клацає затвор",
    },
    {
        mode: "cover",
        label: "Обкладинка",
        hint: "Як на обкладинці журналу: величезна назва на стіні позаду моделі, вона стоїть перед літерами",
    },
    {
        mode: "tag",
        label: "Бирка",
        hint: "Паперова бирка з назвою й ціною спускається на нитці поруч і погойдується",
    },
    {
        mode: "spot",
        label: "Прожектор",
        hint: "Сцена темніє, згори на модель падає промінь прожектора й світла пляма біля ніг",
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
        // the same slide on its original wall (built into lab/<sid>__c)
        const cPath = metaPath.replace(
            `${sid}${path.sep}meta.json`,
            `${sid}__c${path.sep}meta6.json`,
        );
        const classic =
            best && variant
                ? await readFile(cPath, "utf8")
                      .then((t) => (JSON.parse(t) as { models: Geo[] }).models)
                      .catch(() => null)
                : null;
        slides.push({
            sid,
            geo,
            geoC: classic,
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

    const stages = slides.map(({ sid, look, models, colors, geo, geoC }) => {
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
            // original wall: its own folder when the slide is recoloured, else the same
            maskDirC: geoC ? `/hero/lab/${sid}__c` : `/hero/lab/${sid}`,
            models2C: (geoC ?? geo ?? []).map((g, k): LiveModel => ({ ...g, ...info(k) })),
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
            {stages.map(({ sid, look, models2: _m2, models2C: _c, maskDirC: _d, ...stage }) => (
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
    maskDirC: string;
    studioBg?: string;
    models2: LiveModel[];
    models2C: LiveModel[];
}

/** the lab page: the hero at its real size, and one slim bar to pick effect + slide */
function LabPlayer({ stages }: { stages: StageData[] }) {
    const [fx, setFx] = useState(0);
    const [slide, setSlide] = useState(0);
    const [open, setOpen] = useState(false);
    /** the original photograph (true) or the wall recoloured to her outfit */
    const [classic, setClassic] = useState(true);
    const go = (d: number) => setSlide((i) => (i + d + stages.length) % stages.length);
    // keyboard: 1-9 and 0 effect, arrows slide
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            const n = Number(e.key);
            if (e.key === "0") setFx(9);
            else if (n >= 1 && n <= EFFECTS.length) setFx(n - 1);
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // the list of slides closes when anything else is pressed
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (!(e.target as Element).closest?.(".hldock__slides")) setOpen(false);
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [open]);
    // keep the chosen effect in view when the row scrolls (phone)
    useEffect(() => {
        document
            .querySelector(".hldock__fx .is-on")
            ?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [fx]);

    const st = stages[slide];
    const e = EFFECTS[fx];
    if (!st?.models2.length) return null;
    const dir = classic ? st.maskDirC : st.maskDir;
    const ms = classic ? st.models2C : st.models2;
    // a busy print / hair the colour of the suit: the outfit can't be lit on its own here
    const noFab = ms.every((m) => m.fab === false);
    const FAB_MODES: LiveMode[] = ["sheen", "touch", "scan"];
    return (
        <main className="hllab">
            <HeroLabLive
                key={`${dir}-${e.mode}`}
                maskDir={dir}
                studioBg={st.studioBg}
                models={ms}
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
                            title={
                                noFab && FAB_MODES.includes(x.mode)
                                    ? "На цьому слайді костюм не відділити від моделі — замість ефекту на тканині тут контур"
                                    : x.hint
                            }
                            className={`${i === fx ? "is-on" : ""} ${noFab && FAB_MODES.includes(x.mode) ? "is-off" : ""}`}
                            onClick={() => setFx(i)}
                        >
                            <span>{i + 1}</span>
                            {x.label}
                        </button>
                    ))}
                </div>
                <div className="hldock__wall" role="group" aria-label="Фон">
                    <button
                        type="button"
                        className={classic ? "is-on" : ""}
                        aria-pressed={classic}
                        onClick={() => setClassic(true)}
                    >
                        Оригінал
                    </button>
                    <button
                        type="button"
                        className={classic ? "" : "is-on"}
                        aria-pressed={!classic}
                        onClick={() => setClassic(false)}
                    >
                        Колір
                    </button>
                </div>
                <div className="hldock__slides">
                    <button
                        type="button"
                        className="hldock__arrow"
                        aria-label="Попередній слайд"
                        onClick={() => go(-1)}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        className="hldock__count"
                        aria-expanded={open}
                        aria-label="Усі слайди"
                        onClick={() => setOpen((o) => !o)}
                    >
                        <img src={`${dir}/thumb.webp`} alt="" />
                        {slide + 1} / {stages.length}
                    </button>
                    <button
                        type="button"
                        className="hldock__arrow"
                        aria-label="Наступний слайд"
                        onClick={() => go(1)}
                    >
                        ›
                    </button>
                    {open && (
                        <div className="hldock__panel" role="tablist" aria-label="Слайд">
                            {stages.map((x, i) => (
                                <button
                                    key={x.sid}
                                    type="button"
                                    role="tab"
                                    aria-selected={i === slide}
                                    aria-label={`Слайд ${i + 1}`}
                                    className={i === slide ? "is-on" : ""}
                                    onClick={() => {
                                        setSlide(i);
                                        setOpen(false);
                                    }}
                                >
                                    <img
                                        src={`${classic ? x.maskDirC : x.maskDir}/thumb.webp`}
                                        alt=""
                                    />
                                    <span>{i + 1}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </nav>
        </main>
    );
}
