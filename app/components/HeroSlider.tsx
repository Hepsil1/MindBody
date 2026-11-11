import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useI18n, LLink } from "../i18n";
import { getLqipStyle } from "../utils/lqip";
import "../styles/hero.css";

export type FableLayoutMode = "solo" | "duo" | "trio" | "macro" | "single" | "triptych";

export interface FrameItem {
    src: string;
    alt: string;
    focus?: string;
}

export interface SlideData {
    id: string;
    label?: string;
    name?: string;
    tag?: string;
    title?: string;
    desc?: string;
    layout?: FableLayoutMode;
    type?: string;
    bg?: string;
    ink?: string;
    link?: string | null;
    frames?: FrameItem[];
    mobileImage?: string;
    // Backward-compatibility properties
    image1?: string;
    image2?: string | null;
    image3?: string | null;
    image1Pos?: string;
    image2Pos?: string;
    image3Pos?: string;
    images?: Array<{ src: string; pos?: string; alt: string }>;
}

export type FableSlide = SlideData;

export const defaultSlides: SlideData[] = [
    {
        id: "s1",
        label: "Plum Laced Back",
        name: "S1 · Open Laced Back (1 модель)",
        tag: "SIGNATURE PIECE",
        title: "SCULPTED OPEN BACK",
        desc: "Культовий комбінезон зі скульптурною шнуровкою на спині та фірмовою вишивкою-мандалою.",
        layout: "solo",
        bg: "#F2ECEF",
        ink: "#261622",
        link: "/shop/casual",
        frames: [
            {
                src: "fable-s1-plum-back",
                alt: "MIND BODY — Сливовий комбінезон зі шнуровкою на спині",
                focus: "50% 25%",
            },
        ],
    },
    {
        id: "s2",
        label: "Studio Duo",
        name: "S2 · Duo Campaign (2 моделі)",
        tag: "TWO SILHOUETTES",
        title: "DUALITY OF FORM",
        desc: "Дві моделі в єдиному просторі студії: комбінезони кльош у відтінках Rich Plum та Obsidian Black.",
        layout: "solo",
        bg: "#E8E5EA",
        ink: "#1C1620",
        link: "/shop/sport",
        frames: [
            {
                src: "fable-s2-duo-models",
                alt: "MIND BODY — Дві моделі у комбінезонах кльош з капюшоном",
                focus: "50% 25%",
            },
        ],
    },
    {
        id: "s3",
        label: "Tricolor Triad",
        name: "S3 · The Triad (3 моделі)",
        tag: "SIGNATURE TRIAD",
        title: "COLOR & MOVEMENT",
        desc: "Три стихії колекції: Midnight Hooded, Deep Petrol Yoga та Rich Plum Mandala.",
        layout: "trio",
        bg: "#E2ECEB",
        ink: "#112323",
        link: "/shop",
        frames: [
            {
                src: "fable-s3-black",
                alt: "MIND BODY — Чорний комбінезон з капюшоном",
                focus: "50% 20%",
            },
            {
                src: "fable-s3-teal",
                alt: "MIND BODY — Бірюзовий комбінезон для йоги",
                focus: "50% 20%",
            },
            {
                src: "fable-s3-plum",
                alt: "MIND BODY — Сливовий портрет з вишитою мандалою",
                focus: "50% 20%",
            },
        ],
    },
    {
        id: "s4",
        label: "Dual-Focus Lens",
        name: "S4 · Macro Lens (Лінза 2.4×)",
        tag: "INTERACTIVE LENS · 2.4× MACRO",
        title: "ANATOMY OF LACES",
        desc: "Наведіть або торкніться екрана: 2.4× оптична лінза розкриває переплетення ниток та точність швів.",
        layout: "macro",
        bg: "#141316",
        ink: "#F2ECE8",
        link: "/shop/yoga",
        frames: [
            {
                src: "fable-s4-macro-lacing",
                alt: "MIND BODY — Макро деталізація шнуровки та мандали",
                focus: "50% 22%",
            },
        ],
    },
    {
        id: "s5",
        label: "Haute Runway",
        name: "S5 · Espresso Runway (1 модель)",
        tag: "EDITORIAL STATEMENT",
        title: "ESPRESSO RUNWAY",
        desc: "Шоколадний комбінезон другого шару в поєднанні з еко-шубою та масивними черевиками.",
        layout: "solo",
        bg: "#EFEAE3",
        ink: "#281D17",
        link: "/shop/casual",
        frames: [
            {
                src: "fable-s5-espresso-fur",
                alt: "MIND BODY — Шоколадний комбінезон з шубою та черевиками",
                focus: "50% 25%",
            },
        ],
    },
];

const WIDTHS = [640, 960, 1440, 1920, 2560, 3200];

