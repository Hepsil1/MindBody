import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useI18n, LLink } from "../i18n";
import { getLqipStyle } from "../utils/lqip";
import "../styles/hero.css";

export type FableLayoutMode = "solo" | "duo" | "single" | "macro";

export interface FrameItem {
    src: string;
    alt: string;
    focus?: string;
    view?: "front" | "back";
}

export interface SlideData {
    id: string;
    label: string;
    tag: string;
    title: string;
    desc: string;
    cta: string;
    layout: FableLayoutMode;
    bg: string;
    ink: string;
    link: string;
    frames: FrameItem[];
    turnFrames?: {
        front: FrameItem;
        back: FrameItem;
    };
    mobileImage?: string;
    // Backward-compatibility properties
    name?: string;
    type?: string;
    word?: string;
    image1?: string;
    image2?: string | null;
    image3?: string | null;
    image1Pos?: string;
    image2Pos?: string;
    image3Pos?: string;
    images?: Array<{ src: string; pos?: string; alt: string }>;
}

export const defaultSlides: SlideData[] = [
    {
        id: "s1",
        label: "Sculpted Plum",
        tag: "SIGNATURE PIECE · 01 / 05",
        title: "Sculpted Open Back",
        desc: "Культовий комбінезон із преміального компресійного трикотажу: фірмова вишивка-мандала на рукаві та скульптурна анатомічна шнуровка спини.",
        cta: "Переглянути колекцію",
        layout: "solo",
        bg: "#DFDADE",
        ink: "#20141E",
        link: "/shop/casual",
        frames: [
            {
                src: "fable-s1-front",
                alt: "MIND BODY — Сливовий комбінезон, фронтальний погляд з вишивкою-мандалою",
                focus: "50% 20%",
                view: "front",
            },
        ],
        turnFrames: {
            front: {
                src: "fable-s1-front",
                alt: "MIND BODY — Сливовий комбінезон, фронтальний погляд з вишивкою-мандалою",
                focus: "50% 20%",
                view: "front",
            },
            back: {
                src: "fable-s1-back-full",
                alt: "MIND BODY — Сливовий комбінезон у повний зріст, спина зі скульптурною шнуровкою",
                focus: "50% 25%",
                view: "back",
            },
        },
    },
    {
        id: "s2",
        label: "Studio Duo",
        tag: "TWO SILHOUETTES · 02 / 05",
        title: "Duality of Form",
        desc: "Дві моделі в єдиному кадрі студійної зйомки: комбінезони кльош з капюшоном у відтінках Rich Plum та Obsidian Black на дзеркальній підлозі.",
        cta: "Кльош та капюшони",
        layout: "duo",
        bg: "#B2ACB5",
        ink: "#16111A",
        link: "/shop/sport",
        frames: [
            {
                src: "fable-s2-duo-campaign",
                alt: "MIND BODY — Дві моделі у комбінезонах кльош з капюшоном",
                focus: "50% 24%",
            },
        ],
    },
    {
        id: "s3",
        label: "Obsidian Flare",
        tag: "CORE CAPSULE · 03 / 05",
        title: "Obsidian Hooded",
        desc: "Спортивний комбінезон другого шару з глибоким анатомічним капюшоном, розкльошеними штанинами та фіксуючим поясом.",
        cta: "Спортивні силуети",
        layout: "solo",
        bg: "#B8B0BB",
        ink: "#141018",
        link: "/shop/sport",
        frames: [
            {
                src: "fable-s3-obsidian-hooded",
                alt: "MIND BODY — Чорний комбінезон з капюшоном у повний зріст",
                focus: "50% 22%",
            },
        ],
    },
    {
        id: "s4",
        label: "Petrol Lacing",
        tag: "INTERACTIVE LENS · 2.4× MACRO · 04 / 05",
        title: "Anatomy of Laces",
        desc: "Наведіть курсор для 2.4× тактильної оптичної лупи: переплетення ниток, точність лазерного крою та якість матеріалу.",
        cta: "Анатомія крою",
        layout: "macro",
        bg: "#D4D2D7",
        ink: "#121A1A",
        link: "/shop/yoga",
        frames: [
            {
                src: "fable-s4-petrol-lacing",
                alt: "MIND BODY — Бірюзовий комбінезон для йоги з відкритою спиною на шнуровці",
                focus: "50% 30%",
            },
        ],
    },
    {
        id: "s5",
        label: "Espresso Runway",
        tag: "EDITORIAL STATEMENT · 05 / 05",
        title: "Espresso Runway",
        desc: "Шоколадний комбінезон у поєднанні з преміальною еко-шубою та масивними черевиками. Повноцінний міський образ високої моди.",
        cta: "Верхній шар та образи",
        layout: "solo",
        bg: "#BEB8C0",
        ink: "#221814",
        link: "/shop/casual",
        frames: [
            {
                src: "fable-s5-espresso-runway",
                alt: "MIND BODY — Шоколадний комбінезон з шубою та черевиками у повний зріст",
                focus: "50% 22%",
            },
        ],
    },
];

