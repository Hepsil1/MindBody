import { useState, useEffect, type ReactNode } from "react";
import {
    buildAvifSrcset,
    buildWebpSrcset,
    buildHeroAvifSrcset,
    buildHeroWebpSrcset,
} from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { useI18n, LLink } from "../i18n";
import "../styles/hero.css";

// Layout modes for the Hero Screen
export type HeroLayoutMode = "trio-center" | "editorial-left" | "top-clean" | "quartet";

export interface SlideData {
    id: string;
    name: string;
    type: "single" | "triptych";
    link?: string | null;
    image1: string;
    mobileImage?: string | null;
    image2?: string | null;
    image3?: string | null;
    image1Pos?: string;
    image2Pos?: string;
    image3Pos?: string;
    layout?: HeroLayoutMode;
}

const FACE_SAFE = "50% 35%";

// The Flagship Campaign Canvases (Retina 8K)
// Real RAW studio photography (5410x7214, 4284x5712) seamlessly rendered into
// a luminous, champagne-silk studio cyclorama with contact shadows and reflections.
// Curated multi-model variety: 3 models -> 1 model -> 2 models -> 4 models!
export const defaultSlides: SlideData[] = [
    {
        id: "v1-grand-trio",
        name: "V1 · Grand Trio (3 моделі)",
        type: "single",
        layout: "trio-center",
        image1: "/Slides/hero-v1-desktop.webp",
        mobileImage: "/Slides/hero-v1-mobile.webp",
        image1Pos: "center center",
        link: "/shop",
    },
    {
        id: "v3-editorial-lookbook",
        name: "V3 · Editorial Lookbook (1 модель соло)",
        type: "single",
        layout: "editorial-left",
        image1: "/Slides/hero-v3-desktop.webp",
        mobileImage: "/Slides/hero-v3-mobile.webp",
        image1Pos: "center center",
        link: "/shop/casual",
    },
    {
        id: "v2-standing-duo",
        name: "V2 · Studio Standing Duo (2 моделі)",
        type: "single",
        layout: "top-clean",
        image1: "/Slides/hero-v2-desktop.webp",
        mobileImage: "/Slides/hero-v2-mobile.webp",
        image1Pos: "center center",
        link: "/shop/yoga",
    },
    {
        id: "v4-studio-quartet",
        name: "V4 · Studio Quartet (4 моделі)",
        type: "single",
        layout: "quartet",
        image1: "/Slides/hero-v4-desktop.webp",
        mobileImage: "/Slides/hero-v4-mobile.webp",
        image1Pos: "center center",
        link: "/shop",
    },
];

interface HeroSliderProps {
    slides?: SlideData[];
    autoPlay?: boolean;
    interval?: number;
    children?: React.ReactNode;
}

