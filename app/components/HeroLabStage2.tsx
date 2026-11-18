/**
 * HeroLabStage2 — the variants of /hero-lab. Same hero as the live one (stage
 * photo, centre logo, single CTA); the models are the interaction: hover / tap
 * a model → her variant plays, click / second tap opens the outfit.
 *
 * Nine variants, each a recipe (RECIPES below) of up to four parts:
 *   fill   colour of her outfit behind her (column, arch, disc, silh) —
 *          pre-rendered, revealed with a clip or a soft wipe
 *   snap   a frame that arrives with a camera flash (flash, colflash)
 *   line   a hairline drawn in SVG (contour, archline, frame)
 *   cap    how the minimal info is set — a different way in every variant
 * Every picture state is pre-rendered with real matting by
 * scratch/build_hero_lab_v5.py; CSS only reveals it.
 *
 * Idle: when a slide first comes into view one model plays her variant once.
 * On touch screens the view glides from model to model and each plays in turn.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import "../styles/single-look.css";
import "../styles/hero-lab.css";
import "../styles/hero-lab2.css";

type Fill = "column" | "arch" | "disc" | "silh";
type Snap = "flash" | "colflash";
type Line = "contour" | "archline" | "frame";
type Cap = "chip" | "serif" | "arc" | "sideserif" | "dymo" | "path" | "key" | "plate";

interface Recipe {
    fill?: Fill;
    snap?: Snap;
    line?: Line;
    cap: Cap;
    /** what the caption / line sits on: decides white or dark ink */
    ground: "fill" | "wall";
    /** seconds after the model is chosen: flash, line start, caption */
    fl?: number;
    ct?: number;
    cd?: number;
}

export const RECIPES = {
    column: { fill: "column", cap: "chip", ground: "fill", cd: 0.45 },
    arch: { fill: "arch", cap: "serif", ground: "fill", cd: 0.65 },
    disc: { fill: "disc", cap: "arc", ground: "wall", cd: 0.5 },
    silh: { fill: "silh", cap: "sideserif", ground: "wall", cd: 0.55 },
    flash: { snap: "flash", cap: "dymo", ground: "wall" },
    colflash: { snap: "colflash", cap: "chip", ground: "fill", cd: 0.32 },
    contour: { line: "contour", cap: "path", ground: "wall" },
    archline: { line: "archline", cap: "key", ground: "wall", cd: 1.05 },
    frame: { line: "frame", cap: "plate", ground: "wall", cd: 1.15 },
} satisfies Record<string, Recipe>;

export type Lab2Mode = keyof typeof RECIPES;

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
    /** the colour the fills are painted in (her outfit, lifted) */
    hex: string;
    /** top of the arch */
    apex: number;
    /** disc: cx, cy, r (r in canvas widths) */
    disc: number[];
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
const DEMO_MS = 3600;
/** the centre logo keeps this band of the slide to itself */
const LOGO = [0.395, 0.605];

