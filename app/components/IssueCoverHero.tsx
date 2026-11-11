import {
    useState,
    useEffect,
    useRef,
    useCallback,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n, LLink } from "../i18n";
import { getLqipStyle } from "../utils/lqip";
import "../styles/issue-cover-hero.css";

export interface FrameItem {
    src: string;
    alt: string;
    focus?: string;
    view?: "front" | "back";
}

export interface IssueData {
    id: string;
    issueNumber: string;
    issueCode: string;
    season: string;
    headline: string;
    subheadline: string;
    editorialStory: string;
    quote: string;
    price: string;
    cta: string;
    link: string;
    bg: string;
    ink: string;
    accent: string;
    frames: {
        front: FrameItem;
        back?: FrameItem;
    };
    badges: string[];
}

export const MAGAZINE_ISSUES: IssueData[] = [
    {
        id: "issue-01",
        issueNumber: "Nº 01",
        issueCode: "ISSUE 01 / 04",
        season: "AUTUMN — WINTER 2026/27",
        headline: "Duality of Form",
        subheadline: "Дві моделі в єдиному кадрі студійної зйомки",
        editorialStory:
            "Скульптурні комбінезони кльош у відтінках Rich Plum та Obsidian Black на дзеркальній підлозі. Досконалий баланс анатомічного капюшона та розширеного силуету.",
        quote: "«Синергія форми та руху: монохром і глибокий сливовий тон у бездоганному студійному діалозі».",
        price: "від 3 800 ₴",
        cta: "Відкрити колекцію",
        link: "/shop/sport",
        bg: "#B2ACB5",
        ink: "#16111A",
        accent: "#E2D9E2",
        frames: {
            front: {
                src: "fable-s2-duo-campaign",
                alt: "MIND BODY — Дві моделі у комбінезонах кльош з капюшоном",
                focus: "50% 20%",
            },
        },
        badges: ["STUDIO DUO", "HOODED FLARE", "CAPSULE 01"],
    },
    {
        id: "issue-02",
        issueNumber: "Nº 02",
        issueCode: "ISSUE 02 / 04",
        season: "SIGNATURE EDITION",
        headline: "Sculpted Open Back",
        subheadline: "Сливовий комбінезон із вишивкою-мандалою",
        editorialStory:
            "Магнетичний прямий погляд моделі у вічі та можливість миттєвого розвороту до скульптурної відкритої спини зі складною перехресною шнуровкою ручної роботи.",
        quote: "«Культова геометрія відкритої спини, що підтримує поставу без жодного відчуття стиснення».",
        price: "3 800 ₴",
        cta: "Переглянути виріб",
        link: "/shop/casual",
        bg: "#DFDADE",
        ink: "#20141E",
        accent: "#F0EBF0",
        frames: {
            front: {
                src: "fable-s1-front",
                alt: "MIND BODY — Сливовий комбінезон, фронтальний погляд з мандалою",
                focus: "50% 20%",
                view: "front",
            },
            back: {
                src: "fable-s1-back-full",
                alt: "MIND BODY — Сливовий комбінезон у повний зріст, скульптурна шнуровка спини",
                focus: "50% 25%",
                view: "back",
            },
        },
        badges: ["ICONIC LACE", "EMBROIDERED MANDALA", "RICH PLUM"],
    },
    {
        id: "issue-03",
        issueNumber: "Nº 03",
        issueCode: "ISSUE 03 / 04",
        season: "CORE ATHLETIC",
        headline: "Obsidian Hooded",
        subheadline: "Чорний комбінезон другого шару з капюшоном",
        editorialStory:
            "Атлетична архітектура: глибокий штормовий капюшон, що тримає об'єм під час руху, та розкльошені штанини з фіксуючим поясом високої посадки.",
        quote: "«Абсолютна монохромна чистота та впевненість кожної лінії».",
        price: "4 100 ₴",
        cta: "Спортивні силуети",
        link: "/shop/sport",
        bg: "#B8B0BB",
        ink: "#141018",
        accent: "#DDD7DF",
        frames: {
            front: {
                src: "fable-s3-obsidian-hooded",
                alt: "MIND BODY — Чорний комбінезон з капюшоном у повний зріст",
                focus: "50% 22%",
            },
        },
        badges: ["TOTAL OBSIDIAN", "SECOND SKIN", "STORM HOOD"],
    },
    {
        id: "issue-04",
        issueNumber: "Nº 04",
        issueCode: "ISSUE 04 / 04",
        season: "RUNWAY STATEMENT",
        headline: "Espresso Runway",
        subheadline: "Шоколадний кэтсьют з еко-хутром та черевиками",
        editorialStory:
            "Смілива міська стилізація: спортивна анатомія преміальної мікрофібри в поєднанні з важким силуетом еко-шуби та масивним взуттям на платформі.",
        quote: "«Зухвале переосмислення повсякденної зимової розкоші».",
        price: "8 900 ₴",
        cta: "Верхній шар та образи",
        link: "/shop/casual",
        bg: "#BEB8C0",
        ink: "#221814",
        accent: "#E5DDD8",
        frames: {
            front: {
                src: "fable-s5-espresso-runway",
                alt: "MIND BODY — Шоколадний комбінезон з шубою та черевиками у повний зріст",
                focus: "50% 22%",
            },
        },
        badges: ["ECO FUR", "COMBAT BOOTS", "WINTER RUNWAY"],
    },
];

