import { useCallback, useEffect, useRef, useState } from "react";
import { LLink, useI18n } from "../i18n";

/* ==================================================================
   BrandStories — mobile-only interactive "stories" viewer for the
   three brand films in the «Рух що перетворює» section.

   Why this exists: that section had been redesigned 10+ times as a
   PASSIVE auto-advancing video.  The user asked for something genuinely
   INTERACTIVE and unusual for phones.  This is the Instagram / TikTok
   "stories" pattern, treating the 3 films as 3 chapters:

     • tap the right ~⅔ → next chapter, left ~⅓ → previous
     • press-and-hold → pause + hide the chrome to see the film clean
     • horizontal swipe → flick between chapters (vertical scroll kept)
     • animated segmented progress bar on top, synced to playback
     • a real play / pause button (WCAG 2.2.2) + keyboard arrows/space
     • jump straight to a chapter by tapping its progress segment

   Desktop (≥769px): the whole component is display:none — the original
   3-column layout in home.tsx is left completely untouched.  Playback
   is ALSO gated behind matchMedia('(max-width:768px)') so a desktop
   browser never fetches the videos.

   SSR / hydration: the first render is deterministic — no autoplay
   attribute, index 0, not playing — and playback only begins AFTER
   mount via effects.  Server HTML === first client paint.
   ================================================================== */

interface BrandStoriesProps {
    videos: string[];
    /** One poster still per video — shown instantly while the (multi-MB)
     *  film buffers, so the stage is never a blank box on mobile data. */
    posters?: string[];
}

interface Chapter {
    eyebrow: string;
    line: string;
}

// One caption per brand film. Kept in code (not props) because copy is
// tied to the films themselves, not to the route data. There are 4 brand
// videos now (one per admin-managed Brand World feature), so there are 4
// chapters — `count` caps the player to min(videos, chapters), and a 4th
// video with only 3 chapters would silently never appear on mobile.
const CHAPTERS: Chapter[] = [
    { eyebrow: "01 — Рух", line: "Рух, що перетворює" },
    { eyebrow: "02 — Тканина", line: "Друга шкіра для кожного руху" },
    { eyebrow: "03 — Свобода", line: "Комфорт, що дарує крила" },
    { eyebrow: "04 — Якість", line: "Створено з увагою до кожної деталі" },
];

const HOLD_MS = 220; // press duration that counts as "hold to pause"
const SWIPE_PX = 40; // horizontal travel that counts as a swipe
const TAP_MOVE_PX = 12; // max travel still considered a tap

