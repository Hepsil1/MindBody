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
import "../styles/runway-hero.css";

export interface TechCallout {
    x: number; // percentage from left (0..100)
    y: number; // percentage from top (0..100)
    label: string;
    sublabel?: string;
}

export interface FrameItem {
    src: string;
    alt: string;
    focus?: string;
    view?: "front" | "back";
}

export interface RunwayLook {
    id: string;
    number: string;
    tag: string;
    title: string;
    subtitle: string;
    desc: string;
    price: string;
    cta: string;
    link: string;
    bg: string;
    ink: string;
    accent: string;
    modelInfo: string;
    frames: {
        front: FrameItem;
        back?: FrameItem;
    };
    callouts?: TechCallout[];
    hasMacroLens?: boolean;
}

export const RUNWAY_LOOKS: RunwayLook[] = [
    {
        id: "look-duo",
        number: "01",
        tag: "TWO SILHOUETTES · 01 / 05",
        title: "Duality of Form",
        subtitle: "Комбінезони кльош у відтінках Rich Plum та Obsidian Black",
        desc: "Дві моделі в єдиному кадрі студійної зйомки на дзеркальній підлозі. Досконала синергія капюшона та розкльошеного силуету.",
        price: "від 3 800 ₴",
        cta: "Кльош та капюшони",
        link: "/shop/sport",
        bg: "#B2ACB5",
        ink: "#16111A",
        accent: "#E2D9E2",
        modelInfo: "Брюнетка та Блондинка · Зріст 176 см",
        frames: {
            front: {
                src: "fable-s2-duo-campaign",
                alt: "MIND BODY — Дві моделі у комбінезонах кльош з капюшоном",
                focus: "50% 25%",
            },
        },
        callouts: [
            { x: 32, y: 34, label: "Анатомічний капюшон", sublabel: "М'яка фіксація форми" },
            { x: 68, y: 64, label: "Силует Flare", sublabel: "Розкльошений баланс крою" },
            { x: 50, y: 88, label: "Дзеркальна підлога", sublabel: "Справжній студійний відблиск" },
        ],
    },
    {
        id: "look-plum",
        number: "02",
        tag: "SIGNATURE PIECE · 02 / 05",
        title: "Sculpted Open Back",
        subtitle: "Сливовий комбінезон із вишивкою-мандалою та шнуровкою",
        desc: "Магнетичний прямий погляд в очі та можливість миттєвого розвороту до скульптурної відкритої спини зі шнуровкою ручної роботи.",
        price: "3 800 ₴",
        cta: "Переглянути образ",
        link: "/shop/casual",
        bg: "#DFDADE",
        ink: "#20141E",
        accent: "#F0EBF0",
        modelInfo: "Брюнетка · Зріст 178 см · Розмір S",
        frames: {
            front: {
                src: "fable-s1-front",
                alt: "MIND BODY — Сливовий комбінезон, фронтальний погляд з мандалою",
                focus: "50% 20%",
                view: "front",
            },
            back: {
                src: "fable-s1-back-full",
                alt: "MIND BODY — Сливовий комбінезон у повний зріст, скульптурна шнуровка",
                focus: "50% 25%",
                view: "back",
            },
        },
        callouts: [
            { x: 48, y: 28, label: "Мандала MIND BODY", sublabel: "Шовкова вишивка рукава" },
            {
                x: 52,
                y: 52,
                label: "Скульптурна шнуровка",
                sublabel: "Підтримує поставу та анатомію",
            },
            { x: 49, y: 86, label: "Безшовна лінія стопи", sublabel: "Тверда опора на підлозі" },
        ],
    },
    {
        id: "look-obsidian",
        number: "03",
        tag: "CORE CAPSULE · 03 / 05",
        title: "Obsidian Hooded",
        subtitle: "Спортивний комбінезон другого шару",
        desc: "Монохромна естетика та абсолютна свобода рухів. Анатомічний капюшон, що тримає об'єм, та розкльошені штанини з фіксуючим поясом.",
        price: "4 100 ₴",
        cta: "Спортивні силуети",
        link: "/shop/sport",
        bg: "#B8B0BB",
        ink: "#141018",
        accent: "#DDD7DF",
        modelInfo: "Атлетична модель · Зріст 175 см",
        frames: {
            front: {
                src: "fable-s3-obsidian-hooded",
                alt: "MIND BODY — Чорний комбінезон з капюшоном у повний зріст",
                focus: "50% 22%",
            },
        },
        callouts: [
            { x: 50, y: 20, label: "Глибокий капюшон", sublabel: "Захист та геометрія форми" },
            { x: 48, y: 78, label: "Подовжені штанини Flare", sublabel: "Візуально витягує зріст" },
        ],
    },
    {
        id: "look-petrol",
        number: "04",
        tag: "INTERACTIVE LENS · 2.4× MACRO · 04 / 05",
        title: "Anatomy of Laces",
        subtitle: "Бірюзовий комбінезон для йоги з відкритою спиною",
        desc: "Наведіть курсор для активації оптичної лупи 2.4×: огляньте мікрофібру, лазерну точність крою та переплетення шнурів.",
        price: "3 600 ₴",
        cta: "Анатомія крою",
        link: "/shop/yoga",
        bg: "#D4D2D7",
        ink: "#121A1A",
        accent: "#E2F0F0",
        modelInfo: "Йога-інструктор · Поза лотоса",
        hasMacroLens: true,
        frames: {
            front: {
                src: "fable-s4-petrol-lacing",
                alt: "MIND BODY — Бірюзовий комбінезон для йоги з відкритою спиною",
                focus: "50% 30%",
            },
        },
        callouts: [
            { x: 46, y: 36, label: "Лазерна перфорація", sublabel: "Безшовні еластичні з'єднання" },
            { x: 56, y: 62, label: "2.4× Оптична лупа", sublabel: "Наведіть курсор для огляду" },
        ],
    },
    {
        id: "look-espresso",
        number: "05",
        tag: "EDITORIAL STATEMENT · 05 / 05",
        title: "Espresso Runway",
        subtitle: "Шоколадний кэтсьют, еко-хутро та масивні черевики",
        desc: "Сміливе поєднання спортивної анатомії з високою міською модою. Повноцінний образ для холодного сезону з важким взуттям.",
        price: "8 900 ₴",
        cta: "Верхній шар та образи",
        link: "/shop/casual",
        bg: "#BEB8C0",
        ink: "#221814",
        accent: "#E5DDD8",
        modelInfo: "Runway модель · Повний зріст у черевиках",
        frames: {
            front: {
                src: "fable-s5-espresso-runway",
                alt: "MIND BODY — Шоколадний комбінезон з шубою та черевиками",
                focus: "50% 22%",
            },
        },
        callouts: [
            { x: 50, y: 26, label: "Преміальне еко-хутро", sublabel: "Густий шовковистий ворс" },
            { x: 52, y: 84, label: "Масивне взуття", sublabel: "Повноцінний міський аутфіт" },
        ],
    },
];