function PictureFrame({ frame, eager }: { frame: FrameItem; eager?: boolean }) {
    const baseSrc = frame.src.startsWith("/")
        ? frame.src.replace(/\.(webp|avif|jpg)$/, "")
        : `/hero/${frame.src}`;

    const avifSrcSet =
        WIDTHS.map((w) => `${baseSrc}-${w}w.avif ${w}w`).join(", ") + `, ${baseSrc}.avif 3840w`;
    const webpSrcSet =
        WIDTHS.map((w) => `${baseSrc}-${w}w.webp ${w}w`).join(", ") + `, ${baseSrc}.webp 3840w`;
    const jpgSrcSet = WIDTHS.map((w) => `${baseSrc}-${w}w.jpg ${w}w`).join(", ");

    const sizes = "(max-width: 768px) 86vw, (max-width: 1280px) 46vw, 36vw";
    const lqip = getLqipStyle(`${baseSrc}.webp`) || getLqipStyle(baseSrc);

    return (
        <picture>
            <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
            <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
            <img
                src={`${baseSrc}-1920w.jpg`}
                srcSet={jpgSrcSet}
                sizes={sizes}
                alt={frame.alt}
                decoding="async"
                draggable={false}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : "auto"}
                style={{
                    ...lqip,
                    objectPosition: frame.focus || "50% 25%",
                }}
            />
        </picture>
    );
}

interface HeroSliderProps {
    slides?: SlideData[];
    autoPlay?: boolean;
    interval?: number;
    children?: ReactNode;
}