const WIDTHS = [640, 960, 1440, 1920, 2560];

function PictureFrame({
    frame,
    eager,
    sizes = "100vw",
    className = "",
    style = {},
}: {
    frame: FrameItem;
    eager?: boolean;
    sizes?: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const baseSrc = frame.src.startsWith("/")
        ? frame.src.replace(/\.(webp|avif|jpg)$/, "")
        : `/hero/${frame.src}`;

    const webpSrcSet =
        WIDTHS.map((w) => `${baseSrc}-${w}w.webp ${w}w`).join(", ") + `, ${baseSrc}.webp 3840w`;
    const jpgSrcSet = WIDTHS.map((w) => `${baseSrc}-${w}w.jpg ${w}w`).join(", ");

    const lqip = getLqipStyle(`${baseSrc}.webp`) || getLqipStyle(baseSrc);

    return (
        <picture className={`cover-picture ${className}`}>
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
                className="cover-img"
                style={{
                    ...lqip,
                    objectPosition: frame.focus || "50% 20%",
                    ...style,
                }}
            />
        </picture>
    );
}

// Discreet Web Audio API Paper Peel Sound Synthesis
function playPaperPeelSound() {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
            ctx.resume();
        }
        // Soft white noise buffer with low-pass filter to emulate luxurious silk paper turn
        const bufferSize = ctx.sampleRate * 0.18; // 180ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(ctx.currentTime);
    } catch {
        // Audio unavailable or blocked
    }
}

export interface IssueCoverHeroProps {
    issues?: IssueData[];
    slides?: unknown[];
    autoPlay?: boolean;
    interval?: number;
    children?: ReactNode;
}

