import { useState, useEffect, type ReactNode } from "react";

// Define the Slide type that matches the database model
export interface SlideData {
    id: string;
    name: string;
    type: "triptych" | "single";
    link?: string | null;
    image1: string;
    image2?: string | null;
    image3?: string | null;
}

// Default slides for when database is empty
const defaultSlides: SlideData[] = [
    {
        id: "default-1",
        name: "Teal Collection",
        type: "triptych",
        image1: "/generalpics/333_131123.jpg",
        image2: "/generalpics/374_131123.jpg",
        image3: "/generalpics/338_131123.jpg",
    },
    {
        id: "default-2",
        name: "Cocoa Collection",
        type: "triptych",
        image1: "/pics2cloths/IMG_4971.JPG",
        image2: "/pics2cloths/IMG_4976.JPG",
        image3: "/pics2cloths/IMG_4980.JPG",
    },
    {
        id: "default-3",
        name: "Black Collection",
        type: "triptych",
        image1: "/pics1cloths/IMG_6201.JPG",
        image2: "/pics1cloths/IMG_6203.JPG",
        image3: "/pics1cloths/IMG_6204.JPG",
    },
    {
        id: "default-4",
        name: "Teal Variants",
        type: "triptych",
        image1: "/generalpics/348_131123.jpg",
        image2: "/generalpics/595_131123.jpg",
        image3: "/generalpics/602_131123.jpg",
    },
    {
        id: "default-5",
        name: "Hero Banner",
        type: "single",
        image1: "/Slides/Example.png",
    },
];

interface HeroSliderProps {
    slides?: SlideData[];
    autoPlay?: boolean;
    interval?: number;
    children?: React.ReactNode;
}

export default function HeroSlider({ slides: propSlides, autoPlay = true, interval = 5000, children }: HeroSliderProps) {
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
            return [{ img: slide.image1, pos: (slide as any).image1Pos || "center center" }];
        }
        return [
            { img: slide.image1, pos: (slide as any).image1Pos || "center center" },
            { img: slide.image2, pos: (slide as any).image2Pos || "center center" },
            { img: slide.image3, pos: (slide as any).image3Pos || "center center" }
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
                {children ? children : (
                    <>
                        {/* Brand Logo + UTP */}
                        <div className="hero-slider__logo-container">
                            <div className="hero-slider__brand-block">
                                <div className="hero-slider__logo">
                                    <img src="/pics/mind_body_logo.png" alt="MIND BODY — sport wear" />
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <div className="hero-slider__footer-cta">
                            <div className="hero-slider__cta">
                                <a href="#shop" className="btn btn--primary btn--glow hero-slider__cta-btn" id="cta-shop">
                                    Переглянути колекцію
                                </a>
                            </div>
                        </div>
                    </>
                )}

                {/* Slide Indicators */}
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
            </div>


        </section>
    );
}
