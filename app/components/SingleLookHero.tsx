import { useState, useRef } from "react";
import { LLink, useI18n, useMoney } from "../i18n";
import { getLqipStyle } from "../utils/lqip";
import { buildAvifSrcset, buildWebpSrcset } from "../utils/responsive-image";
import { getColorHex, getColorLabel } from "../utils/colors";
import "../styles/single-look.css";

export interface SingleLook {
    slug: string;
    name: string;
    shortTitle?: string;
    kicker: string;
    price: number;
    comparePrice: number | null;
    colors: string[];
    imageDesktop: string;
    imageMobile: string;
    frontImage?: string;
    backImage?: string;
    frontPos?: string;
    backPos?: string;
    studioBg?: string;
    /** Real product slug for the CTA (falls back to `slug`). */
    productSlug?: string;
}

export default function SingleLookHero({ looks }: { looks: SingleLook[] }) {
    const { t } = useI18n();
    const money = useMoney();
    const [idx, setIdx] = useState(0);
    const [cycle, setCycle] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [colorByLook, setColorByLook] = useState<Record<string, string>>({});
    const heroRef = useRef<HTMLElement>(null);

    const lookCount = looks.length;
    const look = looks[Math.min(idx, lookCount - 1)];
    const color = look ? (colorByLook[look.slug] ?? look.colors[0]) : "";
    const href = look
        ? `/p/${look.productSlug || look.slug}${color ? `?color=${encodeURIComponent(color)}` : ""}`
        : "/shop/sport";

    const onMouseEnter = () => {
        setIsPaused(true);
    };

    const onMouseLeave = () => {
        setIsPaused(false);
    };

    const pick = (i: number) => {
        setIdx(i);
        setCycle((c) => c + 1);
    };

    const handleAnimationEnd = () => {
        if (!isPaused && lookCount > 1) {
            setIdx((prev) => (prev + 1) % lookCount);
            setCycle((c) => c + 1);
        }
    };

    if (!looks || looks.length === 0) return null;

    return (
        <section
            ref={heroRef}
            className={`slook ${isPaused ? "is-paused" : ""}`}
            id="hero"
            aria-label={t("Вітрина бренду MIND BODY")}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Background 100vw Studio Stage */}
            <div className="slook__stage">
                {looks.map((l, i) => (
                    <div
                        key={l.slug}
                        className={`slook__look ${i === idx ? "is-active" : ""}`}
                        aria-hidden={i === idx ? undefined : true}
                        style={{ backgroundColor: l.studioBg || "#dedad4" }}
                    >
                        <picture>
                            {/* Mobile 9:16 Portrait Source */}
                            <source
                                media="(max-width: 768px)"
                                type="image/avif"
                                srcSet={buildAvifSrcset(l.imageMobile)}
                                sizes="100vw"
                            />
                            <source
                                media="(max-width: 768px)"
                                type="image/webp"
                                srcSet={buildWebpSrcset(l.imageMobile)}
                                sizes="100vw"
                            />
                            {/* Desktop 16:9 Landscape Retina Master */}
                            <source
                                media="(min-width: 769px)"
                                type="image/avif"
                                srcSet={buildAvifSrcset(l.imageDesktop)}
                                sizes="100vw"
                            />
                            <source
                                media="(min-width: 769px)"
                                type="image/webp"
                                srcSet={buildWebpSrcset(l.imageDesktop)}
                                sizes="100vw"
                            />
                            <img
                                src={`${l.imageDesktop}.webp`}
                                alt={`${l.name} — ${l.kicker}`}
                                className="slook__img"
                                decoding="async"
                                loading={i === 0 ? "eager" : "lazy"}
                                fetchPriority={i === 0 ? "high" : "auto"}
                                style={getLqipStyle(l.imageDesktop)}
                            />
                        </picture>
                    </div>
                ))}
            </div>

            {/* Center Brand Emblem & Wordmark (Desktop Editorial Centerpiece) */}
            <div className="slook__center-brand" aria-hidden="true">
                <picture>
                    <source srcSet="/pics/mind_body_logo_white.webp" type="image/webp" />
                    <img
                        src="/pics/mind_body_logo_white.png"
                        alt="MIND BODY — sport wear"
                        className="slook__center-logo"
                        width="280"
                        height="212"
                        fetchPriority="high"
                        decoding="async"
                    />
                </picture>
            </div>

            {/* Editorial Focus: Pure Centered Luxury CTA & Minimal Timeline */}
            <div className="slook__overlay">
                <div className="slook__info slook__info--centered">
                    <LLink
                        to="/shop/yoga"
                        className="slook__cta-btn slook__cta-btn--centered"
                        id="hero-cta-btn"
                    >
                        {t("Переглянути колекцію")}
                    </LLink>
                </div>

                {/* Minimal Hairline Timeline Dashes */}
                {lookCount > 1 && (
                    <div
                        className="slook__timeline"
                        role="tablist"
                        aria-label={t("Навігація по образах")}
                    >
                        {looks.map((l, i) => (
                            <button
                                key={l.slug}
                                type="button"
                                role="tab"
                                aria-selected={i === idx}
                                aria-label={l.name}
                                className={`slook__timeline-btn ${i === idx ? "is-active" : ""}`}
                                onClick={() => pick(i)}
                            >
                                <span className="slook__timeline-line">
                                    {i === idx && (
                                        <span
                                            key={`${idx}-${cycle}`}
                                            className="slook__timeline-fill"
                                            onAnimationEnd={handleAnimationEnd}
                                        />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