const rect = (r: number[]): React.CSSProperties => ({
    left: `${r[0] * 100}%`,
    top: `${r[1] * 100}%`,
    width: `${r[2] * 100}%`,
    height: `${r[3] * 100}%`,
});
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const X = (f: number) => +(f * 1600).toFixed(1);
const Y = (f: number) => +(f * 900).toFixed(1);
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

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
    const need = chars * 11.6 + 40;
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
    const gap = Math.max(...seg.map((p, i) => (p[0] - xs[i]) * out)) + 14;
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
    const rc: Recipe = RECIPES[mode];
    const { fill, snap, line, cap } = rc;

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
    const mask = { ["--mask" as string]: `url(${maskDir}/outall.png)` };

    return (
        <section
            ref={sectionRef}
            className={`slook hlab hl2 hl2--${mode} ${active !== null ? "has-active" : ""}`}
            style={{
                ["--fl" as string]: `${rc.fl ?? 0}s`,
                ["--ct" as string]: `${rc.ct ?? 0}s`,
                ["--cd" as string]: `${rc.cd ?? 0.45}s`,
            }}
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
                            const body = m.feet - m.head;
                            const onLight = rc.ground === "fill" ? !m.colDark : m.wallL > 76;
                            // room beside her, up to the next model, the slide edge or the logo
                            const prev = models[k - 1];
                            const next = models[k + 1];
                            const roomAt = (sd: number) =>
                                sd > 0
                                    ? Math.min(next ? next.x0 : 1, m.cx < 0.5 ? LOGO[0] : 1) - m.x1
                                    : m.x0 - Math.max(prev ? prev.x1 : 0, m.cx > 0.5 ? LOGO[1] : 0);
                            // the big side caption stands on the side the silhouette does NOT take
                            const capSide = -m.side;
                            const tight = roomAt(capSide) < 0.115;
                            const style = {
                                ["--cx" as string]: pct(m.cx),
                                ["--head" as string]: pct(m.head),
                                ["--feet" as string]: pct(m.feet),
                                ["--x0" as string]: pct(m.x0),
                                ["--x1" as string]: pct(m.x1),
                                ["--c0" as string]: pct(m.col[0]),
                                ["--cw" as string]: pct(m.col[1] - m.col[0]),
                                ["--apex" as string]: pct(m.apex),
                                ["--body" as string]: body,
                                // arch radius as a length (half the column width)
                                ["--ar" as string]: `calc(var(--ch) * ${(((m.col[1] - m.col[0]) / 2) * (16 / 9)).toFixed(4)})`,
                            };
                            // geometry of the drawn lines, viewBox 1600x900
                            const colR = X(m.col[1] - m.col[0]) / 2;
                            const archY = Y(m.apex) + colR;
                            const [ax0, ax1, base] = [X(m.col[0]), X(m.col[1]), Y(m.feet)];
                            const [dcx, dcy, dr] = [X(m.disc[0]), Y(m.disc[1]), X(m.disc[2])];
                            const fr = {
                                x0: X(m.x0 - 0.024),
                                x1: X(m.x1 + 0.024),
                                y0: Y(m.head - 0.042),
                                y1: Y(m.feet + 0.012),
                            };
                            const frMid = (fr.x0 + fr.x1) / 2;
                            const G = 9; // gap between the two lines of the frame / arch

                            return (
                                <div
                                    key={k}
                                    className={`hl2__m ${on ? "is-on" : ""} ${m.side > 0 ? "is-r" : "is-l"} ${onLight ? "is-ink" : ""} ${tight ? "is-tight" : ""}`}
                                    style={style}
                                >
                                    {/* ---------- colour behind her ---------- */}
                                    {fill && (
                                        <img
                                            className={`hl2__frm hl2__frm--${fill}`}
                                            src={`${maskDir}/${fill}${k}.webp`}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            style={rect(m.r[fill])}
                                        />
                                    )}
                                    {fill === "column" && (
                                        // the roll of paper at the column's leading edge;
                                        // masked so it passes behind the models
                                        <div className="hl2__rollbox" style={mask}>
                                            <span className="hl2__roll" />
                                        </div>
                                    )}
                                    {fill === "disc" && (
                                        // a keyline in the same colour just off the disc, behind her
                                        <div className="hl2__behind" style={mask}>
                                            <svg
                                                className="hl2__svg"
                                                viewBox="0 0 1600 900"
                                                preserveAspectRatio="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    className="hl2__draw hl2__key"
                                                    pathLength={1}
                                                    style={{ stroke: m.hex }}
                                                    d={`M${dcx} ${dcy - dr - 11} A${dr + 11} ${dr + 11} 0 1 1 ${dcx - 0.1} ${dcy - dr - 11}`}
                                                />
                                            </svg>
                                        </div>
                                    )}

                                    {/* ---------- the frame the flash leaves ---------- */}
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

                                    {/* ---------- drawn lines ---------- */}
                                    {line && (
                                        <svg
                                            className="hl2__svg"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            {line === "contour" && (
                                                <>
                                                    <defs>
                                                        <mask
                                                            id={`${uid}x${k}`}
                                                            maskUnits="userSpaceOnUse"
                                                            x="0"
                                                            y="0"
                                                            width="1600"
                                                            height="900"
                                                        >
                                                            <path
                                                                d={textLines[k]}
                                                                pathLength={1}
                                                                className="hl2__tx-mask"
                                                            />
                                                        </mask>
                                                    </defs>
                                                    <path
                                                        d={m.path}
                                                        pathLength={1}
                                                        className="hl2__draw"
                                                    />
                                                    <path
                                                        d={m.path}
                                                        pathLength={1}
                                                        className="hl2__pen hl2__pen--a"
                                                    />
                                                    <path
                                                        d={m.path}
                                                        pathLength={1}
                                                        className="hl2__pen hl2__pen--b"
                                                    />
                                                    <path id={`${uid}t${k}`} d={textLines[k]} />
                                                    <g mask={`url(#${uid}x${k})`}>
                                                        <text className="hl2__svgtext">
                                                            <textPath
                                                                href={`#${uid}t${k}`}
                                                                startOffset="12"
                                                            >
                                                                {lineText(m)}
                                                            </textPath>
                                                        </text>
                                                    </g>
                                                </>
                                            )}
                                            {line === "archline" && (
                                                <>
                                                    {/* plinths first, then the arch from both feet */}
                                                    {[ax0, ax1].map((x, i) => (
                                                        <path
                                                            key={i}
                                                            className="hl2__draw1"
                                                            pathLength={1}
                                                            d={
                                                                i
                                                                    ? `M${x - G - 7} ${base} H${x + 12}`
                                                                    : `M${x + G + 7} ${base} H${x - 12}`
                                                            }
                                                        />
                                                    ))}
                                                    <path
                                                        className="hl2__draw"
                                                        pathLength={1}
                                                        style={{ ["--d" as string]: "0.18s" }}
                                                        d={`M${ax0} ${base} V${archY} A${colR} ${colR} 0 0 1 ${ax1} ${archY} V${base}`}
                                                    />
                                                    <path
                                                        className="hl2__draw hl2__draw--thin"
                                                        pathLength={1}
                                                        style={{ ["--d" as string]: "0.36s" }}
                                                        d={`M${ax0 + G} ${base} V${archY} A${colR - G} ${colR - G} 0 0 1 ${ax1 - G} ${archY} V${base}`}
                                                    />
                                                </>
                                            )}
                                            {line === "frame" && (
                                                <>
                                                    <path
                                                        className="hl2__draw"
                                                        pathLength={1}
                                                        d={`M${frMid} ${fr.y0} H${fr.x1} V${fr.y1} H${fr.x0} V${fr.y0} H${frMid}`}
                                                    />
                                                    <path
                                                        className="hl2__draw hl2__draw--thin"
                                                        pathLength={1}
                                                        style={{ ["--d" as string]: "0.2s" }}
                                                        d={`M${frMid} ${fr.y0 + G} H${fr.x1 - G} V${fr.y1 - G} H${fr.x0 + G} V${fr.y0 + G} H${frMid}`}
                                                    />
                                                    {/* mitres: the joints of a real frame */}
                                                    {[
                                                        [fr.x0, fr.y0, 1, 1],
                                                        [fr.x1, fr.y0, -1, 1],
                                                        [fr.x1, fr.y1, -1, -1],
                                                        [fr.x0, fr.y1, 1, -1],
                                                    ].map(([x, y, sx, sy], i) => (
                                                        <path
                                                            key={i}
                                                            className="hl2__draw1 hl2__draw1--thin"
                                                            pathLength={1}
                                                            style={{
                                                                ["--d" as string]: `${0.95 + i * 0.06}s`,
                                                            }}
                                                            d={`M${x} ${y} l${sx * G} ${sy * G}`}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </svg>
                                    )}

                                    {/* ---------- text on an arc over the disc ---------- */}
                                    {cap === "arc" && (
                                        <svg
                                            className="hl2__svg"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                id={`${uid}a${k}`}
                                                d={`M${dcx - dr - 24} ${dcy} A${dr + 24} ${dr + 24} 0 0 1 ${dcx + dr + 24} ${dcy}`}
                                            />
                                            <text className="hl2__svgtext hl2__svgtext--fade">
                                                <textPath
                                                    href={`#${uid}a${k}`}
                                                    startOffset="50%"
                                                    textAnchor="middle"
                                                >
                                                    {lineText(m)}
                                                </textPath>
                                            </text>
                                        </svg>
                                    )}

                                    {/* ---------- captions ---------- */}
                                    {cap === "chip" && (
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
                                    {cap === "serif" && (
                                        <div className="hl2__cap hl2__cap--serif">
                                            <b>{sentence(m.title)}</b>
                                            <i>{m.sub}</i>
                                        </div>
                                    )}
                                    {cap === "key" && (
                                        <div className="hl2__cap hl2__cap--key">
                                            <b>{m.title}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "plate" && (
                                        <div
                                            className="hl2__cap hl2__cap--plate is-side"
                                            style={{
                                                top: pct(m.feet - 0.21),
                                                ...(m.side > 0
                                                    ? { left: pct(m.x1 + 0.044) }
                                                    : { right: pct(1 - m.x0 + 0.044) }),
                                            }}
                                        >
                                            <b>{sentence(m.title)}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "sideserif" && (
                                        <div
                                            className={`hl2__cap hl2__cap--sideserif is-side ${capSide > 0 ? "" : "is-right"}`}
                                            style={{
                                                top: pct(m.head + body * 0.16),
                                                ...(capSide > 0
                                                    ? { left: pct(m.x1 + 0.03) }
                                                    : { right: pct(1 - m.x0 + 0.03) }),
                                            }}
                                        >
                                            <b>{sentence(m.title)}</b>
                                            <u />
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "dymo" && (
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
