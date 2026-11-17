/**
 * HeroLabStage2 — the 12 concepts of /hero-lab/best. Same hero as the live one
 * (stage photo, centre logo, single CTA); the models are the interaction:
 * hover / tap a model → her concept plays, click / second tap opens the outfit.
 *
 * None of the earlier lab effects are reused (no glow, aura, wave, scan, beams,
 * ripples, push-in, dimming). Every picture state is pre-rendered with real
 * matting by scratch/build_hero_lab_v3.py; CSS only reveals or moves it.
 *
 *   step     she steps forward (her cut-out grows from the feet) · vertical label
 *   depth    2.5D: the models shift against the wall with the pointer · corner index
 *   mono     the studio turns black & white, she keeps her colour · serif signature
 *   focus    everything else goes out of focus · letter-by-letter caption
 *   column   a column of her colour unrolls on the wall · paint-chip label
 *   contour  a hairline draws itself round her · text set on that line
 *   finder   camera viewfinder brackets snap onto her · readout on the frame
 *   marquee  an outlined line of type runs behind the models
 *   callout  dot on the garment + leader line + note
 *   flash    on-camera flash, hard shadow on the wall · label-maker strips
 *   thread   a plumb line drops to her from above · hanging note
 *   window   window light slides onto the wall behind her · note in the light
 */
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import "../styles/single-look.css";
import "../styles/hero-lab.css";
import "../styles/hero-lab2.css";

export type Lab2Mode =
    | "step"
    | "depth"
    | "mono"
    | "focus"
    | "column"
    | "contour"
    | "finder"
    | "marquee"
    | "callout"
    | "flash"
    | "thread"
    | "window";

export interface Lab2Model {
    href: string;
    /** short outfit name, e.g. "WINGS" */
    title: string;
    /** colour · price, or a short descriptor when the slide has no product */
    sub: string;
    cx: number;
    head: number;
    feet: number;
    x0: number;
    x1: number;
    /** silhouette extent (arms included) at chest height */
    row: number[];
    /** point on the garment (torso) */
    gx: number;
    gy: number;
    /** side with more free room: -1 left, 1 right */
    side: number;
    col: number[];
    colDark: boolean;
    win: number[];
    /** outline path, viewBox 1600x900 */
    path: string;
    /** rects [x, y, w, h] (canvas fractions) of the pre-rendered layers */
    r: Record<string, number[]>;
}

interface Props {
    maskDir: string;
    models: Lab2Model[];
    mode: Lab2Mode;
    studioBg?: string;
}

const FRAME_MODES: Lab2Mode[] = ["mono", "focus", "column", "flash", "window"];
const USER_HOLD = 8000;
const SLOT = 5200;