export default function IssueCoverHero({
    issues = MAGAZINE_ISSUES,
    autoPlay = false,
    interval = 8000,
}: IssueCoverHeroProps) {
    const { t } = useI18n();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPeeling, setIsPeeling] = useState(false);
    const [peelProgress, setPeelProgress] = useState(0); // 0..100
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [isPaused, setIsPaused] = useState(!autoPlay);
    const [activeViews, setActiveViews] = useState<Record<string, "front" | "back">>({
        "issue-02": "front",
    });

    const isDragging = useRef(false);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const stageRef = useRef<HTMLElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    const activeIssue = issues[currentIndex] || issues[0];
    const nextIndex = (currentIndex + 1) % issues.length;
    const nextIssue = issues[nextIndex];

    const currentView = activeViews[activeIssue.id] || "front";
    const currentFrame =
        currentView === "back" && activeIssue.frames.back
            ? activeIssue.frames.back
            : activeIssue.frames.front;

    const nextView = activeViews[nextIssue.id] || "front";
    const nextFrame =
        nextView === "back" && nextIssue.frames.back
            ? nextIssue.frames.back
            : nextIssue.frames.front;

    // Trigger paper peel acoustic feedback
    const triggerPeelSound = useCallback(() => {
        if (soundEnabled) {
            playPaperPeelSound();
        }
    }, [soundEnabled]);

    // Flip to next page with smooth animation
    const flipNext = useCallback(() => {
        if (isPeeling) return;
        setIsPeeling(true);
        triggerPeelSound();

        const startTime = performance.now();
        const duration = 650; // ms

        function animate(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease in out cubic
            const ease =
                progress < 0.5
                    ? 4 * progress * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            setPeelProgress(ease * 100);

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Complete page turn
                setCurrentIndex((i) => (i + 1) % issues.length);
                setPeelProgress(0);
                setIsPeeling(false);
            }
        }

        animationFrameRef.current = requestAnimationFrame(animate);
    }, [isPeeling, issues.length, triggerPeelSound]);

    // Jump directly to an issue
    const jumpToIssue = useCallback(
        (targetIdx: number) => {
            if (targetIdx === currentIndex || isPeeling) return;
            setIsPeeling(true);
            triggerPeelSound();

            const startTime = performance.now();
            const duration = 500;

            function animate(now: number) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease =
                    progress < 0.5
                        ? 4 * progress * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                setPeelProgress(ease * 100);

                if (progress < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    setCurrentIndex(targetIdx);
                    setPeelProgress(0);
                    setIsPeeling(false);
                }
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        },
        [currentIndex, isPeeling, triggerPeelSound],
    );

    // Toggle Front / Back on active issue
    const toggleTurn = useCallback(
        (issueId: string, view: "front" | "back") => {
            setActiveViews((prev) => ({ ...prev, [issueId]: view }));
            triggerPeelSound();
        },
        [triggerPeelSound],
    );

    // Autoplay timer
    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            flipNext();
        }, interval);
        return () => clearInterval(timer);
    }, [isPaused, interval, flipNext]);

    // Keyboard navigation
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                flipNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                jumpToIssue((currentIndex - 1 + issues.length) % issues.length);
            } else if (e.key === " " && !e.repeat) {
                e.preventDefault();
                setIsPaused((p) => !p);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [flipNext, jumpToIssue, currentIndex, issues.length]);

    // Pointer Drag on Corner / Anywhere to peel
    const handlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
        if (isPeeling) return;
        isDragging.current = true;
        dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
        if (!isDragging.current || !dragStartPos.current || !stageRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        // Drag vector: moving from bottom-right towards top-left
        const dx = dragStartPos.current.x - e.clientX;
        const dy = dragStartPos.current.y - e.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.hypot(rect.width, rect.height) * 0.45;
        const p = Math.max(0, Math.min(100, (distance / maxDist) * 100));
        setPeelProgress(p);
    };

    const handlePointerUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        dragStartPos.current = null;

        if (peelProgress > 28) {
            // Dragged enough: complete page turn
            flipNext();
        } else {
            // Snap back
            setPeelProgress(0);
        }
    };

    return (
        <section
            ref={stageRef}
            className="issue-hero"
            style={
                {
                    "--bg": activeIssue.bg,
                    "--ink": activeIssue.ink,
                    "--accent": activeIssue.accent,
                    "--next-bg": nextIssue.bg,
                    "--next-ink": nextIssue.ink,
                } as React.CSSProperties
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            aria-roledescription="carousel"
            aria-label="MIND BODY Collectors Issue Cover"
        >
            {/* ============================================================== */}
            {/* UNDERLYING NEXT ISSUE (Visible through peel fold)              */}
            {/* ============================================================== */}
            <div className="issue-underlay" aria-hidden="true">
                <div className="issue-stage" style={{ backgroundColor: nextIssue.bg }}>
                    <PictureFrame frame={nextFrame} sizes="100vw" className="issue-picture" />

                    {/* Next Issue Typography */}
                    <div className="issue-editorial-grid">
                        <div className="issue-masthead">
                            <span className="issue-masthead__logo">MIND BODY</span>
                            <span className="issue-masthead__meta">{nextIssue.season}</span>
                        </div>
                        <div className="issue-bottom-row">
                            <div className="issue-title-block">
                                <span className="issue-number-badge">{nextIssue.issueCode}</span>
                                <h2 className="issue-headline">{nextIssue.headline}</h2>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================== */}
            {/* ACTIVE CURRENT ISSUE (Top Layer with Physical Clip Peel)        */}
            {/* ============================================================== */}
            <div
                className="issue-overlay"
                style={{
                    clipPath:
                        peelProgress > 0
                            ? `polygon(0 0, 100% 0, 100% calc(100% - ${peelProgress * 1.3}%), calc(100% - ${peelProgress * 1.3}%) 100%, 0 100%)`
                            : "none",
                }}
            >
                <div className="issue-stage" style={{ backgroundColor: activeIssue.bg }}>
                    <PictureFrame
                        frame={currentFrame}
                        eager={true}
                        sizes="100vw"
                        className="issue-picture"
                    />

                    {/* Real Cyclorama Ground Reflection */}
                    <div className="issue-cyclorama-floor" aria-hidden="true" />

                    {/* High-Fashion Editorial Typography Layer */}
                    <div className="issue-editorial-grid">
                        {/* Upper Masthead: Set gracefully below site navigation */}
                        <header className="issue-masthead">
                            <div className="issue-masthead__left">
                                <span className="issue-masthead__edition">
                                    COLLECTORS EDITION · {activeIssue.issueCode}
                                </span>
                                <span className="issue-masthead__bullet" />
                                <span className="issue-masthead__season">{activeIssue.season}</span>
                            </div>

                            {/* Utility Controls: Sound & Autoplay Pause */}
                            <div className="issue-masthead__controls">
                                <button
                                    type="button"
                                    className={`issue-ctrl-btn ${soundEnabled ? "issue-ctrl-btn--active" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSoundEnabled((v) => !v);
                                    }}
                                    aria-label={
                                        soundEnabled ? t("Вимкнути звук") : t("Увімкнути звук")
                                    }
                                    title={soundEnabled ? t("Звук увімкнено") : t("Звук вимкнено")}
                                >
                                    {soundEnabled ? (
                                        <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            aria-hidden="true"
                                        >
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            aria-hidden="true"
                                        >
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                            <line x1="23" y1="9" x2="17" y2="15" />
                                            <line x1="17" y1="9" x2="23" y2="15" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`issue-ctrl-btn ${isPaused ? "issue-ctrl-btn--paused" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPaused((p) => !p);
                                    }}
                                    aria-label={
                                        isPaused ? t("Продовжити показ") : t("Призупинити показ")
                                    }
                                >
                                    {isPaused ? (
                                        <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <rect x="6" y="4" width="4" height="16" />
                                            <rect x="14" y="4" width="4" height="16" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </header>

                        {/* Midground Subtitle / Editorial Quote */}
                        <div className="issue-midground">
                            <div className="issue-badges-row">
                                {activeIssue.badges.map((b, i) => (
                                    <span key={i} className="issue-badge-pill">
                                        {b}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Bottom Row: Editorial Headline, Price, Turn & CTA */}
                        <div className="issue-bottom-row">
                            <div className="issue-title-block">
                                <div className="issue-number-badge">{activeIssue.issueNumber}</div>
                                <h1 className="issue-headline">{activeIssue.headline}</h1>
                                <p className="issue-subheadline">{activeIssue.subheadline}</p>
                                <p className="issue-desc desktop-only">
                                    {activeIssue.editorialStory}
                                </p>

                                {/* Turn Switch (Front / Back on Issue 02) */}
                                {activeIssue.frames.back && (
                                    <div
                                        className="issue-turn-switch"
                                        role="radiogroup"
                                        aria-label={t("Ракурс образу")}
                                    >
                                        <button
                                            type="button"
                                            className={`issue-turn-btn ${currentView === "front" ? "issue-turn-btn--active" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleTurn(activeIssue.id, "front");
                                            }}
                                            role="radio"
                                            aria-checked={currentView === "front"}
                                        >
                                            {t("Перед")}
                                        </button>
                                        <button
                                            type="button"
                                            className={`issue-turn-btn ${currentView === "back" ? "issue-turn-btn--active" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleTurn(activeIssue.id, "back");
                                            }}
                                            role="radio"
                                            aria-checked={currentView === "back"}
                                        >
                                            {t("Спина")}
                                        </button>
                                    </div>
                                )}

                                {/* Action CTA with Price */}
                                <div className="issue-actions">
                                    <LLink
                                        to={activeIssue.link}
                                        className="issue-cta-btn"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span>{activeIssue.cta}</span>
                                        <span className="issue-price-tag">{activeIssue.price}</span>
                                        <span className="issue-arrow">→</span>
                                    </LLink>
                                </div>
                            </div>

                            {/* Issue Selector Nav (Quick Jump 01 - 04) */}
                            <nav
                                className="issue-nav desktop-only"
                                aria-label={t("Номери колекції")}
                            >
                                {issues.map((iss, idx) => (
                                    <button
                                        key={iss.id}
                                        type="button"
                                        className={`issue-nav-item ${idx === currentIndex ? "issue-nav-item--active" : ""}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            jumpToIssue(idx);
                                        }}
                                        aria-label={`${t("Номер")} ${iss.issueNumber}: ${iss.headline}`}
                                    >
                                        <span className="issue-nav-num">{iss.issueNumber}</span>
                                        <span className="issue-nav-title">{iss.headline}</span>
                                        <span className="issue-nav-line" />
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Interactive Peel Corner (Bottom Right) */}
                    <div
                        className="issue-peel-corner"
                        onClick={(e) => {
                            e.stopPropagation();
                            flipNext();
                        }}
                        title={t("Перегорнути сторінку")}
                        role="button"
                        tabIndex={0}
                        aria-label={t("Перегорнути на наступний номер")}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                flipNext();
                            }
                        }}
                    >
                        <div className="issue-peel-curl" />
                        <span className="issue-peel-label">
                            {t("ПЕРЕГОРНУТИ")} · {nextIssue.issueNumber} →
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
