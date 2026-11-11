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

// Supported Hero layout modes curated with Fable
export type HeroLayoutMode =
    | "editorial-duplet"
    | "colour-chapters"
    | "triptych-gallery"
    | "editorial-left"
    | "trio-center"
    | "top-clean";

export interface SlideData {
    id: string;
    name: string;
    type: "triptych" | "single";
    link?: string | null;
    image1: string;
    mobileImage?: string | null;
    image2?: string | null;
    image3?: string | null;
    image1Pos?: string;
    image2Pos?: string;
    image3Pos?: string;
    layout?: HeroLayoutMode;
    title?: string;
    subtitle?: string;
    bg?: string;
}

// Fable Masterpiece Default Slides:
// Authentic RAW photography (4284x5712 downscaled with Lanczos3 + unsharp mask).
// ZERO cutouts, ZERO artificial stickers. Natural studio lighting, real skin & fabric textures,
// and seamless edge dissolves into the sampled studio wall color.
export const defaultSlides: SlideData[] = [
    {
        id: "fable-1",
        name: "Editorial Lookbook · Black Core & Macro",
        type: "single",
        layout: "editorial-duplet",
        image1: "/hero/hero-black-desktop.webp",
        mobileImage: "/hero/hero-black-mobile.webp",
        image2: "/hero/hero-black-detail.webp",
        bg: "#b0aab3",
        title: "Black Obsidian Core",
        subtitle: "Анатомічний комбінезон із компресійного трикотажу з прорізами для пальців",
        link: "/shop/yoga",
    },
    {
        id: "fable-2",
        name: "Editorial Lookbook · Rich Cocoa Lace",
        type: "single",
        layout: "editorial-duplet",
        image1: "/hero/hero-choco-desktop.webp",
        mobileImage: "/hero/hero-choco-mobile.webp",
        image2: "/hero/hero-choco-detail.webp",
        bg: "#b9b2b9",
        title: "Rich Cocoa Lace",
        subtitle: "Культова відкрита спина з геометричним шнуруванням та вишивкою сонця",
        link: "/shop/casual",
    },
    {
        id: "fable-3",
        name: "Colour Chapters · Deep Petrol",
        type: "single",
        layout: "colour-chapters",
        image1: "/hero/hero-teal-desktop.webp",
        mobileImage: "/hero/hero-teal-mobile.webp",
        bg: "#d8d5d7",
        title: "Deep Petrol Flow",
        subtitle: "Матовий шовковий дотик та повна свобода рухів для йоги та танцю",
        link: "/shop/dance",
    },
    {
        id: "fable-4",
        name: "Colour Chapters · Dark Ruby",
        type: "single",
        layout: "colour-chapters",
        image1: "/hero/hero-ruby-desktop.webp",
        mobileImage: "/hero/hero-ruby-mobile.webp",
        bg: "#d9d4d7",
        title: "Dark Ruby Vitality",
        subtitle: "Динамічний силует і заряд упевненості для інтенсивних тренувань",
        link: "/shop/sport",
    },
    {
        id: "fable-5",
        name: "Studio Triptych · Pure Frames",
        type: "triptych",
        layout: "triptych-gallery",
        image1: "/hero/hero-black-desktop.webp",
        image2: "/hero/hero-choco-desktop.webp",
        image3: "/hero/hero-teal-desktop.webp",
        image1Pos: "50% 35%",
        image2Pos: "50% 35%",
        image3Pos: "50% 60%",
        bg: "#2b2826",
        title: "The MindBody Studio Archive",
        subtitle: "Чотири культові посадки. Бездоганна якість українського виробництва.",
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
                "duplet-black": 0,
                "duplet-choco": 1,
                "chapters-teal": 2,
                "chapters-ruby": 3,
                triptych: 4,
                v1: 0,
                v3: 1,
                v2: 2,
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
            const variantMap: Record<number, string> = {
                0: "duplet-black",
                1: "duplet-choco",
                2: "chapters-teal",
                3: "chapters-ruby",
                4: "triptych",
            };
            if (variantMap[index]) {
                url.searchParams.set("hero", variantMap[index]);
            } else {
                url.searchParams.set("slide", String(index));
            }
            window.history.replaceState({}, "", url.toString());
        }
    };

    const currentSlide = slides[activeSlide] ?? slides[0];
    const activeLayout: HeroLayoutMode = currentSlide?.layout || "editorial-duplet";

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
            style={{ "--active-bg": currentSlide?.bg || "#b0aab3" } as React.CSSProperties}
        >
            {/* Slides Container */}
            <div className="hero-slider__slides">
                {slides.map((slide, index) => {
                    const isActive = index === activeSlide;
                    const isDuplet = slide.layout === "editorial-duplet";
                    const isChapters = slide.layout === "colour-chapters";
                    const isTriptych =
                        slide.type === "triptych" || slide.layout === "triptych-gallery";

                    return (
                        <div
                            key={slide.id}
                            className={`hero-slider__slide ${isActive ? "is-active" : ""}`}
                            data-slide={index}
                            style={{ "--slide-bg": slide.bg || "#b0aab3" } as React.CSSProperties}
                        >
                            {/* CASE 1: Editorial Duplet (Magazine Spread with Macro Detail) */}
                            {isDuplet && (
                                <div className="hero-editorial-duplet">
                                    {/* Left: Main Model 4:5 Frame */}
                                    <div
                                        className="hero-editorial-duplet__main-frame"
                                        style={getLqipStyle(slide.image1)}
                                    >
                                        <picture>
                                            {slide.mobileImage && (
                                                <>
                                                    <source
                                                        media="(max-width: 1023px)"
                                                        srcSet={buildHeroAvifSrcset(
                                                            slide.mobileImage,
                                                        )}
                                                        sizes="100vw"
                                                        type="image/avif"
                                                    />
                                                    <source
                                                        media="(max-width: 1023px)"
                                                        srcSet={buildHeroWebpSrcset(
                                                            slide.mobileImage,
                                                        )}
                                                        sizes="100vw"
                                                        type="image/webp"
                                                    />
                                                </>
                                            )}
                                            <source
                                                media="(min-width: 1024px)"
                                                srcSet={buildHeroAvifSrcset(slide.image1)}
                                                sizes="(min-width: 1440px) 46vw, 55vw"
                                                type="image/avif"
                                            />
                                            <source
                                                media="(min-width: 1024px)"
                                                srcSet={buildHeroWebpSrcset(slide.image1)}
                                                sizes="(min-width: 1440px) 46vw, 55vw"
                                                type="image/webp"
                                            />
                                            <img
                                                src={slide.image1}
                                                alt={slide.title || slide.name}
                                                className="hero-editorial-duplet__img"
                                                loading={index === 0 ? "eager" : "lazy"}
                                                decoding={index === 0 ? "sync" : "async"}
                                                fetchPriority={index === 0 ? "high" : "low"}
                                            />
                                        </picture>
                                        <div className="hero-editorial-duplet__edge-fade" />
                                    </div>

                                    {/* Right: Macro Detail & Story Card */}
                                    <div className="hero-editorial-duplet__side-card">
                                        {slide.image2 && (
                                            <div
                                                className="hero-editorial-duplet__detail-frame"
                                                style={getLqipStyle(slide.image2)}
                                            >
                                                <span className="hero-editorial-duplet__detail-badge">
                                                    1:1 Macro Craft
                                                </span>
                                                <picture>
                                                    <source
                                                        srcSet={buildHeroAvifSrcset(slide.image2)}
                                                        sizes="(min-width: 1024px) 24vw, 45vw"
                                                        type="image/avif"
                                                    />
                                                    <source
                                                        srcSet={buildHeroWebpSrcset(slide.image2)}
                                                        sizes="(min-width: 1024px) 24vw, 45vw"
                                                        type="image/webp"
                                                    />
                                                    <img
                                                        src={slide.image2}
                                                        alt={`${slide.title} — деталь крою`}
                                                        className="hero-editorial-duplet__detail-img"
                                                        loading="lazy"
                                                    />
                                                </picture>
                                            </div>
                                        )}
                                        <div className="hero-editorial-duplet__story">
                                            <span className="hero-editorial-duplet__tag">
                                                MINDBODY ARCHIVE · 2026
                                            </span>
                                            <h2 className="hero-editorial-duplet__headline">
                                                {slide.title}
                                            </h2>
                                            <p className="hero-editorial-duplet__desc">
                                                {slide.subtitle}
                                            </p>
                                            <div className="hero-editorial-duplet__action">
                                                <LLink
                                                    to={slide.link || "/shop"}
                                                    className="hero-editorial-duplet__btn"
                                                >
                                                    <span>{t("Переглянути колекцію")}</span>
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        <polyline points="12 5 19 12 12 19"></polyline>
                                                    </svg>
                                                </LLink>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CASE 2: Colour Chapters (Full-Bleed Photographic Canvas) */}
                            {isChapters && (
                                <div className="hero-colour-chapters">
                                    <div
                                        className="hero-colour-chapters__frame"
                                        style={getLqipStyle(slide.image1)}
                                    >
                                        <picture>
                                            {slide.mobileImage && (
                                                <>
                                                    <source
                                                        media="(max-width: 1023px)"
                                                        srcSet={buildHeroAvifSrcset(
                                                            slide.mobileImage,
                                                        )}
                                                        sizes="100vw"
                                                        type="image/avif"
                                                    />
                                                    <source
                                                        media="(max-width: 1023px)"
                                                        srcSet={buildHeroWebpSrcset(
                                                            slide.mobileImage,
                                                        )}
                                                        sizes="100vw"
                                                        type="image/webp"
                                                    />
                                                </>
                                            )}
                                            <source
                                                media="(min-width: 1024px)"
                                                srcSet={buildHeroAvifSrcset(slide.image1)}
                                                sizes="100vw"
                                                type="image/avif"
                                            />
                                            <source
                                                media="(min-width: 1024px)"
                                                srcSet={buildHeroWebpSrcset(slide.image1)}
                                                sizes="100vw"
                                                type="image/webp"
                                            />
                                            <img
                                                src={slide.image1}
                                                alt={slide.title || slide.name}
                                                className="hero-colour-chapters__img"
                                                loading={index === 0 ? "eager" : "lazy"}
                                                decoding={index === 0 ? "sync" : "async"}
                                                fetchPriority={index === 0 ? "high" : "low"}
                                            />
                                        </picture>
                                        <div className="hero-colour-chapters__side-fade left" />
                                        <div className="hero-colour-chapters__side-fade right" />
                                    </div>
                                    <div className="hero-colour-chapters__caption">
                                        <span className="hero-colour-chapters__tag">
                                            COLOUR CHAPTERS
                                        </span>
                                        <h2 className="hero-colour-chapters__title">
                                            {slide.title}
                                        </h2>
                                        <p className="hero-colour-chapters__desc">
                                            {slide.subtitle}
                                        </p>
                                        <LLink
                                            to={slide.link || "/shop"}
                                            className="hero-editorial-duplet__btn"
                                        >
                                            <span>{t("Переглянути колекцію")}</span>
                                        </LLink>
                                    </div>
                                </div>
                            )}

                            {/* CASE 3: Triptych Gallery (3 Pure Photographic Frames) */}
                            {isTriptych && (
                                <div className="hero-slider__triptych">
                                    {[
                                        {
                                            img: slide.image1,
                                            pos: slide.image1Pos || "center center",
                                        },
                                        {
                                            img: slide.image2 || slide.image1,
                                            pos: slide.image2Pos || "center center",
                                        },
                                        {
                                            img: slide.image3 || slide.image1,
                                            pos: slide.image3Pos || "center center",
                                        },
                                    ].map((item, imgIndex) => (
                                        <div
                                            key={imgIndex}
                                            className="hero-slider__triptych-item"
                                            style={getLqipStyle(item.img)}
                                        >
                                            <picture>
                                                <source
                                                    srcSet={buildHeroAvifSrcset(item.img)}
                                                    sizes="33.33vw"
                                                    type="image/avif"
                                                />
                                                <source
                                                    srcSet={buildHeroWebpSrcset(item.img)}
                                                    sizes="33.33vw"
                                                    type="image/webp"
                                                />
                                                <img
                                                    src={item.img}
                                                    alt={`${slide.name} — кадр ${imgIndex + 1}`}
                                                    style={{ objectPosition: item.pos }}
                                                    loading={index === 0 ? "eager" : "lazy"}
                                                />
                                            </picture>
                                        </div>
                                    ))}
                                    <div className="hero-slider__triptych-caption">
                                        <h2 className="hero-editorial-duplet__headline">
                                            {slide.title || "The Studio Archive"}
                                        </h2>
                                        <LLink
                                            to={slide.link || "/shop"}
                                            className="hero-editorial-duplet__btn"
                                        >
                                            <span>{t("Переглянути всі моделі")}</span>
                                        </LLink>
                                    </div>
                                </div>
                            )}

                            <div className="hero-slider__overlay" />
                        </div>
                    );
                })}
            </div>

            {/* Content Layer (Minimalist Brand Logo and Navigation) */}
            <div className="hero-slider__content">
                {children ? (
                    children
                ) : (
                    <>
                        {/* Top Clean Brand Emblem */}
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
                    </>
                )}

                {/* Slide indicators */}
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

            {/* Fable Comparison Switcher (dev mode or ?hero=compare) */}
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
                            <span className="hero-compare-pill__name">
                                #1 Lookbook · Black Core & Macro
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 1 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 1}
                            onClick={() => goToSlide(1)}
                        >
                            <span className="hero-compare-pill__rank">#2</span>
                            <span className="hero-compare-pill__name">
                                #2 Lookbook · Rich Cocoa Lace
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 2 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 2}
                            onClick={() => goToSlide(2)}
                        >
                            <span className="hero-compare-pill__rank">#3</span>
                            <span className="hero-compare-pill__name">
                                #3 Chapters · Deep Petrol
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 3 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 3}
                            onClick={() => goToSlide(3)}
                        >
                            <span className="hero-compare-pill__rank">#4</span>
                            <span className="hero-compare-pill__name">#4 Chapters · Dark Ruby</span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 4 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 4}
                            onClick={() => goToSlide(4)}
                        >
                            <span className="hero-compare-pill__rank">#5</span>
                            <span className="hero-compare-pill__name">#5 Pure Studio Triptych</span>
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