export default function HeroSlider({
    slides: propSlides,
    autoPlay = true,
    interval = 7000,
}: HeroSliderProps) {
    const { t } = useI18n();
    const hasFableSlides = propSlides && propSlides.some((s) => s.frames && s.frames.length > 0);
    const slides = hasFableSlides ? propSlides : defaultSlides;

    const [activeSlide, setActiveSlide] = useState(() => {
        if (typeof window === "undefined") return 0;
        const params = new URLSearchParams(window.location.search);
        const heroParam = params.get("hero");
        const map: Record<string, number> = { s1: 0, s2: 1, s3: 2, s4: 3, s5: 4 };
        if (heroParam && heroParam in map) {
            return map[heroParam];
        }
        return 0;
    });
    const [paused, setPaused] = useState(false);
    const [isCompareMode, setIsCompareMode] = useState(false);
    const rootRef = useRef<HTMLElement>(null);

    // URL parameter sync (?hero=compare, ?hero=s1, etc.)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const syncFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const heroParam = params.get("hero");
            const slideParam = params.get("slide");

            if (heroParam === "compare") {
                setIsCompareMode(true);
            } else if (heroParam) {
                const variantMap: Record<string, number> = {
                    s1: 0,
                    s2: 1,
                    s3: 2,
                    s4: 3,
                    s5: 4,
                };
                if (heroParam in variantMap) {
                    setActiveSlide(variantMap[heroParam]);
                }
            } else if (slideParam) {
                const idx = parseInt(slideParam, 10);
                if (!isNaN(idx) && idx >= 0 && idx < slides.length) {
                    setActiveSlide(idx);
                }
            }
        };

        syncFromUrl();
        window.addEventListener("popstate", syncFromUrl);
        return () => window.removeEventListener("popstate", syncFromUrl);
    }, [slides.length]);

    const go = useCallback(
        (n: number) => {
            const nextIdx = (n + slides.length) % slides.length;
            setActiveSlide(nextIdx);
            if (isCompareMode && typeof window !== "undefined" && window.history?.replaceState) {
                const url = new URL(window.location.href);
                const variantMap: Record<number, string> = {
                    0: "s1",
                    1: "s2",
                    2: "s3",
                    3: "s4",
                    4: "s5",
                };
                if (variantMap[nextIdx]) {
                    url.searchParams.set("hero", variantMap[nextIdx]);
                }
                window.history.replaceState({}, "", url.toString());
            }
        },
        [slides.length, isCompareMode],
    );

    useEffect(() => {
        const isTargetedSlide =
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("hero");
        if (!autoPlay || paused || isCompareMode || isTargetedSlide || slides.length <= 1) return;

        const timer = setInterval(() => {
            go(activeSlide + 1);
        }, interval);

        return () => clearInterval(timer);
    }, [activeSlide, autoPlay, interval, isCompareMode, paused, slides.length, go]);

    // Dual-Focus Lens: Updates pointer position via CSS variables directly (0 React rerender overhead)
    const onMove = (e: React.PointerEvent<HTMLElement>) => {
        const stage = e.currentTarget;
        const rect = stage.getBoundingClientRect();
        const root = rootRef.current;
        if (!root) return;
        const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        root.style.setProperty("--lx", `${xPercent.toFixed(1)}%`);
        root.style.setProperty("--ly", `${yPercent.toFixed(1)}%`);
    };

    const currentSlide = slides[activeSlide] || slides[0];

    // Normalize frames
    const getFrames = (s: SlideData): FrameItem[] => {
        if (s.frames && s.frames.length > 0) return s.frames;
        if (s.images && s.images.length > 0) {
            return s.images.map((img) => ({
                src: img.src.replace(/^\/hero\//, "").replace(/\.(webp|avif|jpg)$/, ""),
                alt: img.alt || s.title || "MIND BODY",
                focus: img.pos,
            }));
        }
        const res: FrameItem[] = [];
        if (s.image1) res.push({ src: s.image1, alt: s.name || "MIND BODY", focus: s.image1Pos });
        if (s.image2) res.push({ src: s.image2, alt: s.name || "MIND BODY", focus: s.image2Pos });
        if (s.image3) res.push({ src: s.image3, alt: s.name || "MIND BODY", focus: s.image3Pos });
        return res;
    };

    const activeFrames = getFrames(currentSlide);
    const layout = currentSlide.layout || "solo";

    return (
        <section
            ref={rootRef}
            className="fable-luxury-hero"
            id="hero"
            aria-roledescription="carousel"
            aria-label={t("Вітрина бренду MIND BODY")}
            style={
                {
                    "--bg": currentSlide.bg || "#F2ECEF",
                    "--ink": currentSlide.ink || "#261622",
                } as React.CSSProperties
            }
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
        >
            {/* ROW 1: SAFE ZONE (Guarantees site header never collides with photography) */}
            <div className="hero__bar hero__bar--top" aria-hidden="true" />

            {/* ROW 2: STAGE (The Photography Stage — Zero Text Overlap) */}
            <div
                className={`hero__stage hero__stage--${layout}`}
                key={currentSlide.id}
                onPointerMove={onMove}
            >
                {activeFrames.map((frame, k) => (
                    <figure
                        className="hero__frame"
                        key={`${frame.src}-${k}`}
                        style={{ "--d": `${k * 90}ms` } as React.CSSProperties}
                    >
                        <PictureFrame frame={frame} eager={activeSlide === 0} />

                        {/* Dual-Focus Lens: Magnifying circle at 2.4x zoom */}
                        {layout === "macro" && (
                            <div className="hero__lens" aria-hidden="true">
                                <picture>
                                    <source
                                        type="image/avif"
                                        srcSet={`/hero/${frame.src}-3200w.avif 3200w, /hero/${frame.src}.avif 3840w`}
                                    />
                                    <source
                                        type="image/webp"
                                        srcSet={`/hero/${frame.src}-3200w.webp 3200w, /hero/${frame.src}.webp 3840w`}
                                    />
                                    <img
                                        src={`/hero/${frame.src}-2560w.jpg`}
                                        alt=""
                                        decoding="async"
                                        draggable={false}
                                    />
                                </picture>
                            </div>
                        )}
                    </figure>
                ))}
            </div>

            {/* ROW 3: Bottom Bar (Counter + CTA + Dots — Zero Model Overlap) */}
            <footer className="hero__bar hero__bar--bot">
                <div className="hero__info">
                    <span className="hero__count">
                        0{activeSlide + 1} / 0{slides.length}
                    </span>
                    <span className="hero__state-label">
                        {currentSlide.label || currentSlide.name || currentSlide.title || ""}
                    </span>
                </div>

                <div className="hero__cta-center">
                    <LLink to={currentSlide.link || "/shop"} className="hero__cta-btn">
                        <span>{t("ПЕРЕГЛЯНУТИ КОЛЕКЦІЮ")}</span>
                    </LLink>
                </div>

                <nav className="hero__dots" aria-label={t("Слайди")}>
                    {slides.map((s, k) => (
                        <button
                            key={s.id}
                            type="button"
                            aria-label={s.label || `Слайд ${k + 1}`}
                            aria-current={k === activeSlide ? "true" : undefined}
                            className={`hero__dot-btn ${k === activeSlide ? "is-on" : ""}`}
                            onClick={() => go(k)}
                        />
                    ))}
                </nav>
            </footer>

            {/* Interactive Fable Studio Lab Bar (?hero=compare) */}
            {isCompareMode && (
                <div
                    className="hero-compare-bar"
                    role="toolbar"
                    aria-label={t("Fable Studio Hero Comparison")}
                >
                    <span className="hero-compare-bar__badge">Fable Studio Lab</span>
                    <div className="hero-compare-bar__pills">
                        {slides.map((s, idx) => (
                            <button
                                key={s.id}
                                type="button"
                                className={`hero-compare-pill ${activeSlide === idx ? "is-active" : ""}`}
                                aria-pressed={activeSlide === idx}
                                onClick={() => go(idx)}
                            >
                                <span className="hero-compare-pill__rank">
                                    {idx === 0 ? "★" : `#${idx + 1}`}
                                </span>
                                <span className="hero-compare-pill__name">{s.name || s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
