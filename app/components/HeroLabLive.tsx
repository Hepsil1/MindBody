/**
 * HeroLabLive — the hero of /hero-lab. Same hero as the live one (stage photo,
 * centre logo, single CTA); the models are the interaction: hover / tap a model
 * → her effect plays, click / second tap opens the outfit.
 *
 * The slide is a LAYERED scene, split the way it is matted (see
 * scratch/build_hero_lab_v6.py):
 *     plate (studio, nobody in it) → what goes behind her → the cut-out models
 * so anything put behind a model is composited exactly like the photograph —
 * and can move. Every effect here comes from the model herself and answers the
 * pointer:
 *   contour  the outline starts where she was touched and runs round her both
 *            ways; the text is written along it; a bead rides the line with
 *            the pointer
 *   light    the pointer is the lamp: flash, then her hard shadow on the wall
 *            swings as the pointer moves
 *   gel      two shadows in the colour of her outfit fan out behind her and
 *            follow the pointer
 *   column   a paper column of her colour unrolls; her shadow falls on it and
 *            follows the pointer
 * No pointer (first view, touch, keyboard): the lamp circles slowly by itself.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import "../styles/single-look.css";
import "../styles/hero-lab.css";
import "../styles/hero-lab3.css";

export type LiveMode = "contour" | "light" | "gel" | "column";

export interface LiveModel {
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
    /** her outfit's colour, as the shadows carry it */
    hex: string;
    /** outline path, viewBox 1600x900: left foot → over the head → right foot */
    path: string;
    /** rects [x, y, w, h] (canvas fractions) of the layers */
    r: Record<"cut" | "sil" | "colbg", number[]>;
}

interface Props {
    maskDir: string;
    models: LiveModel[];
    mode: LiveMode;
    studioBg?: string;
}

const USER_HOLD = 9000;
const SLOT = 6000;
const DEMO_MS = 4200;

const rect = (r: number[]): React.CSSProperties => ({
    left: `${r[0] * 100}%`,
    top: `${r[1] * 100}%`,
    width: `${r[2] * 100}%`,
    height: `${r[3] * 100}%`,
});
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const lineText = (m: LiveModel) => {
    const parts = m.sub.split(" · ").filter(Boolean);
    return parts.length ? `${m.title} — ${parts.join(" · ")}` : m.title;
};

