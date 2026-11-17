/**
 * HeroLabStage2 — the variants of /hero-lab. Same hero as the live one (stage
 * photo, centre logo, single CTA); the models are the interaction: hover / tap
 * a model → her variant plays, click / second tap opens the outfit.
 *
 * A variant is a recipe (RECIPES below) put together from four kinds of parts:
 *   fill   colour of her outfit on the wall behind her, or a shadow
 *          (column, arch, disc, dado, block, stripes, slash, wall, silh,
 *          noir, evening) — pre-rendered, revealed with a clip or a fade
 *   snap   a frame that arrives with a camera flash (flash, colflash, archflash)
 *   line   a hairline drawn in SVG (contour, stitch, echo, frame, archline,
 *          ring, measure, rule, parens, pillars)
 *   cap    how the minimal info is set (chip, serif, arc, edge, corner, vert,
 *          rot, plate, dymo, path, sideserif, sidecaps, topcaps, …)
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

type Fill =
    | "column"
    | "arch"
    | "disc"
    | "dado"
    | "block"
    | "stripes"
    | "slash"
    | "wall"
    | "silh"
    | "noir"
    | "evening";
type Snap = "flash" | "colflash" | "archflash";
type Line =
    | "contour"
    | "stitch"
    | "echo"
    | "frame"
    | "archline"
    | "ring"
    | "measure"
    | "rule"
    | "parens"
    | "pillars";
type Cap =
    | "chip"
    | "serif"
    | "arc"
    | "edge"
    | "corner"
    | "vert"
    | "rot"
    | "plate"
    | "dymo"
    | "path"
    | "sideserif"
    | "sidecaps"
    | "topcaps"
    | "none";

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
    // colour on the wall
    column: { fill: "column", cap: "chip", ground: "fill", cd: 0.45 },
    arch: { fill: "arch", cap: "serif", ground: "fill", cd: 0.6 },
    disc: { fill: "disc", cap: "arc", ground: "wall", cd: 0.45 },
    dado: { fill: "dado", cap: "edge", ground: "wall", cd: 0.6 },
    block: { fill: "block", cap: "corner", ground: "fill", cd: 0.5 },
    stripes: { fill: "stripes", cap: "vert", ground: "wall", cd: 0.7 },
    slash: { fill: "slash", cap: "rot", ground: "fill", cd: 0.55 },
    wall: { fill: "wall", cap: "plate", ground: "fill", cd: 0.8 },
    silh: { fill: "silh", cap: "topcaps", ground: "wall", cd: 0.4 },
    // light
    flash: { snap: "flash", cap: "dymo", ground: "wall" },
    noir: { fill: "noir", cap: "serif", ground: "wall", cd: 0.7 },
    evening: { fill: "evening", cap: "sidecaps", ground: "wall", cd: 0.8 },
    // lines
    contour: { line: "contour", cap: "path", ground: "wall" },
    stitch: { line: "stitch", cap: "plate", ground: "wall", cd: 0.9 },
    echo: { line: "echo", cap: "sideserif", ground: "wall", cd: 0.8 },
    frame: { line: "frame", cap: "plate", ground: "wall", cd: 1 },
    archline: { line: "archline", cap: "arc", ground: "wall", cd: 0.9 },
    ring: { line: "ring", cap: "arc", ground: "wall", cd: 0.9 },
    measure: { line: "measure", cap: "none", ground: "wall" },
    rule: { line: "rule", cap: "none", ground: "wall" },
    parens: { line: "parens", cap: "topcaps", ground: "wall", cd: 0.5 },
    pillars: { line: "pillars", cap: "chip", ground: "wall", cd: 0.5 },
    // combinations
    colcontour: { fill: "column", line: "contour", cap: "path", ground: "fill", ct: 0.7 },
    colflash: { snap: "colflash", cap: "dymo", ground: "fill" },
    all: {
        fill: "column",
        snap: "colflash",
        line: "contour",
        cap: "path",
        ground: "fill",
        fl: 0.95,
        ct: 1.3,
    },
    archflash: { snap: "archflash", cap: "plate", ground: "fill", cd: 0.5 },
    disccontour: { fill: "disc", line: "contour", cap: "path", ground: "fill", ct: 0.5 },
    frameflash: { line: "frame", snap: "flash", cap: "plate", ground: "wall", fl: 1.05, cd: 1.5 },
    wallcontour: { fill: "wall", line: "contour", cap: "path", ground: "fill", ct: 0.8 },
    silhcontour: { fill: "silh", line: "contour", cap: "path", ground: "wall", ct: 0.45 },
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
    /** where the wall meets the floor */
    hz: number;
    /** top of the arch */
    apex: number;
    /** disc: cx, cy, r (r in canvas widths) */
    disc: number[];
    /** top edge of the dado */
    dado: number;
    /** block: x, y, w, h */
    block: number[];
    /** stripes: left / right edge */
    stripes: number[];
    /** slash: slope (canvas widths per canvas height), y where it crosses her, half width */
    slash: number[];
    /** outline paths, viewBox 1600x900: left foot → over the head → right foot */
    path: string;
    path2: string;
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
    const hasOutline = line === "contour" || line === "stitch" || line === "echo";
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
                            const first = parts[0] ?? "";
                            const body = m.feet - m.head;
                            const onLight = rc.ground === "fill" ? !m.colDark : m.wallL > 76;
                            // room beside her on her free side, up to the next model or
                            // the centre logo; too little → mid-height captions go above her
                            const prev = models[k - 1];
                            const next = models[k + 1];
                            const room =
                                m.side > 0
                                    ? Math.min(next ? next.x0 : 1, m.cx < 0.5 ? 0.395 : 1) - m.x1
                                    : m.x0 - Math.max(prev ? prev.x1 : 0, m.cx > 0.5 ? 0.605 : 0);
                            const tight = room < 0.115;
                            const style = {
                                ["--cx" as string]: pct(m.cx),
                                ["--head" as string]: pct(m.head),
                                ["--feet" as string]: pct(m.feet),
                                ["--x0" as string]: pct(m.x0),
                                ["--x1" as string]: pct(m.x1),
                                ["--c0" as string]: pct(m.col[0]),
                                ["--cw" as string]: pct(m.col[1] - m.col[0]),
                                ["--body" as string]: body,
                            };
                            // geometry of the drawn lines, viewBox 1600x900
                            const colR = X(m.col[1] - m.col[0]) / 2;
                            const archY = Y(m.apex) + colR;
                            const [dcx, dcy, dr] = [X(m.disc[0]), Y(m.disc[1]), X(m.disc[2])];
                            const arcOf =
                                line === "archline"
                                    ? { cx: X(m.cx), cy: archY, r: colR + 13 }
                                    : { cx: dcx, cy: dcy, r: dr + (line === "ring" ? 22 : 13) };
                            const fr = {
                                x0: X(m.x0 - 0.022),
                                x1: X(m.x1 + 0.022),
                                y0: Y(m.head - 0.04),
                                y1: Y(m.feet + 0.012),
                            };
                            const frMid = (fr.x0 + fr.x1) / 2;
                            const meaSide = tight ? -m.side : m.side;
                            const meaX = X(meaSide > 0 ? m.x1 + 0.03 : m.x0 - 0.03);
                            const meaMid = Y(m.head + body / 2);
                            const meaHalf = (lineText(m).length * 9.4 + 26) / 2;
                            // slash caption: on the band, beside her head
                            const rotY = m.head - 0.035;
                            const rotX = m.cx + m.side * m.slash[0] * (m.slash[1] - rotY);
                            const rotDeg =
                                (-m.side * Math.atan2(1, m.slash[0] * (1600 / 900)) * 180) /
                                Math.PI;
                            // captions that stand beside her, on her free side
                            const sideAt = (gap: number): React.CSSProperties =>
                                m.side > 0
                                    ? { left: pct(m.x1 + gap) }
                                    : { right: pct(1 - m.x0 + gap) };

                            return (
                                <div
                                    key={k}
                                    className={`hl2__m ${on ? "is-on" : ""} ${m.side > 0 ? "is-r" : "is-l"} ${onLight ? "is-ink" : ""} ${tight ? "is-tight" : ""}`}
                                    style={style}
                                >
                                    {/* ---------- colour / shadow behind her ---------- */}
                                    {fill &&
                                        (fill === "stripes" ? [0, 1, 2] : [0]).map((i) => (
                                            <img
                                                key={i}
                                                className={`hl2__frm hl2__frm--${fill}`}
                                                src={`${maskDir}/${fill}${k}.webp`}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                style={{
                                                    ...rect(m.r[fill]),
                                                    ["--i" as string]: i,
                                                }}
                                            />
                                        ))}
                                    {fill === "column" && (
                                        // the roll of paper at the column's leading edge;
                                        // masked so it passes behind the models
                                        <div className="hl2__rollbox" style={mask}>
                                            <span className="hl2__roll" />
                                        </div>
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

                                    {/* ---------- lines that pass behind her ---------- */}
                                    {line === "ring" && (
                                        <div className="hl2__behind" style={mask}>
                                            <svg
                                                className="hl2__svg"
                                                viewBox="0 0 1600 900"
                                                preserveAspectRatio="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    className="hl2__draw"
                                                    pathLength={1}
                                                    d={`M${dcx} ${dcy - dr} A${dr} ${dr} 0 1 1 ${dcx - 0.1} ${dcy - dr}`}
                                                />
                                                <path
                                                    className="hl2__draw hl2__draw--thin"
                                                    pathLength={1}
                                                    style={{ ["--d" as string]: "0.18s" }}
                                                    d={`M${dcx} ${dcy - dr - 9} A${dr + 9} ${dr + 9} 0 1 1 ${dcx - 0.1} ${dcy - dr - 9}`}
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {line === "rule" && (
                                        <>
                                            <div className="hl2__behind" style={mask}>
                                                <span className="hl2__rule" />
                                            </div>
                                            <div className="hl2__ruletext">
                                                <b>{m.title}</b>
                                                <i>{m.sub}</i>
                                            </div>
                                        </>
                                    )}

                                    {/* ---------- lines drawn in front ---------- */}
                                    {line && line !== "ring" && line !== "rule" && (
                                        <svg
                                            className="hl2__svg"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            {hasOutline && (
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
                                            )}
                                            {line === "contour" && (
                                                <>
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
                                                </>
                                            )}
                                            {line === "stitch" && (
                                                <g mask={`url(#${uid}k${k})`}>
                                                    <path d={m.path} className="hl2__stitch" />
                                                </g>
                                            )}
                                            {line === "echo" && (
                                                <>
                                                    <path
                                                        d={m.path}
                                                        pathLength={1}
                                                        className="hl2__draw"
                                                    />
                                                    <path
                                                        d={m.path2}
                                                        pathLength={1}
                                                        className="hl2__draw hl2__draw--thin"
                                                        style={{ ["--d" as string]: "0.28s" }}
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
                                                        d={`M${frMid} ${fr.y0 + 8} H${fr.x1 - 8} V${fr.y1 - 8} H${fr.x0 + 8} V${fr.y0 + 8} H${frMid}`}
                                                    />
                                                </>
                                            )}
                                            {line === "archline" && (
                                                <>
                                                    <path
                                                        className="hl2__draw"
                                                        pathLength={1}
                                                        d={`M${X(m.col[0])} ${Y(m.feet)} V${archY} A${colR} ${colR} 0 0 1 ${X(m.col[1])} ${archY} V${Y(m.feet)}`}
                                                    />
                                                    <path
                                                        className="hl2__draw hl2__draw--thin"
                                                        pathLength={1}
                                                        style={{ ["--d" as string]: "0.2s" }}
                                                        d={`M${X(m.col[0]) + 8} ${Y(m.feet)} V${archY} A${colR - 8} ${colR - 8} 0 0 1 ${X(m.col[1]) - 8} ${archY} V${Y(m.feet)}`}
                                                    />
                                                </>
                                            )}
                                            {line === "parens" &&
                                                [-1, 1].map((sg) => {
                                                    const px =
                                                        sg < 0 ? X(m.x0 - 0.02) : X(m.x1 + 0.02);
                                                    const y0 = Y(m.head - 0.01);
                                                    const y1 = Y(m.feet);
                                                    return [62, 74].map((bul, i) => (
                                                        <path
                                                            key={`${sg}${i}`}
                                                            className={`hl2__draw ${i ? "hl2__draw--thin" : ""}`}
                                                            pathLength={1}
                                                            style={{
                                                                ["--d" as string]: `${i * 0.12}s`,
                                                            }}
                                                            d={`M${px} ${y0} Q${px + sg * bul} ${(y0 + y1) / 2} ${px} ${y1}`}
                                                        />
                                                    ));
                                                })}
                                            {line === "pillars" &&
                                                [0, 1].map((i) => (
                                                    <path
                                                        key={i}
                                                        className="hl2__draw1"
                                                        pathLength={1}
                                                        style={{
                                                            ["--d" as string]: `${i * 0.16}s`,
                                                        }}
                                                        d={`M${X(m.col[i])} 0 V${Y(m.feet)}`}
                                                    />
                                                ))}
                                            {line === "measure" && (
                                                <>
                                                    <path
                                                        className="hl2__draw1"
                                                        pathLength={1}
                                                        d={`M${meaX - 9} ${Y(m.head)} H${meaX + 9}`}
                                                    />
                                                    <path
                                                        className="hl2__draw1"
                                                        pathLength={1}
                                                        d={`M${meaX - 9} ${Y(m.feet)} H${meaX + 9}`}
                                                    />
                                                    <path
                                                        className="hl2__draw1"
                                                        pathLength={1}
                                                        style={{ ["--d" as string]: "0.15s" }}
                                                        d={`M${meaX} ${Y(m.head)} V${meaMid - meaHalf}`}
                                                    />
                                                    <path
                                                        className="hl2__draw1"
                                                        pathLength={1}
                                                        style={{ ["--d" as string]: "0.15s" }}
                                                        d={`M${meaX} ${Y(m.feet)} V${meaMid + meaHalf}`}
                                                    />
                                                    <text
                                                        className="hl2__svgtext hl2__svgtext--fade"
                                                        x={meaX}
                                                        y={meaMid + 4}
                                                        textAnchor="middle"
                                                        transform={`rotate(-90 ${meaX} ${meaMid})`}
                                                    >
                                                        {lineText(m)}
                                                    </text>
                                                </>
                                            )}
                                            {cap === "path" && (
                                                <>
                                                    <path id={`${uid}t${k}`} d={textLines[k]} />
                                                    <g mask={`url(#${uid}k${k})`}>
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
                                        </svg>
                                    )}
                                    {/* ---------- text on an arc (disc / arch) ---------- */}
                                    {cap === "arc" && (
                                        <svg
                                            className="hl2__svg"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                id={`${uid}a${k}`}
                                                d={`M${arcOf.cx - arcOf.r} ${arcOf.cy} A${arcOf.r} ${arcOf.r} 0 0 1 ${arcOf.cx + arcOf.r} ${arcOf.cy}`}
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
                                                <span>{first || m.title}</span>
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
                                    {cap === "topcaps" && (
                                        <div className="hl2__cap hl2__cap--topcaps">
                                            <b>{m.title}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "edge" && (
                                        <div
                                            className="hl2__cap hl2__cap--edge is-side"
                                            style={{ top: pct(m.dado - 0.034), ...sideAt(0.022) }}
                                        >
                                            <b>{m.title}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "corner" && (
                                        <div
                                            className="hl2__cap hl2__cap--corner is-side"
                                            style={{
                                                bottom: pct(1 - m.block[1] - m.block[3] + 0.022),
                                                ...(m.side > 0
                                                    ? {
                                                          right: pct(
                                                              1 - m.block[0] - m.block[2] + 0.012,
                                                          ),
                                                      }
                                                    : { left: pct(m.block[0] + 0.012) }),
                                            }}
                                        >
                                            <b>{m.title}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "vert" && (
                                        <div
                                            className="hl2__cap hl2__cap--vert"
                                            style={{
                                                bottom: pct(1 - m.hz + 0.03),
                                                ...(m.side > 0
                                                    ? { left: pct(m.stripes[1] + 0.012) }
                                                    : { right: pct(1 - m.stripes[0] + 0.012) }),
                                            }}
                                        >
                                            <b>{m.title}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "rot" && (
                                        <div
                                            className="hl2__cap hl2__cap--rot"
                                            style={{
                                                left: pct(rotX),
                                                top: pct(rotY),
                                                ["--rot" as string]: `${rotDeg.toFixed(1)}deg`,
                                            }}
                                        >
                                            <b>{m.title}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "plate" && (
                                        <div
                                            className="hl2__cap hl2__cap--plate is-side"
                                            style={{
                                                top: pct(m.feet - 0.2),
                                                ...sideAt(line === "frame" ? 0.04 : 0.03),
                                            }}
                                        >
                                            <b>{sentence(m.title)}</b>
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "sideserif" && (
                                        <div
                                            className="hl2__cap hl2__cap--sideserif is-side"
                                            style={{
                                                top: pct(m.head + body * 0.2),
                                                ...sideAt(0.03),
                                            }}
                                        >
                                            <b>{sentence(m.title)}</b>
                                            <u />
                                            {m.sub && <i>{m.sub}</i>}
                                        </div>
                                    )}
                                    {cap === "sidecaps" && (
                                        <div
                                            className="hl2__cap hl2__cap--sidecaps is-side"
                                            style={{
                                                top: pct(m.head + body * 0.34),
                                                ...sideAt(0.035),
                                            }}
                                        >
                                            <u />
                                            <b>{m.title}</b>
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