const WIDTHS = [640, 960, 1440, 1920, 2560];

function PictureFrame({ frame, eager }: { frame: FrameItem; eager?: boolean }) {
    const baseSrc = frame.src.startsWith("/")
        ? frame.src.replace(/\.(webp|avif|jpg)$/, "")
        : `/hero/${frame.src}`;

    const webpSrcSet =
        WIDTHS.map((w) => `${baseSrc}-${w}w.webp ${w}w`).join(", ") + `, ${baseSrc}.webp 3840w`;
    const jpgSrcSet = WIDTHS.map((w) => `${baseSrc}-${w}w.jpg ${w}w`).join(", ");

    const sizes = "(max-width: 768px) 100vw, 62vw";
    const lqip = getLqipStyle(`${baseSrc}.webp`) || getLqipStyle(baseSrc);

    return (
        <picture className="hero__picture">
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
                    objectPosition: frame.focus || "50% 22%",
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

import IssueCoverHero, {
    MAGAZINE_ISSUES,
    type IssueData,
    type IssueCoverHeroProps,
} from "./IssueCoverHero";

export { IssueCoverHero, MAGAZINE_ISSUES, type IssueData, type IssueCoverHeroProps };

export function TwoColumnHero({
    slides: propSlides,
    autoPlay = true,
    interval = 8000,
}: HeroSliderProps) {
    const { t } = useI18n();
    const slides = propSlides && propSlides.length > 0 ? propSlides : defaultSlides;

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

    const [activeView, setActiveView] = useState<"front" | "back">("front");
    const [paused, setPaused] = useState(false);
    const [isCompareMode, setIsCompareMode] = useState(false);
    const rootRef = useRef<HTMLElement>(null);
    const rafRef = useRef<number | null>(null);

    // Reset view to front on slide transition
    useEffect(() => {
        setActiveView("front");
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

    // Keyboard navigation
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

    // Autoplay Timer (8 seconds, paused on hover/focus)
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

    // Zero-overhead 2.4x Lens pointer tracking
    const onStagePointerMove = (e: React.PointerEvent<HTMLElement>) => {
        const stage = e.currentTarget;
        const rect = stage.getBoundingClientRect();
        const root = rootRef.current;
        if (!root) return;

        const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            root.style.setProperty("--lx", `${xPercent.toFixed(1)}%`);
            root.style.setProperty("--ly", `${yPercent.toFixed(1)}%`);
        });
    };

    const currentSlide = slides[activeSlide] || slides[0];

    return (
        <section
            ref={rootRef}
            className="fable-luxury-hero"
            id="hero"
            aria-roledescription="carousel"
            aria-label={t("Вітрина бренду MIND BODY")}
            style={
                {
                    "--bg": currentSlide.bg || "#DFDADE",
                    "--ink": currentSlide.ink || "#20141E",
                } as React.CSSProperties
            }
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
        >
            {/* COLUMN 1: EDITORIAL GALLERY PANEL (World-Class Magazine Spread) */}
            <div className="hero-editorial" key={`editorial-${currentSlide.id}`}>
                <div className="hero-editorial__badge">
                    <span className="hero-editorial__tag">{currentSlide.tag}</span>
                </div>

                <h2 className="hero-editorial__title">{currentSlide.title}</h2>

                <p className="hero-editorial__desc">{currentSlide.desc}</p>

                <div className="hero-editorial__actions">
                    <LLink to={currentSlide.link || "/shop"} className="hero-editorial__cta">
                        <span>{t(currentSlide.cta || "Переглянути колекцію")}</span>
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
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </LLink>

                    {/* Turn Segmented Switch (FRONT / BACK) for Signature Piece */}
                    {currentSlide.turnFrames && (
                        <div
                            className="hero-turn-switch"
                            role="group"
                            aria-label={t("Перемикання ракурсу моделі")}
                        >
                            <button
                                type="button"
                                className={`hero-turn-switch__btn ${activeView === "front" ? "is-active" : ""}`}
                                onClick={() => setActiveView("front")}
                            >
                                {t("ПЕРЕД")}
                            </button>
                            <button
                                type="button"
                                className={`hero-turn-switch__btn ${activeView === "back" ? "is-active" : ""}`}
                                onClick={() => setActiveView("back")}
                            >
                                {t("СПИНА")}
                            </button>
                        </div>
                    )}
                </div>

                {/* Vertical Lace Line Navigation inside Editorial Column */}
                <nav className="hero-lacenav" aria-label={t("Навігація по образах")}>
                    <div className="hero-lacenav__knots">
                        {slides.map((s, k) => {
                            const isActive = k === activeSlide;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    aria-current={isActive ? "true" : undefined}
                                    aria-label={`${s.title} — ${s.label}`}
                                    className={`hero-lacenav__knot ${isActive ? "is-active" : ""}`}
                                    onClick={() => go(k)}
                                >
                                    <span className="hero-lacenav__num">0{k + 1}</span>
                                    <span className="hero-lacenav__line" />
                                    <span className="hero-lacenav__label">{s.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Autoplay Pause / Play Toggle for WCAG 2.2.2 */}
                    <button
                        type="button"
                        className="hero-pause-btn"
                        onClick={() => setPaused(!paused)}
                        aria-label={
                            paused ? t("Запустити автозміну слайдів") : t("Призупинити автозміну")
                        }
                    >
                        {paused ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                <path d="M2.5 1.5L10 6L2.5 10.5V1.5Z" />
                            </svg>
                        ) : (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                <rect x="2" y="1.5" width="2.5" height="9" rx="0.5" />
                                <rect x="7.5" y="1.5" width="2.5" height="9" rx="0.5" />
                            </svg>
                        )}
                    </button>
                </nav>
            </div>

            {/* COLUMN 2: FULL-HEIGHT MASTER STUDIO PHOTOGRAPHY (Zero Mask, Crisp Studio Floor) */}
            <div
                className={`hero__stage hero__stage--${currentSlide.layout}`}
                key={`stage-${currentSlide.id}`}
                onPointerMove={currentSlide.layout === "macro" ? onStagePointerMove : undefined}
            >
                {/* Turn Stage for Slide 1 with smooth Crossfade */}
                {currentSlide.turnFrames ? (
                    <div className="hero__turn-wrapper">
                        <figure
                            className={`hero__frame hero__frame--turn ${activeView === "front" ? "is-visible" : "is-hidden"}`}
                        >
                            <PictureFrame
                                frame={currentSlide.turnFrames.front}
                                eager={activeSlide === 0}
                            />
                        </figure>
                        <figure
                            className={`hero__frame hero__frame--turn ${activeView === "back" ? "is-visible" : "is-hidden"}`}
                        >
                            <PictureFrame frame={currentSlide.turnFrames.back} eager={false} />
                        </figure>
                    </div>
                ) : (
                    <figure className="hero__frame">
                        <PictureFrame frame={currentSlide.frames[0]} eager={activeSlide === 0} />

                        {/* Dual-Focus Lens: 2.4x Optical Macro on Slide 4 */}
                        {currentSlide.layout === "macro" && (
                            <div className="hero__lens" aria-hidden="true">
                                <picture className="hero__picture">
                                    <source
                                        type="image/webp"
                                        srcSet={`/hero/${currentSlide.frames[0].src}-2560w.webp 2560w, /hero/${currentSlide.frames[0].src}.webp 3840w`}
                                    />
                                    <img
                                        src={`/hero/${currentSlide.frames[0].src}-1920w.jpg`}
                                        alt=""
                                        decoding="async"
                                        draggable={false}
                                    />
                                </picture>
                            </div>
                        )}
                    </figure>
                )}
            </div>

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
                                <span className="hero-compare-pill__name">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

export default IssueCoverHero;
