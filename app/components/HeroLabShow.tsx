/**
 * HeroLabShow — /hero-lab/best: a self-running slideshow of HeroLabStage slides.
 * Each stage lights its models in turn, then reports onDone and the next slide
 * fades in over a still copy of the one that just left (same crossfade the live
 * hero already uses between looks; nothing is morphed). Hovering / tapping a
 * model or the button holds the show.
 */
import { useEffect, useState } from "react";
import HeroLabStage, { type LabMode, type LabModel } from "./HeroLabStage";

export interface ShowSlide {
    sid: string;
    maskDir: string;
    studioBg?: string;
    models: LabModel[];
}

/** ms per model: 2 models ≈ 9 s a slide, 4 models ≈ 18 s */
const SLOT = 4400;

export default function HeroLabShow({ slides, mode }: { slides: ShowSlide[]; mode: LabMode }) {
    const [idx, setIdx] = useState(0);
    const [prev, setPrev] = useState<number | null>(null);
    const cur = slides[idx];
    const next = slides[(idx + 1) % slides.length];

    const go = (i: number) => {
        if (i === idx) return;
        setPrev(idx);
        setIdx(i);
    };

    useEffect(() => {
        if (prev === null) return;
        const id = window.setTimeout(() => setPrev(null), 1300);
        return () => window.clearTimeout(id);
    }, [prev, idx]);

    const under = prev !== null ? slides[prev] : null;

    return (
        <div className="hshow">
            {under && (
                <div className="hshow__under" aria-hidden="true">
                    <div className="hlab__stage" style={{ backgroundColor: under.studioBg }}>
                        <div
                            className="hlab hlab__canvas"
                            style={{
                                ["--vx" as string]: under.models[under.models.length - 1].cx,
                            }}
                        >
                            <img
                                src={`${under.maskDir}/base.webp`}
                                srcSet={`${under.maskDir}/base-1600.webp 1600w, ${under.maskDir}/base.webp 2560w`}
                                sizes="(max-width: 768px) 300vw, 100vw"
                                alt=""
                                className="hlab__img"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div key={cur.sid} className="hshow__top">
                <HeroLabStage
                    maskDir={cur.maskDir}
                    studioBg={cur.studioBg}
                    models={cur.models}
                    mode={mode}
                    slot={SLOT}
                    eager
                    onDone={() => go((idx + 1) % slides.length)}
                />
            </div>

            <div className="hshow__dots" role="tablist">
                {slides.map((s, i) => (
                    <button
                        key={s.sid}
                        type="button"
                        role="tab"
                        aria-selected={i === idx}
                        aria-label={`${i + 1}`}
                        className={i === idx ? "is-active" : ""}
                        onClick={() => go(i)}
                    >
                        <span />
                    </button>
                ))}
            </div>

            {/* warm the next slide so its light is ready when its turn comes */}
            <div hidden>
                <img
                    src={`${next.maskDir}/base.webp`}
                    srcSet={`${next.maskDir}/base-1600.webp 1600w, ${next.maskDir}/base.webp 2560w`}
                    sizes="(max-width: 768px) 300vw, 100vw"
                    alt=""
                />
                <img src={`${next.maskDir}/aura0.webp`} alt="" />
            </div>
        </div>
    );
}