const WIDTHS = [640, 960, 1440, 1920, 2560];

function PictureFrame({
    frame,
    eager,
    sizes = "(max-width: 768px) 100vw, 50vw",
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
        <picture className={`runway__picture ${className}`}>
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
                className="runway__img"
                style={{
                    ...lqip,
                    objectPosition: frame.focus || "50% 22%",
                    ...style,
                }}
            />
        </picture>
    );
}

// Discreet Luxury Web Audio API Acoustic Feedback
function playLuxurySound(type: "click" | "toggle" = "click") {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
            ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === "click") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            osc.start(now);
            osc.stop(now + 0.045);
        } else if (type === "toggle") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(360, now + 0.06);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
        }
    } catch {
        // Audio unavailable or blocked by autoplay policy
    }
}

export type RunwayDisplayMode = "lineup" | "cinematic";

export interface RunwayHeroProps {
    looks?: RunwayLook[];
    slides?: unknown[];
    autoPlay?: boolean;
    interval?: number;
    children?: ReactNode;
}

export default function RunwayHero({ looks = RUNWAY_LOOKS }: RunwayHeroProps) {
    const { t } = useI18n();

    // Active state
    const [activeIndex, setActiveIndex] = useState(0);
    const [displayMode, setDisplayMode] = useState<RunwayDisplayMode>("lineup");
    const [turnViews, setTurnViews] = useState<Record<string, "front" | "back">>({
        "look-plum": "front",
    });
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Optic Loupe state
    const [lensPos, setLensPos] = useState({ x: 50, y: 50 });
    const [lensActive, setLensActive] = useState(false);

    // Drag scrubber state for Cinematic mode
    const dragStartX = useRef<number | null>(null);
    const isDragging = useRef(false);

    // Refs
    const stageRef = useRef<HTMLDivElement>(null);
    const mobileScrollRef = useRef<HTMLDivElement>(null);

    const activeLook = looks[activeIndex] || looks[0];
    const activeView = turnViews[activeLook.id] || "front";

    // Play sound if enabled
    const triggerSound = useCallback(
        (type: "click" | "toggle" = "click") => {
            if (soundEnabled) {
                playLuxurySound(type);
            }
        },
        [soundEnabled],
    );

    // Handle Look selection
    const selectLook = useCallback(
        (idx: number) => {
            if (idx === activeIndex) return;
            setActiveIndex(idx);
            triggerSound("click");
        },
        [activeIndex, triggerSound],
    );

    // Toggle turn view (front / back)
    const toggleTurn = useCallback(
        (lookId: string, view: "front" | "back") => {
            setTurnViews((prev) => ({ ...prev, [lookId]: view }));
            triggerSound("toggle");
        },
        [triggerSound],
    );

    // Keyboard navigation
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % looks.length);
                triggerSound("click");
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + looks.length) % looks.length);
                triggerSound("click");
            } else if (e.key === " " && !e.repeat) {
                e.preventDefault();
                setIsPaused((p) => !p);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [looks.length, triggerSound]);

    // Pointer move for lens loupe
    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!stageRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setLensPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    };

    // Cinematic drag scrub handlers
    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (displayMode !== "cinematic") return;
        dragStartX.current = e.clientX;
        isDragging.current = true;
    };

    const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDragging.current || dragStartX.current === null) return;
        const deltaX = e.clientX - dragStartX.current;
        if (Math.abs(deltaX) > 60) {
            if (deltaX < 0) {
                // Drag left -> next look
                setActiveIndex((i) => (i + 1) % looks.length);
                triggerSound("click");
            } else {
                // Drag right -> prev look
                setActiveIndex((i) => (i - 1 + looks.length) % looks.length);
                triggerSound("click");
            }
        }
        isDragging.current = false;
        dragStartX.current = null;
    };

    // Mobile scroll sync
    const handleMobileScroll = () => {
        if (!mobileScrollRef.current) return;
        const el = mobileScrollRef.current;
        const scrollLeft = el.scrollLeft;
        const itemWidth = el.clientWidth;
        const newIndex = Math.round(scrollLeft / itemWidth);
        if (newIndex >= 0 && newIndex < looks.length && newIndex !== activeIndex) {
            setActiveIndex(newIndex);
        }
    };

    return (
        <section
            ref={stageRef}
            className={`runway-hero runway-hero--${displayMode}`}
            style={
                {
                    "--bg": activeLook.bg,
                    "--ink": activeLook.ink,
                    "--accent": activeLook.accent,
                    "--lx": `${lensPos.x}%`,
                    "--ly": `${lensPos.y}%`,
                } as React.CSSProperties
            }
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            aria-roledescription="carousel"
            aria-label="MIND BODY Fullscreen Runway Experience"
        >
            {/* Top Luxury Utility Bar */}
            <header className="runway-header">
                <div className="runway-header__tag">
                    <span className="runway-header__bullet" />
                    <span>MIND BODY · RUNWAY 2026/27</span>
                </div>

                <div className="runway-header__controls">
                    {/* Mode Switcher: Lineup (Шеренга) vs Cinematic (100vw На весь екран) */}
                    <div
                        className="runway-mode-switch"
                        role="radiogroup"
                        aria-label={t("Режим перегляду")}
                    >
                        <button
                            type="button"
                            className={`runway-mode-btn ${displayMode === "lineup" ? "runway-mode-btn--active" : ""}`}
                            onClick={() => {
                                setDisplayMode("lineup");
                                triggerSound("toggle");
                            }}
                            aria-checked={displayMode === "lineup"}
                            role="radio"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <rect x="3" y="3" width="4" height="18" rx="1" />
                                <rect x="10" y="3" width="4" height="18" rx="1" />
                                <rect x="17" y="3" width="4" height="18" rx="1" />
                            </svg>
                            <span>{t("Шеренга Runway")}</span>
                        </button>
                        <button
                            type="button"
                            className={`runway-mode-btn ${displayMode === "cinematic" ? "runway-mode-btn--active" : ""}`}
                            onClick={() => {
                                setDisplayMode("cinematic");
                                triggerSound("toggle");
                            }}
                            aria-checked={displayMode === "cinematic"}
                            role="radio"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                            <span>{t("На весь екран")}</span>
                        </button>
                    </div>

                    {/* Acoustic Feedback Toggle */}
                    <button
                        type="button"
                        className={`runway-sound-btn ${soundEnabled ? "runway-sound-btn--active" : ""}`}
                        onClick={() => {
                            const next = !soundEnabled;
                            setSoundEnabled(next);
                            if (next) playLuxurySound("toggle");
                        }}
                        aria-label={soundEnabled ? t("Вимкнути звук") : t("Увімкнути звук")}
                        title={soundEnabled ? t("Звук увімкнено") : t("Звук вимкнено")}
                    >
                        {soundEnabled ? (
                            <svg
                                width="14"
                                height="14"
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
                                width="14"
                                height="14"
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

                    {/* Pause Autoplay Toggle (WCAG 2.2.2) */}
                    <button
                        type="button"
                        className={`runway-pause-btn ${isPaused ? "runway-pause-btn--paused" : ""}`}
                        onClick={() => {
                            setIsPaused((p) => !p);
                            triggerSound("toggle");
                        }}
                        aria-label={isPaused ? t("Продовжити показ") : t("Призупинити показ")}
                    >
                        {isPaused ? (
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                        ) : (
                            <svg
                                width="12"
                                height="12"
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

            {/* ============================================================== */}
            {/* DESKTOP 100VW STAGE: EXPANDING RUNWAY ACCORDION & CINEMATIC    */}
            {/* ============================================================== */}
            <div className="runway-stage desktop-only">
                {looks.map((look, idx) => {
                    const isActive = idx === activeIndex;
                    const view = turnViews[look.id] || "front";
                    const frameToRender =
                        view === "back" && look.frames.back ? look.frames.back : look.frames.front;

                    return (
                        <div
                            key={look.id}
                            className={`runway-col ${isActive ? "runway-col--active" : "runway-col--idle"}`}
                            onMouseEnter={() => selectLook(idx)}
                            onClick={() => selectLook(idx)}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${look.number} · ${look.title}`}
                        >
                            {/* Visual Image Layer with Reflection Floor */}
                            <div className="runway-col__visual">
                                <PictureFrame
                                    frame={frameToRender}
                                    eager={idx === 0 || idx === 1}
                                    sizes={isActive ? "60vw" : "15vw"}
                                    className="runway-col__picture"
                                />

                                {/* 2.4× Optical Loupe (Only on Active look with Macro Lens) */}
                                {isActive && look.hasMacroLens && lensActive && (
                                    <div
                                        className="runway-lens"
                                        aria-hidden="true"
                                        style={{
                                            backgroundImage: `url(/hero/${frameToRender.src}-1920w.jpg)`,
                                            backgroundPosition: `${lensPos.x}% ${lensPos.y}%`,
                                        }}
                                    />
                                )}

                                {/* Interactive Tech Callout Pins */}
                                {isActive &&
                                    look.callouts?.map((callout, cIdx) => (
                                        <div
                                            key={cIdx}
                                            className="runway-pin"
                                            style={{
                                                left: `${callout.x}%`,
                                                top: `${callout.y}%`,
                                            }}
                                        >
                                            <span className="runway-pin__dot" />
                                            <div className="runway-pin__popover">
                                                <span className="runway-pin__title">
                                                    {callout.label}
                                                </span>
                                                {callout.sublabel && (
                                                    <span className="runway-pin__desc">
                                                        {callout.sublabel}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Column Idle Spine Label (when compressed) */}
                            <div className="runway-col__spine" aria-hidden="true">
                                <span className="runway-spine__num">{look.number}</span>
                                <span className="runway-spine__title">{look.title}</span>
                            </div>

                            {/* Column Expanded Floating Luxury Editorial Card */}
                            {isActive && (
                                <div className="runway-col__card">
                                    <div className="runway-card__tag">{look.tag}</div>
                                    <h2 className="runway-card__title">{look.title}</h2>
                                    <p className="runway-card__subtitle">{look.subtitle}</p>
                                    <p className="runway-card__desc">{look.desc}</p>

                                    {/* Interactive Segmented View Switch (Front vs Back) */}
                                    {look.frames.back && (
                                        <div
                                            className="runway-turn-switch"
                                            role="radiogroup"
                                            aria-label={t("Ракурс образу")}
                                        >
                                            <button
                                                type="button"
                                                className={`runway-turn-btn ${view === "front" ? "runway-turn-btn--active" : ""}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTurn(look.id, "front");
                                                }}
                                                role="radio"
                                                aria-checked={view === "front"}
                                            >
                                                {t("Перед")}
                                            </button>
                                            <button
                                                type="button"
                                                className={`runway-turn-btn ${view === "back" ? "runway-turn-btn--active" : ""}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTurn(look.id, "back");
                                                }}
                                                role="radio"
                                                aria-checked={view === "back"}
                                            >
                                                {t("Спина")}
                                            </button>
                                        </div>
                                    )}

                                    {/* Tactile Loupe Toggle Button */}
                                    {look.hasMacroLens && (
                                        <button
                                            type="button"
                                            className={`runway-lens-toggle ${lensActive ? "runway-lens-toggle--active" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLensActive((v) => !v);
                                                triggerSound("toggle");
                                            }}
                                        >
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                aria-hidden="true"
                                            >
                                                <circle cx="11" cy="11" r="8" />
                                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                <line x1="11" y1="8" x2="11" y2="14" />
                                                <line x1="8" y1="11" x2="14" y2="11" />
                                            </svg>
                                            <span>
                                                {lensActive
                                                    ? t("Вимкнути 2.4× лупу")
                                                    : t("2.4× Тактильна оптична лупа")}
                                            </span>
                                        </button>
                                    )}

                                    {/* Action Bar with Price & Primary Catalog CTA */}
                                    <div className="runway-card__actions">
                                        <LLink to={look.link} className="runway-card__cta">
                                            <span>{look.cta}</span>
                                            <span className="runway-card__price">{look.price}</span>
                                            <span className="runway-card__arrow">→</span>
                                        </LLink>
                                        <span className="runway-card__model">{look.modelInfo}</span>
                                    </div>
                                </div>
                            )}

                            {/* Hairline Divider between panels */}
                            <div className="runway-col__divider" aria-hidden="true" />
                        </div>
                    );
                })}
            </div>

            {/* ============================================================== */}
            {/* BOTTOM RUNWAY DOCK (Direct Quick Jump & Status)               */}
            {/* ============================================================== */}
            <nav className="runway-dock desktop-only" aria-label={t("Швидка навігація по образах")}>
                {looks.map((look, idx) => (
                    <button
                        key={look.id}
                        type="button"
                        className={`runway-dock__item ${idx === activeIndex ? "runway-dock__item--active" : ""}`}
                        onClick={() => selectLook(idx)}
                        aria-label={`${t("Образ")} ${look.number}: ${look.title}`}
                    >
                        <span className="runway-dock__number">{look.number}</span>
                        <span className="runway-dock__label">{look.title}</span>
                        <span className="runway-dock__bar" />
                    </button>
                ))}
            </nav>

            {/* ============================================================== */}
            {/* MOBILE 100SVH RUNWAY STAGE: SWIPE CAROUSEL                    */}
            {/* ============================================================== */}
            <div
                ref={mobileScrollRef}
                className="runway-mobile mobile-only"
                onScroll={handleMobileScroll}
            >
                {looks.map((look, idx) => {
                    const view = turnViews[look.id] || "front";
                    const frameToRender =
                        view === "back" && look.frames.back ? look.frames.back : look.frames.front;

                    return (
                        <div
                            key={look.id}
                            className="runway-mobile__slide"
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${look.number} · ${look.title}`}
                        >
                            <div className="runway-mobile__stage">
                                <PictureFrame
                                    frame={frameToRender}
                                    eager={idx === 0}
                                    sizes="100vw"
                                    className="runway-mobile__picture"
                                />

                                {/* Mobile Turn Segmented Switch */}
                                {look.frames.back && (
                                    <div
                                        className="runway-mobile__turn"
                                        role="radiogroup"
                                        aria-label={t("Ракурс образу")}
                                    >
                                        <button
                                            type="button"
                                            className={`runway-turn-btn ${view === "front" ? "runway-turn-btn--active" : ""}`}
                                            onClick={() => toggleTurn(look.id, "front")}
                                            role="radio"
                                            aria-checked={view === "front"}
                                        >
                                            {t("Перед")}
                                        </button>
                                        <button
                                            type="button"
                                            className={`runway-turn-btn ${view === "back" ? "runway-turn-btn--active" : ""}`}
                                            onClick={() => toggleTurn(look.id, "back")}
                                            role="radio"
                                            aria-checked={view === "back"}
                                        >
                                            {t("Спина")}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Floating Bottom Drawer */}
                            <div className="runway-mobile__drawer">
                                <div className="runway-mobile__meta">
                                    <span className="runway-mobile__tag">{look.tag}</span>
                                    <span className="runway-mobile__step">{look.number} / 05</span>
                                </div>
                                <h2 className="runway-mobile__title">{look.title}</h2>
                                <p className="runway-mobile__desc">{look.desc}</p>
                                <div className="runway-mobile__actions">
                                    <LLink to={look.link} className="runway-card__cta">
                                        <span>{look.cta}</span>
                                        <span className="runway-card__price">{look.price}</span>
                                        <span className="runway-card__arrow">→</span>
                                    </LLink>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
