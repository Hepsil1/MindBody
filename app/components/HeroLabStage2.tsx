/**
 * HeroLabStage2 — the concepts of /hero-lab. Same hero as the live one (stage
 * photo, centre logo, single CTA); the models are the interaction: hover / tap
 * a model → her concept plays, click / second tap opens the outfit.
 *
 * Every picture state is pre-rendered with real matting by
 * scratch/build_hero_lab_v4.py; CSS only reveals it.
 *
 *   column      a column of her colour unrolls on the wall like a paper backdrop
 *               · label printed on the colour
 *   contour     a hairline draws itself round her from both feet up to the head
 *               · text set on that line, written as the line passes
 *   flash       on-camera flash (pre-flash + flash), hard shadow on the wall
 *               · label-maker strips
 *   colcontour  the column unrolls, then the outline is drawn over it
 *   colflash    the flash fires and the colour backdrop is there, shadow on it
 *   all         column unrolls → flash → outline; text on the line
 *
 * Idle: when a slide first comes into view one model plays her concept once, so
 * it is clear the models react. On touch screens the view glides from model to
 * model and each one plays in turn.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import "../styles/single-look.css";
import "../styles/hero-lab.css";
import "../styles/hero-lab2.css";

export type Lab2Mode = "column" | "contour" | "flash" | "colcontour" | "colflash" | "all";

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
    /** side with more free room: -1 left, 1 right */
    side: number;
    /** colour column: left / right edge */
    col: number[];
    colDark: boolean;
    /** lightness (Lab L) of the wall round her */
    wallL: number;
    /** outline path, viewBox 1600x900: left foot → over the head → right foot */
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

const USER_HOLD = 9000;
const SLOT = 5600;
const DEMO_MS = 3400;

const rect = (r: number[]): React.CSSProperties => ({
    left: `${r[0] * 100}%`,
    top: `${r[1] * 100}%`,
    width: `${r[2] * 100}%`,
    height: `${r[3] * 100}%`,
});
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

const lineText = (m: Lab2Model) => {
    const parts = m.sub.split(" · ").filter(Boolean);
    return parts.length ? `${m.title} — ${parts.join(" · ")}` : m.title;
};

/**
 * The line the text is set on. Type set straight on the outline breaks apart at
 * every elbow and hip, so: take the straightest stretch of the outline on her
 * free side that is long enough, smooth it into one calm curve, and move that
 * curve just outside the outline. Returns an SVG path (viewBox 1600x900).
 */
function textLine(path: string, chars: number, side: number): string {
    const n = path.match(/-?[\d.]+/g)?.map(Number) ?? [];
    const pts: number[][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    if (pts.length < 40) return path;
    const s = [0];
    const th: number[] = [];
    for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0];
        const dy = pts[i][1] - pts[i - 1][1];
        s.push(s[i - 1] + Math.hypot(dx, dy));
        th.push(Math.atan2(dy, dx));
    }
    const total = s[s.length - 1];
    const acc = [0];
    th.forEach((a, i) => {
        let d = i ? a - th[i - 1] : 0;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        acc.push(acc[acc.length - 1] + Math.abs(d));
    });
    const need = chars * 10.9 + 40;
    const [lo, hi] = side > 0 ? [0.56 * total, 0.97 * total] : [0.03 * total, 0.44 * total];
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0, j = 0; i < pts.length; i++) {
        if (s[i] < lo) continue;
        while (j < pts.length - 1 && s[j] - s[i] < need) j++;
        if (s[j] - s[i] < need || s[j] > hi) break;
        const cost = acc[j] - acc[i];
        if (cost < best - 1e-6) {
            best = cost;
            bi = i;
            bj = j;
        }
    }
    if (bi < 0) return path;
    const seg = pts.slice(bi, bj + 1);
    // the sides of a standing figure run top to bottom: smooth x along the run
    let xs = seg.map((p) => p[0]);
    const R = 14;
    for (let pass = 0; pass < 3; pass++) {
        xs = xs.map((_, i) => {
            let sum = 0;
            for (let d = -R; d <= R; d++) sum += xs[Math.min(xs.length - 1, Math.max(0, i + d))];
            return sum / (2 * R + 1);
        });
    }
    // outward = left on her left side, right on her right side
    const out = side > 0 ? 1 : -1;
    const gap = Math.max(...seg.map((p, i) => (p[0] - xs[i]) * out)) + 13;
    return (
        "M" + seg.map((p, i) => `${(xs[i] + gap * out).toFixed(1)} ${p[1].toFixed(1)}`).join(" L")
    );
}

