import { useState, useEffect, type ReactNode } from "react";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { useI18n, LLink } from "../i18n";
import "../styles/hero.css";

// Define the Slide type that matches the database model
export type HeroLayoutMode = "editorial-left" | "trio-center" | "top-clean";

export interface SlideData {
    id: string;
    name: string;
    type: "triptych" | "single";
    link?: string | null;
    image1: string;
    mobileImage?: string | null;
    image2?: string | null;
    image3?: string | null;
    // Optional object-position overrides per image (e.g. "50% 30%")
    image1Pos?: string;
    image2Pos?: string;
    image3Pos?: string;
    layout?: HeroLayoutMode;
}

// Default slides featuring Fable-curated luxury studio hero solutions.
// V3 (editorial-left) is Fable's Rank #1 Winner: Zero-Cutout studio outpaint with left-aligned white logo.
// V1 (trio-center) is Fable's Rank #2: Signature Multi-Ref Trio with 85mm pulled-back safe zones.
// V2 (top-clean) is Fable's Rank #3: Standing Chevron Trio with Frequency Separation & top logo headroom.
const FACE_SAFE = "50% 35%";

export const defaultSlides: SlideData[] = [
    {
        id: "default-1",
        name: "V3 · Editorial Lookbook",
        type: "single",
        layout: "editorial-left",
        image1: "/Slides/hero-v3-desktop.webp",
        mobileImage: "/Slides/hero-v3-mobile.webp",
        image1Pos: "50% 50%",
    },
    {
        id: "default-2",
        name: "V1 · Signature Trio",
        type: "single",
        layout: "trio-center",
        image1: "/Slides/hero-v1-desktop.webp",
        mobileImage: "/Slides/hero-v1-mobile.webp",
        image1Pos: "50% 50%",
    },
    {
        id: "default-3",
        name: "V2 · Studio Standing",
        type: "single",
        layout: "top-clean",
        image1: "/Slides/hero-v2-desktop.webp",
        mobileImage: "/Slides/hero-v2-mobile.webp",
        image1Pos: "50% 50%",
    },
    {
        id: "default-4",
        name: "Cocoa Collection",
        type: "triptych",
        image1: "/pics2cloths/IMG_4971.webp",
        image2: "/pics2cloths/IMG_4976.webp",
        image3: "/pics2cloths/IMG_4980.webp",
        image1Pos: FACE_SAFE,
        image2Pos: FACE_SAFE,
        image3Pos: FACE_SAFE,
    },
    {
        id: "default-5",
        name: "Teal Variants",
        type: "triptych",
        image1: "/generalpics/348_131123.webp",
        image2: "/generalpics/595_131123.webp",
        image3: "/generalpics/602_131123.webp",
        image1Pos: FACE_SAFE,
        image2Pos: FACE_SAFE,
        image3Pos: FACE_SAFE,
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
    interval = 5000,
    children,
}: HeroSliderProps) {
    const { t } = useI18n();
    const slides = propSlides && propSlides.length > 0 ? propSlides : defaultSlides;
    const [activeSlide, setActiveSlide] = useState(0);
    const [isCompareMode, setIsCompareMode] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const hasHeroParam = params.has("hero") || params.has("compare");
            const isDev = Boolean(import.meta.env.DEV);
            if (hasHeroParam || isDev) {
                setIsCompareMode(true);
            }
            const heroVal = (params.get("hero") || "").toLowerCase();
            if (heroVal === "v1" || heroVal === "1") {
                setActiveSlide(1);
            } else if (heroVal === "v2" || heroVal === "2") {
                setActiveSlide(2);
            } else if (heroVal === "v3" || heroVal === "3" || heroVal === "0") {
                setActiveSlide(0);
            }
            const slideParam = params.get("slide");
            if (slideParam !== null) {
                const idx = parseInt(slideParam, 10);
                if (!isNaN(idx) && idx >= 0 && idx < slides.length) {
                    setActiveSlide(idx);
                }
            }
        }
    }, [slides.length]);

    useEffect(() => {
        if (!autoPlay || isCompareMode) return;

        const slideInterval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % slides.length);
        }, interval);
        return () => clearInterval(slideInterval);
    }, [autoPlay, isCompareMode, interval, slides.length]);

    const goToSlide = (index: number) => {
        setActiveSlide(index);
        if (typeof window !== "undefined" && window.history?.replaceState) {
            const url = new URL(window.location.href);
            const variantMap: Record<number, string> = { 0: "v3", 1: "v1", 2: "v2" };
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
        currentSlide?.layout ||
        (currentSlide?.type === "single" ? "editorial-left" : "trio-center");

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

    return (
        <section
            className={`hero-slider hero-slider--${activeLayout}`}
            id="hero"
            aria-label={t("Вітрина бренду MIND BODY")}
        >
            {/* Slides Container */}
            <div className="hero-slider__slides">
                {slides.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`hero-slider__slide ${index === activeSlide ? "is-active" : ""}`}
                        data-slide={index}
                    >
                        {(() => {
                            const items = getSlideItems(slide);
                            // Dynamic `sizes`:
                            // - desktop triptych → each item takes ~33vw (single → 100vw)
                            // - MOBILE → 200vw, deliberately over-stated.
                            //
                            // Why 200vw on mobile: below 768px the CSS shows ONLY the
                            // middle item, FULL-SCREEN, object-fit:cover in a PORTRAIT
                            // box. A cover-crop is height-bound, but `sizes` only
                            // describes width — so 100vw made the browser fetch the
                            // 1200w variant (e.g. 1200×675 for a landscape slide) and
                            // then CSS stretched its 675px height across a ~2532px-tall
                            // DPR3 screen = ~3.7× upscale = the mush the owner reported.
                            // 200vw forces the browser to pick the LARGEST available
                            // variant (master / 2400w), i.e. maximum available
                            // resolution on phones. (A truly portrait hero source then
                            // renders pixel-perfect; a landscape source is still the
                            // best it can be — see note for the owner: upload portrait
                            // hero photos for flawless mobile.)
                            const desktopFrac = Math.floor(100 / items.length);
                            const sizesAttr = `(max-width: 768px) 200vw, ${desktopFrac}vw`;
                            return (
                                <div className="hero-slider__triptych">
                                    {items.map((item, imgIndex) => (
                                        <div
                                            key={imgIndex}
                                            className="hero-slider__triptych-item"
                                            /* Batch 40 atom 8: LQIP blur-up so the
                                               hero never opens to blank cream on
                                               4G — visitors see the slide's
                                               composition immediately. */
                                            style={getLqipStyle(item.img)}
                                        >
                                            {/* width / height attrs are nominal — CSS uses object-fit:cover.
                                                Their job is to give the browser an aspect ratio so the hero
                                                reserves layout space and we don't get a 0.3 CLS jump when
                                                the image decodes. 1080x1920 is the typical mobile-portrait
                                                ratio of our hero uploads. */}
                                            <picture>
                                                {item.mobileImg && (
                                                    <>
                                                        <source
                                                            media="(max-width: 768px)"
                                                            srcSet={buildAvifSrcset(item.mobileImg)}
                                                            sizes="100vw"
                                                            type="image/avif"
                                                        />
                                                        <source
                                                            media="(max-width: 768px)"
                                                            srcSet={buildWebpSrcset(item.mobileImg)}
                                                            sizes="100vw"
                                                            type="image/webp"
                                                        />
                                                    </>
                                                )}
                                                {/* Batch 40 atom 6: AVIF first
                                                    for -25/-30% mobile payload. */}
                                                <source
                                                    srcSet={buildAvifSrcset(item.img)}
                                                    sizes={
                                                        item.mobileImg
                                                            ? `${desktopFrac}vw`
                                                            : sizesAttr
                                                    }
                                                    type="image/avif"
                                                />
                                                <source
                                                    srcSet={buildWebpSrcset(item.img)}
                                                    sizes={
                                                        item.mobileImg
                                                            ? `${desktopFrac}vw`
                                                            : sizesAttr
                                                    }
                                                    type="image/webp"
                                                />
                                                <img
                                                    src={item.img}
                                                    // Slide names are admin-entered and often
                                                    // placeholders («123», «Без назви») — a
                                                    // meaningless alt fails WCAG and reads as
                                                    // garbage in screen readers / image search.
                                                    // Fall back to brand wording when the name
                                                    // carries no semantics.
                                                    alt={
                                                        slide.name &&
                                                        !/^[\d\s.,-]*$/.test(slide.name) &&
                                                        slide.name !== "Без назви"
                                                            ? `${slide.name} — фото ${imgIndex + 1}`
                                                            : `Колекція MIND BODY — фото ${imgIndex + 1}`
                                                    }
                                                    width={1080}
                                                    height={1920}
                                                    style={{ objectPosition: item.pos }}
                                                    loading={index === 0 ? "eager" : "lazy"}
                                                    decoding={index === 0 ? "sync" : "async"}
                                                    fetchPriority={index === 0 ? "high" : "low"}
                                                />
                                            </picture>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                        <div className="hero-slider__overlay"></div>
                    </div>
                ))}
            </div>

            {/* Content Layer */}
            <div className="hero-slider__content">
                {children ? (
                    children
                ) : (
                    <>
                        {/* Brand Logo + UTP */}
                        <div className="hero-slider__logo-container">
                            <div className="hero-slider__brand-block">
                                <div className="hero-slider__logo">
                                    <picture>
                                        {/* Batch 30: serve a PRE-RENDERED WHITE version of
                                            the logo so the rasterised pixels are already
                                            white. No CSS filter dependency = no progressive-
                                            decode flash. The previous Batch 26/28 inline
                                            filter approach left a window where webp was
                                            partially decoded but the composited filter
                                            hadn't run yet, briefly showing the underlying
                                            black artwork. Generated via
                                            scripts/gen-white-logo.mjs (sharp .negate()). */}
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

                        {/* CTA Button */}
                        <div className="hero-slider__footer-cta">
                            <div className="hero-slider__cta">
                                <LLink
                                    to="/shop/yoga"
                                    className="btn btn--primary btn--glow hero-slider__cta-btn"
                                    id="cta-shop"
                                >
                                    {t("Переглянути колекцію")}
                                </LLink>
                            </div>
                        </div>
                    </>
                )}

                {/* Slide indicators — only when there is more than one
                    slide. With a single slide the lone active dot is a
                    meaningless 48px pill floating in the hero. */}
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
                            <span className="hero-compare-pill__rank">#1</span>
                            <span className="hero-compare-pill__name">V3 · Editorial</span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 1 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 1}
                            onClick={() => goToSlide(1)}
                        >
                            <span className="hero-compare-pill__rank">#2</span>
                            <span className="hero-compare-pill__name">V1 · Signature Trio</span>
                        </button>
                        <button
                            type="button"
                            className={`hero-compare-pill ${activeSlide === 2 ? "is-active" : ""}`}
                            aria-pressed={activeSlide === 2}
                            onClick={() => goToSlide(2)}
                        >
                            <span className="hero-compare-pill__rank">#3</span>
                            <span className="hero-compare-pill__name">V2 · Standing Trio</span>
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
