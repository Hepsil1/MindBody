import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useI18n, LLink } from "../i18n";
import { getLqipStyle } from "../utils/lqip";
import "../styles/hero.css";

export type FableLayoutMode = "solo" | "duo" | "trio" | "macro" | "single" | "triptych";

export interface FrameItem {
    src: string;
    alt: string;
    focus?: string;
    view?: "front" | "back";
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
    word?: string;
    link?: string | null;
    frames?: FrameItem[];
    turnFrames?: {
        back: FrameItem;
        front: FrameItem;
    };
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
        name: "S1 · Sculpted Open Back (1 модель)",
        tag: "SIGNATURE PIECE · 01 / 05",
        title: "SCULPTED OPEN BACK",
        desc: "Культовий комбінезон зі скульптурною шнуровкою на спині та фірмовою вишивкою-мандалою на рукаві.",
        layout: "solo",
        bg: "#DDD9DB",
        ink: "#261622",
        word: "SCULPT",
        link: "/shop/casual",
        frames: [
            {
                src: "fable-s1-plum-back",
                alt: "MIND BODY — Сливовий комбінезон зі шнуровкою на спині",
                focus: "50% 25%",
                view: "back",
            },
        ],
        turnFrames: {
            back: {
                src: "fable-s1-plum-back",
                alt: "MIND BODY — Сливовий комбінезон, спина зі шнуровкою",
                focus: "50% 25%",
                view: "back",
            },
            front: {
                src: "fable-s3-plum",
                alt: "MIND BODY — Сливовий комбінезон, фронтальний ракурс з вишитою мандалою",
                focus: "50% 20%",
                view: "front",
            },
        },
    },
    {
        id: "s2",
        label: "Studio Duo",
        name: "S2 · Duality of Form (2 моделі)",
        tag: "TWO SILHOUETTES · 02 / 05",
        title: "DUALITY OF FORM",
        desc: "Дві моделі в єдиному студійному просторі: комбінезони кльош у відтінках Rich Plum та Obsidian Black.",
        layout: "solo",
        bg: "#ABA7AE",
        ink: "#1C1620",
        word: "DUALITY",
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
        label: "Color Triad",
        name: "S3 · Color & Movement (3 моделі)",
        tag: "SIGNATURE TRIAD · 03 / 05",
        title: "COLOR & MOVEMENT",
        desc: "Три стихії колекції: Midnight Hooded, Deep Petrol Yoga та Rich Plum Mandala.",
        layout: "trio",
        bg: "#CBC6CB",
        ink: "#112323",
        word: "COLOR",
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
        label: "Tactile Lens",
        name: "S4 · Anatomy of Laces (Лінза 2.4×)",
        tag: "INTERACTIVE LENS · 2.4× MACRO · 04 / 05",
        title: "ANATOMY OF LACES",
        desc: "Наведіть або проведіть пальцем: 2.4× тактильна оптична лінза розкриває переплетення ниток та точність анатомічного шва.",
        layout: "macro",
        bg: "#DDD8DB",
        ink: "#18171E",
        word: "ANATOMY",
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
        label: "Espresso Runway",
        name: "S5 · Espresso Runway (1 модель)",
        tag: "EDITORIAL STATEMENT · 05 / 05",
        title: "ESPRESSO RUNWAY",
        desc: "Шоколадний комбінезон другого шару в поєднанні з еко-шубою та масивними черевиками. Подіумний образ для міста.",
        layout: "solo",
        bg: "#B9B4BB",
        ink: "#281D17",
        word: "ESPRESSO",
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

    const sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 52vw, 42vw";
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
                className="hero__img"
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
    interval = 6500,
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

    const [activeView, setActiveView] = useState<"back" | "front">("back");
    const [paused, setPaused] = useState(false);
    const [isCompareMode, setIsCompareMode] = useState(false);
    const rootRef = useRef<HTMLElement>(null);
    const rafRef = useRef<number | null>(null);

    // Reset view to back on slide transition
    useEffect(() => {
        setActiveView("back");
    }, [activeSlide]);

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

    // Keyboard navigation (ArrowLeft / ArrowRight / ArrowUp / ArrowDown)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                go(activeSlide + 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                go(activeSlide - 1);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeSlide, go]);

    // Autoplay Timer
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

    // Zero-overhead Parallax & Tactile Lens Pointer Tracking (direct CSS variables, zero re-renders)
    const onMove = (e: React.PointerEvent<HTMLElement>) => {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const px = (x - 0.5) * 2;
        const py = (y - 0.5) * 2;

        const lx = Math.max(0, Math.min(100, x * 100));
        const ly = Math.max(0, Math.min(100, y * 100));

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            root.style.setProperty("--px", px.toFixed(3));
            root.style.setProperty("--py", py.toFixed(3));
            root.style.setProperty("--lx", `${lx.toFixed(1)}%`);
            root.style.setProperty("--ly", `${ly.toFixed(1)}%`);
        });
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
                    "--bg": currentSlide.bg || "#DDD9DB",
                    "--ink": currentSlide.ink || "#261622",
                } as React.CSSProperties
            }
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onPointerMove={onMove}
        >
            {/* Soft Ambient Header Veil (Guarantees site navigation clarity with seamless blend) */}
            <div className="hero__header-veil" aria-hidden="true" />

            {/* Monumental Spectral Typography Layer (Behind the Model Stage) */}
            <div className="hero__word-layer" aria-hidden="true" key={`word-${currentSlide.id}`}>
                <span className="hero__word-text">{currentSlide.word || "MIND BODY"}</span>
            </div>

            {/* Photography Stage (Full Studio Cyclorama Dissolved via Feather Mask) */}
            <div className={`hero__stage hero__stage--${layout}`} key={`stage-${currentSlide.id}`}>
                {/* Turn Stage for Slide 1 (Front/Back Curtain Wipe) */}
                {currentSlide.turnFrames ? (
                    <div className="hero__turn-stage">
                        <figure
                            className={`hero__frame hero__frame--turn ${activeView === "back" ? "is-active" : "is-hidden"}`}
                        >
                            <PictureFrame
                                frame={currentSlide.turnFrames.back}
                                eager={activeSlide === 0}
                            />
                        </figure>
                        <figure
                            className={`hero__frame hero__frame--turn ${activeView === "front" ? "is-active" : "is-hidden"}`}
                        >
                            <PictureFrame frame={currentSlide.turnFrames.front} eager={false} />
                        </figure>
                    </div>
                ) : (
                    activeFrames.map((frame, k) => (
                        <figure
                            className="hero__frame"
                            key={`${frame.src}-${k}`}
                            style={{ "--d": `${k * 90}ms` } as React.CSSProperties}
                        >
                            <PictureFrame frame={frame} eager={activeSlide === 0} />

                            {/* Dual-Focus Lens: Magnifying circle at 2.4x optical zoom */}
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
                    ))
                )}
            </div>

            {/* Editorial Caption & Action Cluster (Docked in safe bottom-left zone) */}
            <div className="hero-editorial" key={`editorial-${currentSlide.id}`}>
                <div className="hero-editorial__badge">
                    <span className="hero-editorial__tag">
                        {currentSlide.tag ||
                            `SIGNATURE PIECE · 0${activeSlide + 1} / 0${slides.length}`}
                    </span>
                </div>

                <h1 className="hero-editorial__title">{currentSlide.title || currentSlide.name}</h1>

                {currentSlide.desc && <p className="hero-editorial__desc">{currentSlide.desc}</p>}

                <div className="hero-editorial__actions">
                    <LLink to={currentSlide.link || "/shop"} className="hero-editorial__cta">
                        <span>{t("ПЕРЕГЛЯНУТИ КОЛЕКЦІЮ")}</span>
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 15 15"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M2.5 7.5H12.5M12.5 7.5L8 3M12.5 7.5L8 12"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </LLink>

                    {/* Turn Toggle (FRONT · BACK) for Signature Sculpted Piece */}
                    {currentSlide.turnFrames && (
                        <div
                            className="hero-turn-toggle"
                            role="group"
                            aria-label={t("Перемикання ракурсу: спина та перед")}
                        >
                            <button
                                type="button"
                                className={`hero-turn-btn ${activeView === "back" ? "is-active" : ""}`}
                                onClick={() => setActiveView("back")}
                            >
                                <span className="hero-turn-btn__label">{t("СПИНА")}</span>
                                <span className="hero-turn-btn__detail">{t("ШНУРОВКА")}</span>
                            </button>
                            <span className="hero-turn-toggle__divider" aria-hidden="true" />
                            <button
                                type="button"
                                className={`hero-turn-btn ${activeView === "front" ? "is-active" : ""}`}
                                onClick={() => setActiveView("front")}
                            >
                                <span className="hero-turn-btn__label">{t("ПЕРЕД")}</span>
                                <span className="hero-turn-btn__detail">{t("МАНДАЛА")}</span>
                            </button>
                        </div>
                    )}

                    {/* Lens Mode Hint */}
                    {layout === "macro" && (
                        <div className="hero-lens-hint" aria-hidden="true">
                            <span className="hero-lens-hint__zoom">2.4×</span>
                            <span className="hero-lens-hint__text">{t("ТАКТИЛЬНА ЛУПА")}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Signature LaceNav (Навігація-нить: The Lace Line with 5 tactile stitch-knots) */}
            <aside
                className="hero-lacenav"
                role="tablist"
                aria-label={t("Шнуровка — навігація по образах")}
            >
                <div className="hero-lacenav__thread" aria-hidden="true">
                    <svg
                        className="hero-lacenav__svg"
                        viewBox="0 0 16 260"
                        fill="none"
                        preserveAspectRatio="none"
                    >
                        <line
                            x1="8"
                            y1="16"
                            x2="8"
                            y2="244"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                            opacity="0.25"
                        />
                        <line
                            x1="8"
                            y1="16"
                            x2="8"
                            y2={16 + (activeSlide / (slides.length - 1)) * 228}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            opacity="0.85"
                            className="hero-lacenav__progress-line"
                        />
                    </svg>
                </div>
                <div className="hero-lacenav__knots">
                    {slides.map((s, k) => {
                        const isActive = k === activeSlide;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-label={`${s.title || s.name || s.label}`}
                                className={`hero-lacenav__knot ${isActive ? "is-active" : ""}`}
                                onClick={() => go(k)}
                            >
                                <span className="hero-lacenav__eyelet">
                                    <span className="hero-lacenav__dot" />
                                    {isActive && <span className="hero-lacenav__pulse" />}
                                </span>
                                <span className="hero-lacenav__tooltip">
                                    <span className="hero-lacenav__tooltip-num">0{k + 1}</span>
                                    <span className="hero-lacenav__tooltip-title">
                                        {s.word || s.label}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </aside>

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
                                <span className="hero-compare-pill__name">
                                    {s.word || s.name || s.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
