import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { buildWebpSrcset } from "../utils/responsive-image";

// Define the Slide type that matches the database model
export interface SlideData {
    id: string;
    name: string;
    type: "triptych" | "single";
    link?: string | null;
    image1: string;
    image2?: string | null;
    image3?: string | null;
    // Optional object-position overrides per image (e.g. "50% 30%")
    image1Pos?: string;
    image2Pos?: string;
    image3Pos?: string;
}

// Default slides for when database is empty.
// imagePos defaults to "50% 35%" — face/upper-body safe crop for women's
// fashion photography. Center crop would slice through the figure's torso.
const FACE_SAFE = "50% 35%";

const defaultSlides: SlideData[] = [
    {
        id: "default-1",
        name: "Teal Collection",
        type: "triptych",
        image1: "/generalpics/333_131123.webp",
        image2: "/generalpics/374_131123.webp",
        image3: "/generalpics/338_131123.webp",
        image1Pos: FACE_SAFE,
        image2Pos: FACE_SAFE,
        image3Pos: FACE_SAFE,
    },
    {
        id: "default-2",
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
        id: "default-3",
        name: "Black Collection",
        type: "triptych",
        image1: "/pics1cloths/IMG_6201.webp",
        image2: "/pics1cloths/IMG_6203.webp",
        image3: "/pics1cloths/IMG_6204.webp",
        image1Pos: FACE_SAFE,
        image2Pos: FACE_SAFE,
        image3Pos: FACE_SAFE,
    },
    {
        id: "default-4",
        name: "Teal Variants",
        type: "triptych",
        image1: "/generalpics/348_131123.webp",
        image2: "/generalpics/595_131123.webp",
        image3: "/generalpics/602_131123.webp",
        image1Pos: FACE_SAFE,
        image2Pos: FACE_SAFE,
        image3Pos: FACE_SAFE,
    },
    {
        id: "default-5",
        name: "Hero Banner",
        type: "triptych",
        image1: "/generalpics/585_131123.webp",
        image2: "/generalpics/588_131123.webp",
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
    const slides = propSlides && propSlides.length > 0 ? propSlides : defaultSlides;
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        if (!autoPlay) return;

        const slideInterval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(slideInterval);
    }, [slides.length]);

    const goToSlide = (index: number) => {
        setActiveSlide(index);
    };

    // Convert slide data to images array with positions
    const getSlideItems = (slide: SlideData) => {
        if (slide.type === "single") {
            return [{ img: slide.image1, pos: slide.image1Pos || "center center" }];
        }
        return [
            { img: slide.image1, pos: slide.image1Pos || "center center" },
            { img: slide.image2, pos: slide.image2Pos || "center center" },
            { img: slide.image3, pos: slide.image3Pos || "center center" },
        ].filter((item): item is { img: string; pos: string } => !!item.img);
    };

    return (
        <section className="hero-slider" id="hero" aria-label="Вітрина бренду MIND BODY">
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
                            // Dynamic `sizes` based on item count:
                            // - single (1 item) → image fills 100vw on desktop
                            // - triptych (3 items) → each takes 33vw
                            // Previously hardcoded "33vw" → browser loaded the
                            // 800w variant for single slides which CSS then
                            // stretched to 100vw = ~3× upscale = mushy.
                            const desktopFrac = Math.floor(100 / items.length);
                            const sizesAttr = `(max-width: 768px) 100vw, ${desktopFrac}vw`;
                            return (
                                <div className="hero-slider__triptych">
                                    {items.map((item, imgIndex) => (
                                        <div key={imgIndex} className="hero-slider__triptych-item">
                                            {/* width / height attrs are nominal — CSS uses object-fit:cover.
                                                Their job is to give the browser an aspect ratio so the hero
                                                reserves layout space and we don't get a 0.3 CLS jump when
                                                the image decodes. 1080x1920 is the typical mobile-portrait
                                                ratio of our hero uploads. */}
                                            <picture>
                                                <source
                                                    srcSet={buildWebpSrcset(item.img)}
                                                    sizes={sizesAttr}
                                                    type="image/webp"
                                                />
                                                <img
                                                    src={item.img}
                                                    alt={`${slide.name} Image ${imgIndex + 1}`}
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
                                        <source
                                            srcSet="/pics/mind_body_logo.webp"
                                            type="image/webp"
                                        />
                                        <img
                                            src="/pics/mind_body_logo.png"
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
                                <Link
                                    to="/shop/yoga"
                                    className="btn btn--primary btn--glow hero-slider__cta-btn"
                                    id="cta-shop"
                                >
                                    Переглянути колекцію
                                </Link>
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
                                aria-label={`Slide ${index + 1}`}
                                onClick={() => goToSlide(index)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