export default function BrandStories({ videos, posters }: BrandStoriesProps) {
    const { t } = useI18n();
    const count = Math.min(videos.length, CHAPTERS.length);

    // Deterministic initial state (SSR === first client paint).
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [showHint, setShowHint] = useState(false);

    const rootRef = useRef<HTMLElement>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const rafRef = useRef<number | null>(null);
    const holdTimer = useRef<number | null>(null);
    const pointer = useRef<{ x: number; y: number; t: number } | null>(null);
    const heldRef = useRef(false);

    // Whether the active video should actually be running right now.
    const shouldPlay = mounted && isMobile && isInView && playing && !isHolding && count > 0;

    /* ---- mount + media queries ---- */
    useEffect(() => {
        setMounted(true);
        const mqMobile = window.matchMedia("(max-width: 768px)");
        const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const applyMobile = () => setIsMobile(mqMobile.matches);
        const applyMotion = () => setReducedMotion(mqMotion.matches);
        applyMobile();
        applyMotion();
        mqMobile.addEventListener("change", applyMobile);
        mqMotion.addEventListener("change", applyMotion);
        return () => {
            mqMobile.removeEventListener("change", applyMobile);
            mqMotion.removeEventListener("change", applyMotion);
        };
    }, []);

    /* ---- begin playing once mounted on mobile (unless reduced motion,
       which waits for an explicit play tap) ---- */
    useEffect(() => {
        if (mounted && isMobile && !reducedMotion) setPlaying(true);
    }, [mounted, isMobile, reducedMotion]);

    /* ---- in-view detection: pause when scrolled away, resume on return ---- */
    useEffect(() => {
        if (!mounted || !isMobile) return;
        const el = rootRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => setIsInView(entries[0]?.isIntersecting ?? false),
            { threshold: 0.55 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [mounted, isMobile]);

    /* ---- first-time hint (shown once per browser) ---- */
    useEffect(() => {
        if (!mounted || !isMobile) return;
        let seen = false;
        try {
            seen = localStorage.getItem("mb_stories_hint") === "1";
        } catch {
            /* private mode — just show it */
        }
        if (seen) return;
        setShowHint(true);
        const t = window.setTimeout(() => setShowHint(false), 3800);
        return () => window.clearTimeout(t);
    }, [mounted, isMobile]);

    const dismissHint = useCallback(() => {
        setShowHint(false);
        try {
            localStorage.setItem("mb_stories_hint", "1");
        } catch {
            /* ignore */
        }
    }, []);

    /* ---- playback driver: active video runs, the rest pause ---- */
    useEffect(() => {
        if (!mounted || !isMobile) {
            videoRefs.current.forEach((v) => v?.pause());
            return;
        }
        videoRefs.current.forEach((v, i) => {
            if (!v) return;
            if (i === index) {
                v.preload = "auto";
                if (shouldPlay) {
                    const p = v.play();
                    if (p && typeof p.catch === "function") p.catch(() => {});
                } else {
                    v.pause();
                }
            } else {
                v.pause();
            }
        });
    }, [index, shouldPlay, mounted, isMobile]);

    /* ---- reset time + progress segments whenever the chapter changes ---- */
    useEffect(() => {
        const v = videoRefs.current[index];
        if (v) {
            try {
                v.currentTime = 0;
            } catch {
                /* ignore */
            }
        }
        fillRefs.current.forEach((f, i) => {
            if (f) f.style.width = i < index ? "100%" : "0%";
        });
    }, [index]);

    /* ---- requestAnimationFrame: drive the active segment's fill ---- */
    useEffect(() => {
        if (!shouldPlay) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            return;
        }
        const tick = () => {
            const v = videoRefs.current[index];
            const f = fillRefs.current[index];
            if (v && f && v.duration && !Number.isNaN(v.duration)) {
                const pct = Math.min(100, (v.currentTime / v.duration) * 100);
                f.style.width = pct + "%";
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [shouldPlay, index]);

    /* ---- navigation ---- */
    const goTo = useCallback(
        (i: number) => {
            if (count === 0) return;
            dismissHint();
            setIndex(((i % count) + count) % count);
        },
        [count, dismissHint],
    );
    const next = useCallback(() => goTo(index + 1), [goTo, index]);
    const prev = useCallback(() => goTo(index - 1), [goTo, index]);

    const handleEnded = useCallback(() => {
        const f = fillRefs.current[index];
        if (f) f.style.width = "100%";
        if (reducedMotion) return; // no auto-advance under reduced motion
        goTo(index + 1);
    }, [index, goTo, reducedMotion]);

    const togglePlay = useCallback(() => {
        dismissHint();
        setPlaying((p) => !p);
    }, [dismissHint]);

    /* ---- pointer gestures: tap zones / hold-to-pause / swipe ---- */
    const clearHold = () => {
        if (holdTimer.current) {
            window.clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        pointer.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        heldRef.current = false;
        clearHold();
        holdTimer.current = window.setTimeout(() => {
            heldRef.current = true;
            setIsHolding(true);
        }, HOLD_MS);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointer.current) return;
        const dx = Math.abs(e.clientX - pointer.current.x);
        const dy = Math.abs(e.clientY - pointer.current.y);
        if (dx > TAP_MOVE_PX || dy > TAP_MOVE_PX) clearHold();
    };

    const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
        clearHold();
        const start = pointer.current;
        pointer.current = null;
        if (heldRef.current) {
            heldRef.current = false;
            setIsHolding(false);
            return;
        }
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        // Horizontal swipe wins over tap.
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) next();
            else prev();
            return;
        }
        // Tap: left third = prev, rest = next.
        if (Math.abs(dx) < TAP_MOVE_PX && Math.abs(dy) < TAP_MOVE_PX) {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (ratio < 0.33) prev();
            else next();
        }
    };

    const onPointerCancel = () => {
        clearHold();
        pointer.current = null;
        if (heldRef.current) {
            heldRef.current = false;
            setIsHolding(false);
        }
    };

    /* ---- keyboard ---- */
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight") {
            e.preventDefault();
            next();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
        } else if (e.key === " " || e.key === "Spacebar" || e.key === "k") {
            e.preventDefault();
            togglePlay();
        }
    };

    if (count === 0) return null;

    const chapter = CHAPTERS[index] ?? CHAPTERS[0];

    return (
        <section
            ref={rootRef}
            className={`brand-stories${isHolding ? " is-holding" : ""}`}
            aria-roledescription={t("Інтерактивна історія бренду")}
            aria-label={t("Рух що перетворює — бренд-фільм MIND BODY")}
            tabIndex={0}
            onKeyDown={onKeyDown}
        >
            <div className="brand-stories__intro">
                <span className="brand-stories__kicker">MIND BODY®</span>
                <h2 className="brand-stories__title">
                    {t("Рух що")} <em>{t("перетворює")}</em>
                </h2>
            </div>

            <div className="brand-stories__card">
                <div className="brand-stories__stage" onContextMenu={(e) => e.preventDefault()}>
                    {Array.from({ length: count }).map((_, i) => (
                        <video
                            key={i}
                            ref={(el) => {
                                videoRefs.current[i] = el;
                            }}
                            className={`brand-stories__video${i === index ? " is-active" : ""}`}
                            src={videos[i]}
                            // Poster paints instantly (sharp brand still) so the
                            // stage is never blank while the 4–7 MB film buffers
                            // on mobile data; the video fades in over it.
                            poster={posters?.[i]}
                            muted
                            playsInline
                            loop={false}
                            preload="none"
                            onEnded={handleEnded}
                            aria-hidden="true"
                        />
                    ))}

                    <div className="brand-stories__scrim" aria-hidden="true" />

                    {/* segmented progress — each segment jumps to its chapter */}
                    <div className="brand-stories__progress">
                        {Array.from({ length: count }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                className="brand-stories__seg"
                                aria-label={t("Розділ {n} з {count}", { n: i + 1, count })}
                                aria-current={i === index ? "true" : undefined}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => goTo(i)}
                            >
                                <span className="brand-stories__seg-track">
                                    <span
                                        ref={(el) => {
                                            fillRefs.current[i] = el;
                                        }}
                                        className="brand-stories__seg-fill"
                                    />
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* caption */}
                    <div className="brand-stories__caption" aria-hidden="true">
                        <span className="brand-stories__chx">{t(chapter.eyebrow)}</span>
                        <p className="brand-stories__line">{t(chapter.line)}</p>
                    </div>

                    {/* play / pause — visible control for auto-moving media */}
                    <button
                        type="button"
                        className="brand-stories__pp"
                        aria-pressed={playing}
                        aria-label={playing ? t("Призупинити відео") : t("Відтворити відео")}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={togglePlay}
                    >
                        {playing ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                <rect
                                    x="6"
                                    y="5"
                                    width="4"
                                    height="14"
                                    rx="1"
                                    fill="currentColor"
                                />
                                <rect
                                    x="14"
                                    y="5"
                                    width="4"
                                    height="14"
                                    rx="1"
                                    fill="currentColor"
                                />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                <path d="M8 5v14l11-7z" fill="currentColor" />
                            </svg>
                        )}
                    </button>

                    {/* first-time hint */}
                    {showHint && (
                        <div className="brand-stories__hint" aria-hidden="true">
                            {t("Торкніться, щоб гортати")}
                        </div>
                    )}

                    {/* gesture capture overlay (progressive enhancement) */}
                    <div
                        className="brand-stories__gestures"
                        aria-hidden="true"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endPointer}
                        onPointerCancel={onPointerCancel}
                        onPointerLeave={onPointerCancel}
                    />
                </div>
            </div>

            <div className="brand-stories__cta-row">
                <LLink to="/about" className="brand-stories__cta">
                    {t("Філософія бренду")}
                    <span aria-hidden="true">→</span>
                </LLink>
            </div>

            {/* screen-reader announcement of chapter changes */}
            <span className="brand-stories__live visually-hidden" aria-live="polite">
                {`${t("Розділ {n} з {count}", { n: index + 1, count })}. ${t(chapter.line)}`}
            </span>
        </section>
    );
}