export default function HeroSlider({
    slides: propSlides,
    autoPlay = true,
    interval = 6000,
    children,
}: HeroSliderProps) {
    const { t } = useI18n();
    const slides = propSlides && propSlides.length > 0 ? propSlides : defaultSlides;

    const [activeSlide, setActiveSlide] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [isCompareMode, setIsCompareMode] = useState(false);

    // Check URL parameters for direct comparison mode or specific slide
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const heroParam = params.get("hero");
        const slideParam = params.get("slide");

        if (heroParam === "compare" || heroParam) {
            setIsCompareMode(true);
            const variantMap: Record<string, number> = {
                v1: 0,
                v3: 1,
                v2: 2,
                v4: 3,
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
    }, [slides.length]);

    // Autoplay when not hovered and not in manual compare mode
    useEffect(() => {
        if (!autoPlay || isHovered || isCompareMode || slides.length <= 1) return;

        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % slides.length);
        }, interval);

        return () => clearInterval(timer);
    }, [autoPlay, interval, isHovered, isCompareMode, slides.length]);

    const goToSlide = (index: number) => {
        setActiveSlide(index);
        if (typeof window !== "undefined" && window.history?.replaceState) {
            const url = new URL(window.location.href);
            const variantMap: Record<number, string> = { 0: "v1", 1: "v3", 2: "v2", 3: "v4" };
            if (variantMap[index]) {
                url.searchParams.set("hero", variantMap[index]);
            } else {
                url.searchParams.set("slide", String(index));
            }
            window.history.replaceState({}, "", url.toString());
        }
    };

    const currentSlide = slides[activeSlide] ?? slides[0];
    const activeLayout: HeroLayoutMode =
        currentSlide?.layout || (currentSlide?.type === "single" ? "trio-center" : "top-clean");

    // Convert slide data to images array with positions
    const getSlideItems = (
        slide: SlideData,
    ): Array<{ img: string; mobileImg?: string; pos: string }> => {
        if (slide.type === "single") {
            return [
                {
                    img: slide.image1,
                    mobileImg: slide.mobileImage || undefined,
                    pos: slide.image1Pos || "center center",
                },
            ];
        }
        return [
            { img: slide.image1, pos: slide.image1Pos || "center center" },
            { img: slide.image2, pos: slide.image2Pos || "center center" },
            { img: slide.image3, pos: slide.image3Pos || "center center" },
        ].filter((item): item is { img: string; pos: string } => !!item.img);
    };

    // Minimum touch distance for swipe (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            goToSlide((activeSlide + 1) % slides.length);
        } else if (isRightSwipe) {
            goToSlide((activeSlide - 1 + slides.length) % slides.length);
        }
    };

    return (
        <section
            className={`hero-slider hero-slider--${activeLayout}`}
            id="hero"
            aria-label={t("Вітрина бренду MIND BODY")}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Slides Container */}
            <div className="hero-slider__slides">
                {slides.map((slide, index) => {
                    const items = getSlideItems(slide);
                    const isHeroSingle = slide.type === "single";
                    const avifSrcset = isHeroSingle ? buildHeroAvifSrcset : buildAvifSrcset;
                    const webpSrcset = isHeroSingle ? buildHeroWebpSrcset : buildWebpSrcset;
                    const desktopFrac = Math.floor(100 / items.length);
                    const sizesAttr = `(max-width: 768px) 100vw, ${desktopFrac}vw`;

                    return (
                        <div
                            key={slide.id}
                            className={`hero-slider__slide ${index === activeSlide ? "is-active" : ""}`}
                            data-slide={index}
                        >
                            <div className="hero-slider__triptych">
                                {items.map((item, imgIndex) => (
                                    <div
                                        key={imgIndex}
                                        className="hero-slider__triptych-item"
                                        style={getLqipStyle(item.img)}
                                    >
                                        <picture>
                                            {item.mobileImg && (
                                                <>
                                                    <source
                                                        media="(max-width: 768px)"
                                                        srcSet={buildHeroAvifSrcset(item.mobileImg)}
                                                        sizes="100vw"
                                                        type="image/avif"
                                                    />
                                                    <source
                                                        media="(max-width: 768px)"
                                                        srcSet={buildHeroWebpSrcset(item.mobileImg)}
                                                        sizes="100vw"
                                                        type="image/webp"
                                                    />
                                                </>
                                            )}
                                            <source
                                                srcSet={avifSrcset(item.img)}
                                                sizes={sizesAttr}
                                                type="image/avif"
                                            />
                                            <source
                                                srcSet={webpSrcset(item.img)}
                                                sizes={sizesAttr}
                                                type="image/webp"
                                            />
                                            <img
                                                src={item.img}
                                                alt={
                                                    slide.name && slide.name !== "Без назви"
                                                        ? `${slide.name} — фото ${imgIndex + 1}`
                                                        : `Колекція MIND BODY — фото ${imgIndex + 1}`
                                                }
                                                width={isHeroSingle ? 3840 : 1080}
                                                height={isHeroSingle ? 2160 : 1920}
                                                style={{ objectPosition: item.pos }}
                                                loading={index === 0 ? "eager" : "lazy"}
                                                decoding={index === 0 ? "sync" : "async"}
                                                fetchPriority={index === 0 ? "high" : "low"}
                                            />
                                        </picture>
                                    </div>
                                ))}
                            </div>
                            <div className="hero-slider__overlay" />
                        </div>
                    );
                })}
            </div>

            {/* Content Layer */}
            <div className="hero-slider__content">
                {children ? (
                    children
                ) : (
                    <>
                        {/* Brand Logo with Floral Sun Emblem */}
                        <div className="hero-slider__logo-container">
                            <div className="hero-slider__brand-block">
                                <div className="hero-slider__logo">
                                    <picture>
                                        <source
                                            srcSet="/pics/mind_body_logo_white.webp"
                                            type="image/webp"
                                        />
                                        <img
                                            src="/pics/mind_body_logo_white.png"
                                            alt="MIND BODY — sport wear"
                                            fetchPriority="high"
                                        />
                                    </picture>
                                </div>
                            </div>
                        </div>

                        {/* CTA Action Button */}
                        <div className="hero-slider__footer-cta">
                            <div className="hero-slider__cta">
                                <LLink to={currentSlide?.link || "/shop"} className="hero-cta-btn">
                                    <span>{t("ПЕРЕГЛЯНУТИ КОЛЕКЦІЮ")}</span>
                                </LLink>
                            </div>
                        </div>
                    </>
                )}

                {/* Slide navigation indicators */}
                {slides.length > 1 && (
                    <div className="hero-slider__nav">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                className={`hero-slider__dot ${index === activeSlide ? "is-active" : ""}`}
                                data-slide={index}
                                aria-label={t("Слайд {n}", { n: index + 1 })}
                                aria-current={index === activeSlide ? "true" : undefined}
                                onClick={() => goToSlide(index)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Interactive Fable Studio Switcher (?hero=compare) */}
            {isCompareMode && (
                <div
                    className="hero-compare-bar"
                    role="toolbar"
                    aria-label={t("Fable Studio Hero Comparison")}
                >
                    <span className="hero-compare-bar__badge">Fable Studio Lab</span>
                    <div className="hero-compare-bar__pills">
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 0 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 0}
                            onClick={() => goToSlide(0)}
                        >
                            <span className="hero-compare-pill__rank">★</span>
                            <span className="hero-compare-pill__name">V1 · Trio (3 моделі)</span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 1 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 1}
                            onClick={() => goToSlide(1)}
                        >
                            <span className="hero-compare-pill__rank">#2</span>
                            <span className="hero-compare-pill__name">
                                V3 · Lookbook (1 модель)
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 2 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 2}
                            onClick={() => goToSlide(2)}
                        >
                            <span className="hero-compare-pill__rank">#3</span>
                            <span className="hero-compare-pill__name">V2 · Duo (2 моделі)</span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 3 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 3}
                            onClick={() => goToSlide(3)}
                        >
                            <span className="hero-compare-pill__rank">#4</span>
                            <span className="hero-compare-pill__name">V4 · Quartet (4 моделі)</span>
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