export default function HeroLabStage2({ maskDir, models, mode, studioBg }: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const camRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const hitRef = useRef<ImageData | null>(null);
    const userAt = useRef(-Infinity);
    const demoUntil = useRef(0);
    const activeRef = useRef<number | null>(null);
    const [active, setActive] = useState<number | null>(null);
    const [view, setView] = useState(0);
    const [pulse, setPulse] = useState(0);
    const count = models.length;

    const hasColumn = mode === "column" || mode === "colcontour" || mode === "all";
    const hasContour = mode === "contour" || mode === "colcontour" || mode === "all";
    const snap =
        mode === "flash" ? "flash" : mode === "colflash" || mode === "all" ? "colflash" : "";
    const hasDymo = mode === "flash" || mode === "colflash";

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
            setView(k);
            setPulse((p) => p + 1);
        }
    };

    // idle behaviour, only while the slide is on screen
    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const touch = !matchMedia("(hover: hover)").matches;
        const demoK = count > 2 ? 1 : 0;
        let visible = false;
        let demoed = false;
        let ph = 0;
        let off = 0;
        const io = new IntersectionObserver(
            ([e]) => {
                visible = e.intersectionRatio > 0.55;
                if (visible && !touch && !demoed) {
                    demoed = true;
                    window.setTimeout(() => {
                        if (activeRef.current !== null) return;
                        if (performance.now() - userAt.current < USER_HOLD) return;
                        demoUntil.current = performance.now() + DEMO_MS;
                        activate(demoK);
                        off = window.setTimeout(() => {
                            if (demoUntil.current) activate(null);
                            demoUntil.current = 0;
                        }, DEMO_MS);
                    }, 500);
                }
            },
            { threshold: [0, 0.55, 1] },
        );
        io.observe(el);
        // touch: glide to the next model, let her play, clear, move on
        const id = touch
            ? window.setInterval(() => {
                  if (!visible) return;
                  if (performance.now() - userAt.current < USER_HOLD) return;
                  const k = Math.floor(ph / SLOT) % count;
                  const at = ph % SLOT;
                  if (at === 0) {
                      activate(null);
                      setView(k);
                  } else if (at === 800) activate(k);
                  else if (at === SLOT - 800) activate(null);
                  ph += 400;
              }, 400)
            : 0;
        return () => {
            io.disconnect();
            window.clearInterval(id);
            window.clearTimeout(off);
        };
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
        const k = modelAt(e.clientX, e.clientY);
        // don't cut the one-off demo short just because the mouse crossed the wall
        if (k === null && performance.now() < demoUntil.current) return;
        if (k !== null) demoUntil.current = 0;
        activate(k);
    };

    const onClick = (e: React.MouseEvent) => {
        userAt.current = performance.now();
        demoUntil.current = 0;
        const k = modelAt(e.clientX, e.clientY);
        const touch =
            (e.nativeEvent as PointerEvent).pointerType === "touch" ||
            !matchMedia("(hover: hover)").matches;
        if (k === null) return activate(null);
        if (touch && activeRef.current !== k) return activate(k);
        navigate(models[k].href);
    };

    const vm = models[view] ?? models[0];
    const textLines = useMemo(
        () => models.map((m) => textLine(m.path, lineText(m).length, m.side)),
        [models],
    );

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
                            if (e.pointerType !== "mouse") return;
                            demoUntil.current = 0;
                            activate(null);
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

                        {models.map((m, k) => {
                            const on = active === k;
                            const parts = m.sub.split(" · ").filter(Boolean);
                            // ink of the outline / label: white unless it sits on something light
                            const onLight = hasColumn ? !m.colDark : m.wallL > 76;
                            const style = {
                                ["--cx" as string]: pct(m.cx),
                                ["--head" as string]: pct(m.head),
                                ["--feet" as string]: pct(m.feet),
                                ["--x0" as string]: pct(m.x0),
                                ["--x1" as string]: pct(m.x1),
                                ["--c0" as string]: pct(m.col[0]),
                                ["--cw" as string]: pct(m.col[1] - m.col[0]),
                            };
                            return (
                                <div
                                    key={k}
                                    className={`hl2__m ${on ? "is-on" : ""} ${m.side > 0 ? "is-r" : "is-l"} ${onLight ? "is-ink" : ""}`}
                                    style={style}
                                >
                                    {hasColumn && (
                                        <>
                                            <img
                                                className="hl2__frm hl2__frm--column"
                                                src={`${maskDir}/column${k}.webp`}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                style={rect(m.r.column)}
                                            />
                                            {/* the roll of paper at the column's leading edge;
                                                masked so it passes behind the models */}
                                            <div
                                                className="hl2__rollbox"
                                                style={{
                                                    ["--mask" as string]: `url(${maskDir}/outall.png)`,
                                                }}
                                            >
                                                <span className="hl2__roll" />
                                            </div>
                                        </>
                                    )}

                                    {snap && (
                                        <img
                                            className="hl2__frm hl2__frm--snap"
                                            src={`${maskDir}/${snap}${k}.webp`}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            style={rect(m.r[snap])}
                                        />
                                    )}
                                    {snap && on && <span key={pulse} className="hl2__pop" />}

                                    {mode === "column" && (
                                        <div
                                            className="hl2__chip"
                                            style={{ left: pct((m.col[0] + m.col[1]) / 2) }}
                                        >
                                            <b>
                                                <span>{parts[0] ?? m.title}</span>
                                            </b>
                                            <u />
                                            <i>
                                                <span>{parts.length > 1 ? parts[1] : m.title}</span>
                                            </i>
                                        </div>
                                    )}

                                    {hasContour && (
                                        <svg
                                            className="hl2__ct"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <defs>
                                                <mask
                                                    id={`${uid}k${k}`}
                                                    maskUnits="userSpaceOnUse"
                                                    x="0"
                                                    y="0"
                                                    width="1600"
                                                    height="900"
                                                >
                                                    <path
                                                        d={m.path}
                                                        pathLength={1}
                                                        className="hl2__ct-mask"
                                                    />
                                                </mask>
                                            </defs>
                                            <path id={`${uid}t${k}`} d={textLines[k]} />
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl2__ct-line"
                                            />
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl2__ct-pen hl2__ct-pen--a"
                                            />
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl2__ct-pen hl2__ct-pen--b"
                                            />
                                            <g mask={`url(#${uid}k${k})`}>
                                                <text className="hl2__ct-text">
                                                    <textPath
                                                        href={`#${uid}t${k}`}
                                                        startOffset="12"
                                                    >
                                                        {lineText(m)}
                                                    </textPath>
                                                </text>
                                            </g>
                                        </svg>
                                    )}

                                    {hasDymo && (
                                        <div className="hl2__dymo">
                                            <b>{m.title}</b>
                                            {parts.length > 0 && <i>{parts[parts.length - 1]}</i>}
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