/** outline as points (viewBox 1600x900) + how far along the line each one is (0..1) */
function trace(path: string) {
    const n = path.match(/-?[\d.]+/g)?.map(Number) ?? [];
    const pts: number[][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    const s = [0];
    for (let i = 1; i < pts.length; i++)
        s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = s[s.length - 1] || 1;
    return { pts, s, f: s.map((v) => v / total), total };
}

/**
 * The line the text is set on. Type set straight on the outline breaks apart at
 * every elbow and hip, so: take the straightest stretch of the outline on her
 * free side that is long enough, smooth it into one calm curve, and move that
 * curve just outside the outline. Returns an SVG path (viewBox 1600x900).
 */
function textLine(tr: ReturnType<typeof trace>, chars: number, side: number): string {
    const { pts, s, total } = tr;
    if (pts.length < 40) return "";
    const acc = [0];
    let prev = 0;
    for (let i = 1; i < pts.length; i++) {
        const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
        let d = i > 1 ? a - prev : 0;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        acc.push(acc[acc.length - 1] + Math.abs(d));
        prev = a;
    }
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
    if (bi < 0) return "";
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
    const out = side > 0 ? 1 : -1;
    const gap = Math.max(...seg.map((p, i) => (p[0] - xs[i]) * out)) + 14;
    return (
        "M" + seg.map((p, i) => `${(xs[i] + gap * out).toFixed(1)} ${p[1].toFixed(1)}`).join(" L")
    );
}

export default function HeroLabLive({ maskDir, models, mode, studioBg }: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const camRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const hitRef = useRef<ImageData | null>(null);
    const mRefs = useRef<Array<HTMLDivElement | null>>([]);
    const userAt = useRef(-Infinity);
    const demoUntil = useRef(0);
    const activeRef = useRef<number | null>(null);
    /** true while the lamp is driven by a real pointer (otherwise it circles by itself) */
    const pointerLed = useRef(false);
    const lastSign = useRef<number[]>([]);
    const [active, setActive] = useState<number | null>(null);
    const [view, setView] = useState(0);
    const [pulse, setPulse] = useState(0);
    const count = models.length;

    const traces = useMemo(() => models.map((m) => trace(m.path)), [models]);
    const textLines = useMemo(
        () => models.map((m, k) => textLine(traces[k], lineText(m).length, m.side)),
        [models, traces],
    );

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

    /** pointer position as fractions of the 16:9 canvas */
    const canvasPoint = (clientX: number, clientY: number) => {
        const box = camRef.current?.getBoundingClientRect();
        if (!box) return null;
        return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height };
    };

    /** the lamp is at (px, py): where her shadow falls */
    const setLight = (k: number, px: number, py: number) => {
        const m = models[k];
        const el = mRefs.current[k];
        if (!el) return;
        const vx = m.cx - px; // the shadow falls away from the lamp
        const vy = m.head + (m.feet - m.head) * 0.4 - py;
        // never straight behind her: keep it to one side, and don't flicker across
        let sign = lastSign.current[k] ?? m.side;
        if (Math.abs(vx) > 0.006) sign = vx > 0 ? 1 : -1;
        lastSign.current[k] = sign;
        const lx = sign * Math.max(0.013, Math.min(0.056, Math.abs(vx) * 1.25));
        const ly = clamp(vy * 0.1, -0.03, 0.012);
        el.style.setProperty("--lx", lx.toFixed(4));
        el.style.setProperty("--ly", ly.toFixed(4));
        el.style.setProperty("--ls", (1.03 + Math.abs(lx) * 0.9).toFixed(4));
    };

    /** nearest point of her outline to (px, py) */
    const nearest = (k: number, px: number, py: number) => {
        const { pts, f } = traces[k];
        const x = px * 1600;
        const y = py * 900;
        let bi = 0;
        let bd = Infinity;
        for (let i = 0; i < pts.length; i++) {
            const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2;
            if (d < bd) {
                bd = d;
                bi = i;
            }
        }
        return { f: f[bi] ?? 0.5, x: pts[bi]?.[0] ?? 0, y: pts[bi]?.[1] ?? 0 };
    };

    const setBead = (k: number, px: number, py: number) => {
        const el = mRefs.current[k];
        if (!el || mode !== "contour") return;
        const n = nearest(k, px, py);
        el.style.setProperty("--bx", `${n.x.toFixed(1)}px`);
        el.style.setProperty("--by", `${n.y.toFixed(1)}px`);
    };

    const activate = (k: number | null, at?: { x: number; y: number }) => {
        if (k === activeRef.current) return;
        activeRef.current = k;
        if (k !== null) {
            const m = models[k];
            const el = mRefs.current[k];
            pointerLed.current = !!at;
            // the outline starts where she was touched (or at the top of her head)
            const start = at ? nearest(k, at.x, at.y) : nearest(k, m.cx, m.head - 0.05);
            el?.style.setProperty("--p", clamp(start.f, 0.02, 0.98).toFixed(4));
            if (at) {
                setLight(k, at.x, at.y);
                setBead(k, at.x, at.y);
            } else {
                setLight(k, m.cx - m.side * 0.03, m.head + (m.feet - m.head) * 0.3);
                setBead(k, m.cx, m.head - 0.05);
            }
            setView(k);
            setPulse((p) => p + 1);
        }
        setActive(k);
    };

    // no pointer on her: the lamp circles slowly by itself, so the shadow is alive
    useEffect(() => {
        if (active === null) return;
        const k = active;
        const m = models[k];
        const t0 = performance.now();
        const id = window.setInterval(() => {
            if (pointerLed.current) return;
            const tt = (performance.now() - t0) / 1000;
            const px = m.cx - m.side * (0.028 + 0.02 * Math.sin(tt * 1.1));
            const py = m.head + (m.feet - m.head) * (0.35 + 0.22 * Math.cos(tt * 0.8));
            setLight(k, px, py);
            const sweep = clamp(0.5 + 0.42 * Math.sin(tt * 0.7), 0.04, 0.96);
            const tr = traces[k];
            const i = Math.round(sweep * (tr.pts.length - 1));
            const el = mRefs.current[k];
            if (el && tr.pts[i] && tt > 1.6) {
                el.style.setProperty("--bx", `${tr.pts[i][0].toFixed(1)}px`);
                el.style.setProperty("--by", `${tr.pts[i][1].toFixed(1)}px`);
            }
        }, 60);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

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
                    }, 600);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const at = canvasPoint(e.clientX, e.clientY);
        // don't cut the one-off demo short just because the mouse crossed the wall
        if (k === null && performance.now() < demoUntil.current) return;
        if (k !== null) demoUntil.current = 0;
        if (k !== null && k === activeRef.current && at) {
            pointerLed.current = true;
            setLight(k, at.x, at.y);
            setBead(k, at.x, at.y);
            return;
        }
        activate(k, at ?? undefined);
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

    return (
        <section
            ref={sectionRef}
            className={`slook hlab hl3 hl3--${mode} ${active !== null ? "has-active" : ""}`}
            aria-label={t("Вітрина бренду MIND BODY")}
        >
            <div className="hlab__stage" style={{ backgroundColor: studioBg || "#dedad4" }}>
                <div className="hlab__canvas" style={{ ["--vx" as string]: vm.cx }}>
                    <div
                        ref={camRef}
                        className="hl3__cam"
                        style={{ cursor: active === null ? undefined : "pointer" }}
                        onPointerMove={onPointerMove}
                        onPointerLeave={(e) => {
                            if (e.pointerType !== "mouse") return;
                            demoUntil.current = 0;
                            activate(null);
                        }}
                        onClick={onClick}
                    >
                        {/* 1 — the studio with nobody in it */}
                        <img
                            src={`${maskDir}/plate.webp`}
                            srcSet={`${maskDir}/plate-1600.webp 1600w, ${maskDir}/plate.webp 2560w`}
                            sizes="(max-width: 768px) 300vw, 100vw"
                            alt=""
                            className="hlab__img hl3__plate"
                            decoding="async"
                        />

                        {models.map((m, k) => {
                            const on = active === k;
                            const parts = m.sub.split(" · ").filter(Boolean);
                            const onLight = mode === "column" ? !m.colDark : m.wallL > 76;
                            const sil = m.r.sil;
                            const style = {
                                ["--cx" as string]: pct(m.cx),
                                ["--head" as string]: pct(m.head),
                                ["--feet" as string]: pct(m.feet),
                                ["--x0" as string]: pct(m.x0),
                                ["--x1" as string]: pct(m.x1),
                                ["--c0" as string]: pct(m.col[0]),
                                ["--cw" as string]: pct(m.col[1] - m.col[0]),
                                ["--hex" as string]: m.hex,
                                ["--sil" as string]: `url(${maskDir}/sil${k}.webp)`,
                                // her shadow turns about her feet
                                ["--ox" as string]: pct((m.cx - sil[0]) / sil[2]),
                                ["--oy" as string]: pct((m.feet - sil[1]) / sil[3]),
                            };
                            const shadow = (cls: string) => (
                                <div className="hl3__shw">
                                    <span className={`hl3__sh ${cls}`} style={rect(sil)} />
                                </div>
                            );
                            return (
                                <div
                                    key={k}
                                    ref={(el) => {
                                        mRefs.current[k] = el;
                                    }}
                                    className={`hl3__m ${on ? "is-on" : ""} ${m.side > 0 ? "is-r" : "is-l"} ${onLight ? "is-ink" : ""}`}
                                    style={style}
                                >
                                    {/* 2 — what stands behind her */}
                                    {mode === "column" && (
                                        <>
                                            <img
                                                className="hl3__col"
                                                src={`${maskDir}/colbg${k}.webp`}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                style={rect(m.r.colbg)}
                                            />
                                            <span className="hl3__roll" />
                                        </>
                                    )}
                                    {mode === "gel" && shadow("hl3__sh--far")}
                                    {mode !== "contour" && shadow("hl3__sh--near")}

                                    {/* 3 — the model herself */}
                                    <img
                                        className="hl3__cut"
                                        src={`${maskDir}/cut${k}.webp`}
                                        alt=""
                                        decoding="async"
                                        style={rect(m.r.cut)}
                                    />

                                    {/* 4 — in front of her */}
                                    {mode === "light" && on && (
                                        <span key={pulse} className="hl3__pop" />
                                    )}

                                    {mode === "contour" && (
                                        <svg
                                            className="hl3__svg"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
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
                                                        className="hl3__tx-mask"
                                                    />
                                                </mask>
                                            </defs>
                                            {/* from the touched point: one line back, one forward */}
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl3__ln hl3__ln--a"
                                            />
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl3__ln hl3__ln--b"
                                            />
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl3__pen hl3__pen--a"
                                            />
                                            <path
                                                d={m.path}
                                                pathLength={1}
                                                className="hl3__pen hl3__pen--b"
                                            />
                                            <g className="hl3__bead">
                                                <circle r="7.5" className="hl3__bead-ring" />
                                                <circle r="2.6" className="hl3__bead-dot" />
                                            </g>
                                            <path id={`${uid}t${k}`} d={textLines[k]} />
                                            <g mask={`url(#${uid}x${k})`}>
                                                <text className="hl3__svgtext">
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

                                    {mode === "column" && (
                                        <div
                                            className="hl3__chip"
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
                                    {mode === "gel" && (
                                        <div className="hl3__serif">
                                            <b>{sentence(m.title)}</b>
                                            <i>{m.sub}</i>
                                        </div>
                                    )}
                                    {mode === "light" && (
                                        <div className="hl3__dymo">
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