const rect = (r: number[]): React.CSSProperties => ({
    left: `${r[0] * 100}%`,
    top: `${r[1] * 100}%`,
    width: `${r[2] * 100}%`,
    height: `${r[3] * 100}%`,
});
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default function HeroLabStage2({ maskDir, models, mode, studioBg }: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const camRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const hitRef = useRef<ImageData | null>(null);
    const userAt = useRef(-Infinity);
    const activeRef = useRef<number | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [focus, setFocus] = useState(0);
    const [view, setView] = useState(0);
    const [pulse, setPulse] = useState(0);
    const count = models.length;

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            hitRef.current = ctx.getImageData(0, 0, c.width, c.height);
        };
        img.src = `${maskDir}/hit.png`;
    }, [maskDir]);

    const activate = (k: number | null) => {
        if (k === activeRef.current) return;
        activeRef.current = k;
        setActive(k);
        if (k !== null) {
            setFocus(k);
            setView(k);
            setPulse((p) => p + 1);
        }
    };

    // phone: the view glides from model to model until the visitor takes over
    useEffect(() => {
        let ph = 0;
        const id = window.setInterval(() => {
            if (performance.now() - userAt.current < USER_HOLD) return;
            if (activeRef.current !== null) return;
            ph += 400;
            setView(Math.floor(ph / SLOT) % count);
        }, 400);
        return () => window.clearInterval(id);
    }, [count]);

    const modelAt = (clientX: number, clientY: number): number | null => {
        const box = camRef.current?.getBoundingClientRect();
        const hit = hitRef.current;
        if (!box || !hit) return null;
        const x = Math.floor(((clientX - box.left) / box.width) * hit.width);
        const y = Math.floor(((clientY - box.top) / box.height) * hit.height);
        if (x < 0 || y < 0 || x >= hit.width || y >= hit.height) return null;
        const k = Math.round(hit.data[(y * hit.width + x) * 4] / 50) - 1;
        return k >= 0 && k < count ? k : null;
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        if (mode === "depth" && sectionRef.current && camRef.current) {
            const box = sectionRef.current.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * 2 - 1;
            const py = ((e.clientY - box.top) / box.height) * 2 - 1;
            camRef.current.style.setProperty("--px", px.toFixed(3));
            camRef.current.style.setProperty("--py", py.toFixed(3));
        }
        activate(modelAt(e.clientX, e.clientY));
    };

    const onClick = (e: React.MouseEvent) => {
        userAt.current = performance.now();
        const k = modelAt(e.clientX, e.clientY);
        const touch =
            (e.nativeEvent as PointerEvent).pointerType === "touch" ||
            !matchMedia("(hover: hover)").matches;
        if (k === null) return activate(null);
        if (touch && activeRef.current !== k) return activate(k);
        navigate(models[k].href);
    };

    const fm = models[focus] ?? models[0];
    const vm = models[view] ?? models[0];
    // nearer the camera (feet lower in the frame) = moves more; equal → alternate
    const feetMin = Math.min(...models.map((m) => m.feet));
    const feetMax = Math.max(...models.map((m) => m.feet));
    const depthOf = (m: Lab2Model, k: number) =>
        feetMax - feetMin > 0.004
            ? 0.55 + (0.45 * (m.feet - feetMin)) / (feetMax - feetMin)
            : [1, 0.5, 0.8, 0.35][k % 4];

    return (
        <section
            ref={sectionRef}
            className={`slook hlab hl2 hl2--${mode} ${active !== null ? "has-active" : ""}`}
            aria-label={t("Вітрина бренду MIND BODY")}
        >
            <div className="hlab__stage" style={{ backgroundColor: studioBg || "#dedad4" }}>
                <div className="hlab__canvas" style={{ ["--vx" as string]: vm.cx }}>
                    <div
                        ref={camRef}
                        className="hl2__cam"
                        style={{ cursor: active === null ? undefined : "pointer" }}
                        onPointerMove={onPointerMove}
                        onPointerLeave={(e) => {
                            if (e.pointerType === "mouse") activate(null);
                        }}
                        onClick={onClick}
                    >
                        <img
                            src={`${maskDir}/base.webp`}
                            srcSet={`${maskDir}/base-1600.webp 1600w, ${maskDir}/base.webp 2560w`}
                            sizes="(max-width: 768px) 300vw, 100vw"
                            alt=""
                            className="hlab__img"
                            decoding="async"
                        />

                        {mode === "marquee" && (
                            <div
                                className="hl2__marq"
                                style={{
                                    ["--mask" as string]: `url(${maskDir}/outall.png)`,
                                    ["--y" as string]: pct(fm.head + (fm.feet - fm.head) * 0.47),
                                }}
                            >
                                <div className="hl2__marq-track" key={focus}>
                                    {[0, 1].map((half) => (
                                        <span key={half}>
                                            {Array.from({ length: 6 }, (_, i) => (
                                                <i key={i}>
                                                    {sentence(fm.title)}
                                                    {fm.sub
                                                        .split(" · ")
                                                        .filter(Boolean)
                                                        .map((p) => (
                                                            <u key={p}>{p}</u>
                                                        ))}
                                                </i>
                                            ))}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {models.map((m, k) => {
                            const on = active === k;
                            const parts = m.sub.split(" · ").filter(Boolean);
                            const out = m.side > 0 ? m.row[1] : m.row[0];
                            const style = {
                                ["--cx" as string]: pct(m.cx),
                                ["--head" as string]: pct(m.head),
                                ["--feet" as string]: pct(m.feet),
                                ["--x0" as string]: pct(m.x0),
                                ["--x1" as string]: pct(m.x1),
                                ["--gx" as string]: pct(m.gx),
                                ["--gy" as string]: pct(m.gy),
                                ["--d" as string]: depthOf(m, k),
                            };
                            return (
                                <div
                                    key={k}
                                    className={`hl2__m ${on ? "is-on" : ""} ${m.side > 0 ? "is-r" : "is-l"}`}
                                    style={style}
                                >
                                    {(mode === "step" || mode === "depth") && (
                                        <>
                                            <img
                                                className="hl2__erase"
                                                src={`${maskDir}/erase${k}.webp`}
                                                alt=""
                                                decoding="async"
                                                style={rect(m.r.erase)}
                                            />
                                            {mode === "step" && <span className="hl2__contact" />}
                                            <img
                                                className="hl2__cut"
                                                src={`${maskDir}/cut${k}.webp`}
                                                alt=""
                                                decoding="async"
                                                style={{
                                                    ...rect(m.r.cut),
                                                    transformOrigin: `${((m.cx - m.r.cut[0]) / m.r.cut[2]) * 100}% ${((m.feet - m.r.cut[1]) / m.r.cut[3]) * 100}%`,
                                                }}
                                            />
                                        </>
                                    )}

                                    {FRAME_MODES.includes(mode) && (
                                        <img
                                            className={`hl2__frm hl2__frm--${mode}`}
                                            src={`${maskDir}/${mode}${k}.webp`}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            style={rect(m.r[mode])}
                                        />
                                    )}
                                    {mode === "flash" && on && (
                                        <span key={pulse} className="hl2__pop" />
                                    )}

                                    {mode === "step" && (
                                        <div className="hl2__vlabel">
                                            <b>{m.title}</b>
                                            {parts.map((p) => (
                                                <i key={p}>{p}</i>
                                            ))}
                                        </div>
                                    )}

                                    {mode === "mono" && (
                                        <div className="hl2__sig">
                                            <b>{sentence(m.title)}</b>
                                            <span />
                                            <i>{m.sub}</i>
                                        </div>
                                    )}

                                    {mode === "focus" && (
                                        <div className="hl2__cap" aria-hidden="true">
                                            {`${m.title} — ${m.sub}`.split("").map((ch, i) => (
                                                <span key={i} style={{ ["--i" as string]: i }}>
                                                    {ch === " " ? " " : ch}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {mode === "column" && (
                                        <div
                                            className={`hl2__chip ${m.colDark ? "" : "is-ink"}`}
                                            style={{
                                                left: pct((m.col[0] + m.col[1]) / 2),
                                            }}
                                        >
                                            <b>{parts[0] ?? m.title}</b>
                                            <i>{parts.length > 1 ? parts[1] : m.title}</i>
                                        </div>
                                    )}

                                    {mode === "contour" && (
                                        <svg
                                            className="hl2__ct"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                id={`${uid}c${k}`}
                                                d={m.path}
                                                pathLength={1}
                                                className="hl2__ct-line"
                                            />
                                            <text className="hl2__ct-text" dy="-9">
                                                <textPath href={`#${uid}c${k}`} startOffset="3.5%">
                                                    {m.title}
                                                    {parts.length
                                                        ? `  —  ${parts.join("  ·  ")}`
                                                        : ""}
                                                </textPath>
                                            </text>
                                        </svg>
                                    )}

                                    {mode === "finder" && (
                                        <>
                                            <div className="hl2__vf">
                                                <span />
                                                <span />
                                                <span />
                                                <span />
                                                <b>{m.title}</b>
                                                <i>{parts[parts.length - 1]}</i>
                                                {parts.length > 1 && <u>{parts[0]}</u>}
                                            </div>
                                            <span className="hl2__vf-cross" />
                                        </>
                                    )}

                                    {mode === "callout" && (
                                        <>
                                            <span className="hl2__dot" />
                                            <span
                                                className="hl2__lead"
                                                style={{
                                                    left: pct(Math.min(m.gx, out + m.side * 0.03)),
                                                    width: pct(
                                                        Math.abs(out + m.side * 0.03 - m.gx),
                                                    ),
                                                }}
                                            />
                                            <div
                                                className="hl2__note"
                                                style={{ left: pct(out + m.side * 0.03) }}
                                            >
                                                <b>{sentence(m.title)}</b>
                                                {parts.map((p) => (
                                                    <i key={p}>{p}</i>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {mode === "flash" && (
                                        <div className="hl2__dymo">
                                            <b>{m.title}</b>
                                            {parts.length > 0 && <i>{parts[parts.length - 1]}</i>}
                                        </div>
                                    )}

                                    {mode === "thread" && (
                                        <>
                                            <span className="hl2__thread" />
                                            <div className="hl2__hang">
                                                <b>{sentence(m.title)}</b>
                                                <i>{m.sub}</i>
                                            </div>
                                        </>
                                    )}

                                    {mode === "window" && (
                                        <div
                                            className="hl2__pane"
                                            style={{ left: pct(m.win[0]), top: pct(m.win[1]) }}
                                        >
                                            <b>{sentence(m.title)}</b>
                                            {parts.map((p) => (
                                                <i key={p}>{p}</i>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* a11y: the models are links for keyboard / screen readers too */}
            <nav className="hlab__sr">
                {models.map((m, k) => (
                    <LLink
                        key={k}
                        to={m.href}
                        onFocus={() => activate(k)}
                        onBlur={() => activate(null)}
                    >
                        {m.title} · {m.sub}
                    </LLink>
                ))}
            </nav>

            <div className="slook__center-brand" aria-hidden="true">
                <picture>
                    <source srcSet="/pics/mind_body_logo_white.webp" type="image/webp" />
                    <img
                        src="/pics/mind_body_logo_white.png"
                        alt=""
                        className="slook__center-logo"
                        width="280"
                        height="212"
                        decoding="async"
                    />
                </picture>
            </div>

            {mode === "depth" && (
                <div className="hl2__index" aria-hidden="true">
                    <div className="hl2__index-n">
                        <span style={{ transform: `translateY(${-focus}em)` }}>
                            {models.map((_, k) => (
                                <em key={k}>{String(k + 1).padStart(2, "0")}</em>
                            ))}
                        </span>
                        <small>/ {String(count).padStart(2, "0")}</small>
                    </div>
                    <div className="hl2__index-t" key={focus}>
                        <b>{fm.title}</b>
                        <i>{fm.sub}</i>
                    </div>
                </div>
            )}

            <div className="slook__overlay">
                <div className="slook__info slook__info--centered">
                    <LLink to="/shop/yoga" className="slook__cta-btn slook__cta-btn--centered">
                        {t("Переглянути колекцію")}
                    </LLink>
                </div>
            </div>
        </section>
    );
}
