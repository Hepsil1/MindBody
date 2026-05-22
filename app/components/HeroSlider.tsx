import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router";

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

// Default slides for when database is empty
const defaultSlides: SlideData[] = [
    {
        id: "default-1",
        name: "Teal Collection",
        type: "triptych",
        image1: "/generalpics/333_131123.webp",
        image2: "/generalpics/374_131123.webp",
        image3: "/generalpics/338_131123.webp",
    },
    {
        id: "default-2",
        name: "Cocoa Collection",
        type: "triptych",
        image1: "/pics2cloths/IMG_4971.webp",
        image2: "/pics2cloths/IMG_4976.webp",
        image3: "/pics2cloths/IMG_4980.webp",
    },
    {
        id: "default-3",
        name: "Black Collection",
        type: "triptych",
        image1: "/pics1cloths/IMG_6201.webp",
        image2: "/pics1cloths/IMG_6203.webp",
        image3: "/pics1cloths/IMG_6204.webp",
    },
    {
        id: "default-4",
        name: "Teal Variants",
        type: "triptych",
        image1: "/generalpics/348_131123.webp",
        image2: "/generalpics/595_131123.webp",
        image3: "/generalpics/602_131123.webp",
    },
    {
        id: "default-5",
        name: "Hero Banner",
        type: "triptych",
        image1: "/generalpics/585_131123.webp",
        image2: "/generalpics/588_131123.webp",
        image3: "/generalpics/602_131123.webp",
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
                        <div className="hero-slider__triptych">
                            {getSlideItems(slide).map((item, imgIndex) => (
                                <div key={imgIndex} className="hero-slider__triptych-item">
                                    <img
                                        src={item.img}
                                        alt={`${slide.name} Image ${imgIndex + 1}`}
                                        style={{ objectPosition: item.pos }}
                                        loading={index === 0 ? "eager" : "lazy"}
                                        decoding={index === 0 ? "sync" : "async"}
                                        fetchPriority={index === 0 ? "high" : "low"}
                                    />
                                </div>
                            ))}
                        </div>
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
                                    <img
                                        src="/pics/mind_body_logo.png"
                                        alt="MIND BODY — sport wear"
                                    />
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
