/**
 * HeroLabLive — the hero of /hero-lab. Same hero as the live one (stage photo,
 * centre logo, single CTA); the models are the interaction: hover / tap a model
 * → her effect plays, click / second tap opens the outfit.
 *
 * The slide is a LAYERED scene, split the way it is matted (see
 * scratch/build_hero_lab_v6.py):
 *     plate (studio, nobody in it) → what goes behind her → the cut-out models
 * so anything put behind a model is composited exactly like the photograph and
 * can move. Every effect comes from the model herself.
 *
 * On her outfit (scratch/build_hero_lab_v7_fabric.py: fab<k> = the garment
 * alone, lit like under a brighter lamp; skin, hair and face never change):
 *   sheen     a band of light glides across the fabric, like satin under a lamp
 *   touch     the light spreads over the fabric from where she was touched
 *   scan      a line of light runs down her and switches the fabric on
 * Round her:
 *   contour   a hairline starts where she was touched and runs round her both
 *             ways; text written beside it; a bead rides it with the pointer
 *   shadow    her shadow comes out from behind her onto the wall and stays
 *   arch      an arch drawn behind her in two lines; the name set on its curve
 *   measure   a tailor's height rule beside her, ticks counted off top to bottom
 *   loop      her name runs round her, along a line just off her body
 * Five more, each from a different world:
 *   focus     a camera racks focus onto her: the studio and the others go soft,
 *             she alone stays sharp
 *   sun       the brand's sun rises behind her head and shoulders, in her
 *             colour, and turns very slowly
 *   closer    she takes a step towards the camera; the others step back a little
 *   tag       the brand's swing tag, tied to her at the shoulder, drops on its
 *             string and swings to rest (name, colour, price)
 *   softbox   a studio softbox comes on at her free side: soft white key
 *             light on her, the backdrop behind her lifts
 * Where an outfit can't be told from her (a busy print, brown hair on a brown
 * suit: `fab: false`) the outfit effects fall back to the contour.
 *
 * Nothing is placed above her head: on most screens that is where the site
 * header is (and on wide short screens the picture is cropped there). Captions
 * run down her free side; lines that reach the header fade out under it.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LLink, useI18n } from "../i18n";
import "../styles/single-look.css";
import "../styles/hero-lab.css";
import "../styles/hero-lab3.css";

export type LiveMode =
    | "sheen"
    | "touch"
    | "scan"
    | "contour"
    | "shadow"
    | "arch"
    | "measure"
    | "loop"
    | "focus"
    | "sun"
    | "closer"
    | "tag"
    | "softbox";

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
    /** half-width band round her (used for the arch) */
    col: number[];
    /** lightness (Lab L) of the wall round her */
    wallL: number;
    /** her outfit's colour, and a lighter second tone */
    hex: string;
    hex2: string;
    /** the colour her shadow takes on this wall */
    ground: string;
    /** outline path, viewBox 1600x900: left foot → over the head → right foot */
    path: string;
    /** outlines further and further out: [~14, ~30, ~50, ~74 px] */
    paths: string[];
    /** rects [x, y, w, h] (canvas fractions) of the layers */
    r: Record<"cut" | "sil", number[]>;
    /** false: her outfit could not be separated well - no fabric effects */
    fab?: boolean;
    /** a black / navy / dark outfit */
    gdark?: boolean;
    /** the widest row of fabric across her torso: [x left, x right, y] */
    band?: number[] | null;
}

interface Props {
    maskDir: string;
    models: LiveModel[];
    mode: LiveMode;
    studioBg?: string;
}

const USER_HOLD = 9000;
const SLOT = 6400;
const DEMO_MS = 4400;
/** the centre logo keeps this band of the slide to itself */
const LOGO = [0.395, 0.605];

/** which light plays on her outfit in each effect */
const FAB_KIND: Partial<Record<LiveMode, "sheen" | "touch" | "scan">> = {
    sheen: "sheen",
    touch: "touch",
    scan: "scan",
};
/** effects that are only the outfit light (they fall back to the contour) */
const FAB_ONLY: LiveMode[] = ["sheen", "touch", "scan"];
const SIDE_CAPTION: LiveMode[] = [
    "shadow",
    "sheen",
    "touch",
    "scan",
    "focus",
    "sun",
    "closer",
    "softbox",
];
/** letters of the line text: width of one, in em */
const EM = 0.93;

interface Geo {
    /** screen px per unit of the 1600x900 viewBox */
    u: number;
    /** canvas fraction where the free picture starts (under the site header) */
    top: number;
    /** visible part of the canvas, left and right */
    vx0: number;
    vx1: number;
    /** phone: the picture pans to the chosen model; half the screen, in canvas widths */
    half: number;
    narrow: boolean;
}

const rect = (r: number[]): React.CSSProperties => ({
    left: `${r[0] * 100}%`,
    top: `${r[1] * 100}%`,
    width: `${r[2] * 100}%`,
    height: `${r[3] * 100}%`,
});
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const X = (f: number) => +(f * 1600).toFixed(1);
const Y = (f: number) => +(f * 900).toFixed(1);

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
function textLine(
    tr: ReturnType<typeof trace>,
    m: LiveModel,
    chars: number,
    side: number,
    fs: number,
    extra: number,
    top: number,
): string {
    const { pts, s, total } = tr;
    const need = chars * fs * EM + 40;
    // no calm stretch long enough: a straight line beside her
    const straight = () => {
        const x = side > 0 ? X(m.x1) + 20 + extra : X(m.x0) - 20 - extra;
        const y0 = Math.max(Y(m.head + (m.feet - m.head) * 0.16), top * 900 + 10);
        return side > 0 ? `M${x} ${y0} V${y0 + need}` : `M${x} ${y0 + need} V${y0}`;
    };
    if (pts.length < 40) return straight();
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
    const [lo, hi] = side > 0 ? [0.56 * total, 0.97 * total] : [0.03 * total, 0.44 * total];
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0, j = 0; i < pts.length; i++) {
        if (s[i] < lo) continue;
        while (j < pts.length - 1 && s[j] - s[i] < need) j++;
        if (s[j] - s[i] < need || s[j] > hi) break;
        // not under the site header
        if (Math.min(pts[i][1], pts[j][1]) < top * 900 + 6) continue;
        const cost = acc[j] - acc[i];
        if (cost < best - 1e-6) {
            best = cost;
            bi = i;
            bj = j;
        }
    }
    if (bi < 0) return straight();
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
    const gap = Math.max(...seg.map((p, i) => (p[0] - xs[i]) * out)) + 14 + extra;
    return (
        "M" + seg.map((p, i) => `${(xs[i] + gap * out).toFixed(1)} ${p[1].toFixed(1)}`).join(" L")
    );
}

/** a line drawn from the point --p both ways (two strokes on one path) */
function Both({ d, cls = "", style }: { d: string; cls?: string; style?: React.CSSProperties }) {
    return (
        <>
            <path d={d} pathLength={1} className={`hl3__ln hl3__ln--a ${cls}`} style={style} />
            <path d={d} pathLength={1} className={`hl3__ln hl3__ln--b ${cls}`} style={style} />
        </>
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
    const loopRefs = useRef<Array<SVGTextPathElement | null>>([]);
    const userAt = useRef(-Infinity);
    const demoUntil = useRef(0);
    const activeRef = useRef<number | null>(null);
    /** true while the bead is driven by a real pointer (otherwise it travels by itself) */
    const pointerLed = useRef(false);
    const [active, setActive] = useState<number | null>(null);
    const [view, setView] = useState(0);
    const [geo, setGeo] = useState<Geo>({
        u: 1,
        top: 0,
        vx0: 0,
        vx1: 1,
        half: 0.14,
        narrow: false,
    });
    const count = models.length;

    // what of the picture is actually on screen, and how big a unit is
    useEffect(() => {
        const measure = () => {
            const cam = camRef.current?.getBoundingClientRect();
            const sec = sectionRef.current?.getBoundingClientRect();
            if (!cam || !sec || !cam.width) return;
            const hdr = document.querySelector("header.header")?.getBoundingClientRect();
            const band = hdr ? clamp(hdr.bottom - 14 - sec.top, 0, 140) : 0;
            const narrow = sec.width <= 768;
            const r3 = (v: number) => Math.round(v * 1000) / 1000;
            const next: Geo = {
                u: r3(cam.width / 1600),
                top: r3((sec.top - cam.top + band) / cam.height),
                vx0: narrow ? 0 : r3((sec.left - cam.left) / cam.width),
                vx1: narrow ? 1 : r3((sec.right - cam.left) / cam.width),
                half: r3(sec.width / 2 / cam.width),
                narrow,
            };
            setGeo((g) => (JSON.stringify(g) === JSON.stringify(next) ? g : next));
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (sectionRef.current) ro.observe(sectionRef.current);
        window.addEventListener("resize", measure);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

    /** type never gets smaller than ~11 px on screen */
    const fs = Math.max(12.5, +(11 / geo.u).toFixed(2));

    /** the side of each model with room for type: her free side, unless it is cramped */
    const sides = useMemo(
        () =>
            models.map((m, k) => {
                const prev = models[k - 1];
                const next = models[k + 1];
                // the chat buttons live in the right corner of a desktop screen
                const vr = geo.narrow ? m.cx + geo.half - 0.01 : geo.vx1 - 0.05;
                const vl = geo.narrow ? m.cx - geo.half + 0.01 : geo.vx0 + 0.01;
                const logoR = !geo.narrow && m.cx < 0.5 ? LOGO[0] : 1;
                const logoL = !geo.narrow && m.cx > 0.5 ? LOGO[1] : 0;
                const room = (sd: number) =>
                    sd > 0
                        ? Math.min(next ? next.x0 : 1, logoR, vr) - m.x1
                        : m.x0 - Math.max(prev ? prev.x1 : 0, logoL, vl);
                const a = room(m.side);
                return a >= 0.07 || a >= room(-m.side) ? m.side : -m.side;
            }),
        [models, geo],
    );
    /** how far the free wall reaches left and right of each model (canvas fractions) */
    const rooms = useMemo(
        () =>
            models.map((m, k) => {
                const prev = models[k - 1];
                const next = models[k + 1];
                const vr = geo.narrow ? m.cx + geo.half - 0.01 : geo.vx1 - 0.05;
                const vl = geo.narrow ? m.cx - geo.half + 0.01 : geo.vx0 + 0.01;
                const logoR = !geo.narrow && m.cx < 0.5 ? LOGO[0] : 1;
                const logoL = !geo.narrow && m.cx > 0.5 ? LOGO[1] : 0;
                return [
                    Math.max(prev ? prev.x1 + 0.008 : 0, logoL, vl),
                    Math.min(next ? next.x0 - 0.008 : 1, logoR, vr),
                ];
            }),
        [models, geo],
    );
    const sidesRef = useRef(sides);
    useEffect(() => {
        sidesRef.current = sides;
    }, [sides]);

    const traces = useMemo(() => models.map((m) => trace(m.path)), [models]);
    const textLines = useMemo(
        () =>
            models.map((m, k) =>
                textLine(traces[k], m, lineText(m).length, sides[k], fs, 0, geo.top),
            ),
        [models, traces, sides, fs, geo.top],
    );
    const loopText = useMemo(
        () =>
            models.map((m) => {
                const unit = `${lineText(m)}   ·   `;
                const len = trace(m.paths?.[1] ?? m.path).total;
                return unit.repeat(Math.ceil(len / (unit.length * 10)) + 2);
            }),
        [models],
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
        if (!el) return;
        const n = nearest(k, px, py);
        el.style.setProperty("--bx", `${n.x.toFixed(1)}px`);
        el.style.setProperty("--by", `${n.y.toFixed(1)}px`);
    };

    const activate = (k: number | null, at?: { x: number; y: number }, led = false) => {
        if (k === activeRef.current) return;
        activeRef.current = k;
        if (k !== null) {
            const m = models[k];
            const el = mRefs.current[k];
            pointerLed.current = led && !!at;
            // lines start where she was touched (or at the top of her head)
            const start = at ? nearest(k, at.x, at.y) : nearest(k, m.cx, m.head - 0.05);
            el?.style.setProperty("--p", clamp(start.f, 0.02, 0.98).toFixed(4));
            // the light on her outfit spreads from the touch (or from her waist)
            const [cx0, cy0, cw, ch] = m.r.cut;
            const tx = at ? at.x : m.band ? (m.band[0] + m.band[1]) / 2 : m.cx;
            const ty = at ? at.y : m.band ? m.band[2] : m.head + (m.feet - m.head) * 0.4;
            el?.style.setProperty("--tx", pct((tx - cx0) / cw));
            el?.style.setProperty("--ty", pct((ty - cy0) / ch));
            if (at) setBead(k, at.x, at.y);
            else setBead(k, m.cx, m.head - 0.05);
            setView(k);
        }
        setActive(k);
    };

    // contour: with no pointer on her, the bead travels her outline by itself
    useEffect(() => {
        if (active === null || mode !== "contour") return;
        const k = active;
        const el = mRefs.current[k];
        const tr = traces[k];
        const t0 = performance.now();
        const id = window.setInterval(() => {
            if (pointerLed.current) return;
            const tt = (performance.now() - t0) / 1000;
            const i = Math.round(
                clamp(0.5 + 0.42 * Math.sin(tt * 0.7), 0.04, 0.96) * (tr.pts.length - 1),
            );
            if (el && tr.pts[i] && tt > 1.6) {
                el.style.setProperty("--bx", `${tr.pts[i][0].toFixed(1)}px`);
                el.style.setProperty("--by", `${tr.pts[i][1].toFixed(1)}px`);
            }
        }, 60);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, mode]);

    // loop: her name keeps running round her while she is chosen. One clock for
    // every model: the chosen one eases up to cruise, the one let go slows to a
    // stop while its line is drawn back (it used to freeze mid-retreat)
    useEffect(() => {
        if (mode !== "loop") return;
        const SPEED = 34;
        const off = models.map(() => 0);
        const vel = models.map(() => 0);
        let unit: number[] = [];
        const unitOf = (k: number) => {
            if (unit[k]) return unit[k];
            const tp = loopRefs.current[k];
            const txt = tp?.parentElement as unknown as SVGTextElement | null;
            if (!txt) return 0;
            const copies = Math.max(1, loopText[k].split("   ·   ").length - 1);
            const u = txt.getComputedTextLength() / copies;
            if (u > 0) unit[k] = u;
            return u;
        };
        // the web font changes the width of a copy: measure again once it is in
        void document.fonts?.ready.then(() => {
            unit = [];
        });
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            for (let k = 0; k < models.length; k++) {
                const goal = activeRef.current === k ? SPEED : 0;
                // about half a second to reach cruise or to come to rest
                vel[k] += (goal - vel[k]) * Math.min(1, dt * 4);
                if (goal === 0 && vel[k] < 0.05) continue;
                const u = unitOf(k);
                const tp = loopRefs.current[k];
                if (!u || !tp) continue;
                off[k] = (off[k] - vel[k] * dt) % u;
                tp.setAttribute("startOffset", off[k].toFixed(1));
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [mode, models, loopText, fs]);

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
            setBead(k, at.x, at.y);
            return;
        }
        activate(k, at ?? undefined, true);
    };

    const onClick = (e: React.MouseEvent) => {
        userAt.current = performance.now();
        demoUntil.current = 0;
        const k = modelAt(e.clientX, e.clientY);
        const touch =
            (e.nativeEvent as PointerEvent).pointerType === "touch" ||
            !matchMedia("(hover: hover)").matches;
        if (k === null) return activate(null);
        if (touch && activeRef.current !== k)
            return activate(k, canvasPoint(e.clientX, e.clientY) ?? undefined);
        navigate(models[k].href);
    };

    const vm = models[view] ?? models[0];

    return (
        <section
            ref={sectionRef}
            className={`slook hlab hl3 hl3--${mode} ${active !== null ? "has-active" : ""}`}
            style={{ ["--fs" as string]: `${fs}px` }}
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
                            const onLight = m.wallL > 76;
                            const body = m.feet - m.head;
                            const sil = m.r.sil;
                            const paths = m.paths ?? [m.path];
                            /** the side with room for type */
                            const rs = sides[k];
                            /** where the free picture starts, in viewBox units */
                            const T = geo.top * 900;
                            /** her outfit can carry an effect; otherwise fall back to the contour */
                            const kind = m.fab !== false ? FAB_KIND[mode] : undefined;
                            const fabric = !!kind;
                            const lines =
                                mode === "contour" || (FAB_ONLY.includes(mode) && !fabric);
                            const fabSrc = `${maskDir}/fab${k}.webp`;
                            const cutR = m.r.cut;
                            const style = {
                                ["--cx" as string]: pct(m.cx),
                                ["--head" as string]: pct(m.head),
                                ["--feet" as string]: pct(m.feet),
                                ["--bh" as string]: pct(body),
                                ["--x0" as string]: pct(m.x0),
                                ["--x1" as string]: pct(m.x1),
                                ["--hex" as string]: m.hex,
                                ["--hex2" as string]: m.hex2,
                                ["--ground" as string]: m.ground,
                                ["--sil" as string]: `url(${maskDir}/sil${k}.webp)`,
                                ["--fab" as string]: `url(${fabSrc})`,
                                // her shadow is on the wall: it thins out towards the floor
                                ["--f0" as string]: pct((m.feet - 0.17 - sil[1]) / sil[3]),
                                ["--f1" as string]: pct((m.feet - 0.06 - sil[1]) / sil[3]),
                            };

                            const [roomL, roomR] = rooms[k];
                            /** free wall to the nearer side of her centre (canvas width) */
                            const halfRoom = Math.min(m.cx - roomL, roomR - m.cx);

                            // sun: the brand's sun rises behind her head and shoulders.
                            // Sized in canvas height; the canvas is 16:9.
                            const sunH = Math.min(body * 0.36, ((halfRoom * 2 * 16) / 9) * 0.98);
                            const sunW = (sunH * 9) / 16;
                            const sunY = Math.max(
                                m.head + body * 0.15,
                                geo.top + sunH * 0.5 + 0.01,
                            );

                            // hang tag: tied to her at the shoulder, hanging on the side
                            // with more room, as wide as that room allows
                            const tR = roomR - m.x1;
                            const tL = m.x0 - roomL;
                            const tSide = tR >= tL ? 1 : -1;
                            const tagW = clamp(Math.max(tR, tL) - 0.03, 0.045, 0.082);
                            const tAt = nearest(k, tSide > 0 ? m.x1 : m.x0, m.head + body * 0.19);
                            const tAx = tAt.x / 1600 - tSide * 0.002;
                            const tAy = tAt.y / 900;
                            const tEdge = tSide > 0 ? m.x1 + 0.012 + tagW : m.x0 - 0.012 - tagW;
                            const tBoxW = Math.abs(tEdge - tAx);
                            const tHole = (tagW / 2 / tBoxW) * 100;
                            const tHoleX = tSide > 0 ? 100 - tHole : tHole;
                            const tKnot = tSide > 0 ? 0 : 100;

                            // the arch: centred on her, a little wider than her, and
                            // never taller than the free picture
                            const ar = Math.max(X(m.col[1] - m.col[0]) / 2, 96);
                            const acx = X(m.cx);
                            const apex = Y(
                                clamp(
                                    Math.max(m.head - 0.075, geo.top + 0.02),
                                    0,
                                    m.head + body * 0.12,
                                ),
                            );
                            const archY = apex + ar;
                            const base = Y(m.feet);
                            const archD = (o: number) =>
                                `M${acx - ar + o} ${base} V${archY} A${ar - o} ${ar - o} 0 0 1 ${acx + ar - o} ${archY} V${base}`;
                            // the name is set on the outside of the arch, down her free side
                            const aR = ar + 12;
                            const aQuarter = (Math.PI * aR) / 2;
                            const aTotal = aQuarter + (base - archY);
                            const aStart = Math.max(aQuarter * 0.42, 64);
                            const archText =
                                rs > 0
                                    ? `M${acx} ${apex - 12} A${aR} ${aR} 0 0 1 ${acx + aR} ${archY} V${base}`
                                    : `M${acx - aR} ${base} V${archY} A${aR} ${aR} 0 0 1 ${acx} ${apex - 12}`;

                            // the rule: on the side with room
                            const rx = X(rs > 0 ? m.x1 + 0.028 : m.x0 - 0.028);
                            const ry0 = Y(m.head);
                            const ry1 = Y(m.feet);
                            const rmid = (Math.max(ry0, T) + ry1) / 2;
                            const rhalf = (lineText(m).length * fs * EM + 30) / 2;
                            const ticks = Array.from({ length: 41 }, (_, i) => {
                                const y = ry0 + ((ry1 - ry0) * i) / 40;
                                if (Math.abs(y - rmid) < rhalf + 4) return "";
                                const len = i % 5 === 0 ? 11 : 5;
                                return `M${rx} ${y.toFixed(1)} h${rs * len}`;
                            }).join(" ");

                            // lines that reach the site header fade out under it
                            const fade = (
                                <>
                                    <linearGradient
                                        id={`${uid}fg${k}`}
                                        gradientUnits="userSpaceOnUse"
                                        x1="0"
                                        y1={T - 22}
                                        x2="0"
                                        y2={T + 8}
                                    >
                                        <stop offset="0" stopColor="#000" />
                                        <stop offset="1" stopColor="#fff" />
                                    </linearGradient>
                                    <mask
                                        id={`${uid}f${k}`}
                                        maskUnits="userSpaceOnUse"
                                        x="-200"
                                        y="-300"
                                        width="2000"
                                        height="1500"
                                    >
                                        <rect
                                            x="-200"
                                            y="-300"
                                            width="2000"
                                            height="1500"
                                            fill={`url(#${uid}fg${k})`}
                                        />
                                    </mask>
                                    {/* the running line also dissolves into the floor */}
                                    <linearGradient
                                        id={`${uid}bg${k}`}
                                        gradientUnits="userSpaceOnUse"
                                        x1="0"
                                        y1={base - 46}
                                        x2="0"
                                        y2={base - 8}
                                    >
                                        <stop offset="0" stopColor="#fff" />
                                        <stop offset="1" stopColor="#000" />
                                    </linearGradient>
                                    <mask
                                        id={`${uid}b${k}`}
                                        maskUnits="userSpaceOnUse"
                                        x="-200"
                                        y="-300"
                                        width="2000"
                                        height="1500"
                                    >
                                        <rect
                                            x="-200"
                                            y="-300"
                                            width="2000"
                                            height="1500"
                                            fill={`url(#${uid}bg${k})`}
                                        />
                                    </mask>
                                </>
                            );
                            const faded = `url(#${uid}f${k})`;

                            return (
                                <div
                                    key={k}
                                    ref={(el) => {
                                        mRefs.current[k] = el;
                                    }}
                                    className={`hl3__m ${on ? "is-on" : ""} ${rs > 0 ? "is-r" : "is-l"} ${onLight ? "is-ink" : ""} ${fabric ? "has-fab" : ""}`}
                                    style={style}
                                >
                                    {/* 2 — behind her: her shadow comes out onto the wall */}
                                    {mode === "shadow" && (
                                        <div
                                            className="hl3__shw"
                                            style={{ ["--sd" as string]: rs }}
                                        >
                                            <div className="hl3__shb">
                                                <span className="hl3__sh" style={rect(sil)} />
                                            </div>
                                        </div>
                                    )}
                                    {mode === "arch" && (
                                        <svg
                                            className="hl3__svg hl3__svg--back"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d={archD(0)}
                                                pathLength={1}
                                                className="hl3__draw"
                                            />
                                            <path
                                                d={archD(9)}
                                                pathLength={1}
                                                className="hl3__draw hl3__draw--thin"
                                            />
                                            {[-1, 1].map((sd) => (
                                                <path
                                                    key={sd}
                                                    className="hl3__draw1"
                                                    pathLength={1}
                                                    d={`M${acx + sd * (ar - 18)} ${base} H${acx + sd * (ar + 12)}`}
                                                />
                                            ))}
                                            <path
                                                className="hl3__draw1 hl3__key"
                                                pathLength={1}
                                                d={`M${acx} ${apex - 7} V${apex + 11}`}
                                            />
                                            <path id={`${uid}a${k}`} d={archText} />
                                            <text className="hl3__svgtext hl3__arctext">
                                                <textPath
                                                    href={`#${uid}a${k}`}
                                                    startOffset={rs > 0 ? aStart : aTotal - aStart}
                                                    textAnchor={rs > 0 ? "start" : "end"}
                                                >
                                                    {lineText(m)}
                                                </textPath>
                                            </text>
                                        </svg>
                                    )}

                                    {/* sun: the brand's sun rises behind her */}
                                    {mode === "sun" && (
                                        <div
                                            className="hl3__sun"
                                            style={{
                                                left: pct(m.cx - sunW / 2),
                                                top: pct(sunY - sunH / 2),
                                                width: pct(sunW),
                                                height: pct(sunH),
                                            }}
                                        >
                                            <i className="hl3__sun-glow" />
                                            <i className="hl3__sun-rays" />
                                        </div>
                                    )}

                                    {/* closer: her contact shadow on the floor deepens as she steps in */}
                                    {mode === "closer" && (
                                        <i
                                            className="hl3__contact"
                                            style={{
                                                left: pct(m.cx - (m.x1 - m.x0) * 0.42),
                                                width: pct((m.x1 - m.x0) * 0.84),
                                                top: pct(m.feet - body * 0.03),
                                                height: pct(body * 0.05),
                                            }}
                                        />
                                    )}

                                    {/* softbox: the backdrop behind her catches the light */}
                                    {mode === "softbox" && <i className="hl3__bglight" />}

                                    {/* 3 — the model herself */}
                                    <img
                                        className="hl3__cut"
                                        src={`${maskDir}/cut${k}.webp`}
                                        alt=""
                                        decoding="async"
                                        style={{
                                            ...rect(cutR),
                                            transformOrigin: `50% ${pct((m.feet - cutR[1]) / cutR[3])}`,
                                        }}
                                    />

                                    {/* softbox: the same picture of her, brighter, faded in from her lit side */}
                                    {mode === "softbox" && (
                                        <img
                                            className="hl3__keylight"
                                            src={`${maskDir}/cut${k}.webp`}
                                            alt=""
                                            decoding="async"
                                            style={{
                                                ...rect(cutR),
                                                ["--kd" as string]: rs > 0 ? "to left" : "to right",
                                            }}
                                        />
                                    )}

                                    {/* 3b — her outfit, lit: revealed through a moving mask */}
                                    {fabric && (
                                        <img
                                            className={`hl3__fab hl3__fab--${kind}`}
                                            src={fabSrc}
                                            alt=""
                                            decoding="async"
                                            style={rect(cutR)}
                                        />
                                    )}
                                    {(kind === "scan" || kind === "touch") && (
                                        <img
                                            className={`hl3__fab hl3__fab--edge hl3__fab--${kind}-edge`}
                                            src={fabSrc}
                                            alt=""
                                            decoding="async"
                                            style={rect(cutR)}
                                        />
                                    )}

                                    {/* 4 — in front of her */}
                                    {lines || mode === "measure" || mode === "loop" ? (
                                        <svg
                                            className="hl3__svg"
                                            viewBox="0 0 1600 900"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            <defs>
                                                {fade}
                                                {lines && (
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
                                                )}
                                                {mode === "loop" && (
                                                    <mask
                                                        id={`${uid}r${k}`}
                                                        maskUnits="userSpaceOnUse"
                                                        x="0"
                                                        y="0"
                                                        width="1600"
                                                        height="900"
                                                    >
                                                        <Both d={paths[1]} cls="hl3__ln--mask" />
                                                    </mask>
                                                )}
                                                {mode === "measure" && (
                                                    <mask
                                                        id={`${uid}m${k}`}
                                                        maskUnits="userSpaceOnUse"
                                                        x="0"
                                                        y="0"
                                                        width="1600"
                                                        height="900"
                                                    >
                                                        <rect
                                                            x={rx - 20}
                                                            y={ry0 - 2}
                                                            width="40"
                                                            height={ry1 - ry0 + 4}
                                                            className="hl3__tickmask"
                                                        />
                                                    </mask>
                                                )}
                                            </defs>

                                            {lines && (
                                                <>
                                                    <Both d={m.path} />
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
                                                    {mode === "contour" && (
                                                        <g className="hl3__bead">
                                                            <circle
                                                                r="7.5"
                                                                className="hl3__bead-ring"
                                                            />
                                                            <circle
                                                                r="2.6"
                                                                className="hl3__bead-dot"
                                                            />
                                                        </g>
                                                    )}
                                                </>
                                            )}

                                            {mode === "loop" && (
                                                <>
                                                    <Both d={paths[0]} cls="hl3__ln--thin" />
                                                    <path id={`${uid}l${k}`} d={paths[1]} />
                                                    <g mask={faded}>
                                                        <g mask={`url(#${uid}b${k})`}>
                                                            <g mask={`url(#${uid}r${k})`}>
                                                                <text className="hl3__svgtext hl3__looptext">
                                                                    <textPath
                                                                        ref={(el) => {
                                                                            loopRefs.current[k] =
                                                                                el;
                                                                        }}
                                                                        href={`#${uid}l${k}`}
                                                                        startOffset="0"
                                                                    >
                                                                        {loopText[k]}
                                                                    </textPath>
                                                                </text>
                                                            </g>
                                                        </g>
                                                    </g>
                                                </>
                                            )}

                                            {mode === "measure" && (
                                                <g mask={faded}>
                                                    {/* from her head and her feet out to the rule */}
                                                    {[ry0, ry1].map((y, i) => (
                                                        <path
                                                            key={i}
                                                            className="hl3__draw1 hl3__draw1--thin"
                                                            pathLength={1}
                                                            d={`M${X(rs > 0 ? m.x1 - 0.004 : m.x0 + 0.004)} ${y} H${rx + rs * 14}`}
                                                        />
                                                    ))}
                                                    <path
                                                        className="hl3__draw1 hl3__rule"
                                                        pathLength={1}
                                                        d={`M${rx} ${ry0} V${rmid - rhalf}`}
                                                    />
                                                    <path
                                                        className="hl3__draw1 hl3__rule"
                                                        pathLength={1}
                                                        d={`M${rx} ${ry1} V${rmid + rhalf}`}
                                                    />
                                                    <g mask={`url(#${uid}m${k})`}>
                                                        <path d={ticks} className="hl3__ticks" />
                                                    </g>
                                                    <text
                                                        className="hl3__svgtext hl3__ruletext"
                                                        x={rx}
                                                        y={rmid + fs * 0.36}
                                                        textAnchor="middle"
                                                        transform={`rotate(${rs > 0 ? 90 : -90} ${rx} ${rmid})`}
                                                    >
                                                        {lineText(m)}
                                                    </text>
                                                </g>
                                            )}

                                            {lines && (
                                                <>
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
                                                </>
                                            )}
                                        </svg>
                                    ) : null}

                                    {/* the brand's hang tag, tied to her at the shoulder */}
                                    {mode === "tag" && (
                                        <div
                                            className="hl3__tag"
                                            style={{
                                                left: pct(tSide > 0 ? tAx : tAx - tBoxW),
                                                top: pct(tAy),
                                                width: pct(tBoxW),
                                                height: pct(body * 0.07),
                                                transformOrigin: `${tKnot}% 0`,
                                                ["--sw" as string]: tSide,
                                            }}
                                        >
                                            <svg
                                                className="hl3__tag-str"
                                                viewBox="0 0 100 100"
                                                preserveAspectRatio="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    className="hl3__tag-cord"
                                                    d={`M${tKnot} 0 Q${(tKnot + tHoleX) / 2} 92 ${tHoleX} 100`}
                                                />
                                                <path
                                                    className="hl3__tag-twist"
                                                    d={`M${tKnot} 0 Q${(tKnot + tHoleX) / 2} 92 ${tHoleX} 100`}
                                                />
                                            </svg>
                                            <i
                                                className="hl3__tag-knot"
                                                style={{ left: `${tKnot}%` }}
                                            />
                                            <div
                                                className="hl3__tag-card"
                                                style={{
                                                    width: `${(tagW / tBoxW) * 100}%`,
                                                    [tSide > 0 ? "right" : "left"]: 0,
                                                }}
                                            >
                                                <span className="hl3__tag-hole" />
                                                <i className="hl3__tag-sun" />
                                                <i
                                                    className="hl3__tag-brand"
                                                    aria-label="MIND BODY"
                                                />
                                                <b>{sentence(m.title)}</b>
                                                {parts.map((x) => (
                                                    <i
                                                        key={x}
                                                        className={
                                                            /[₴$]/.test(x) ? "is-price" : undefined
                                                        }
                                                    >
                                                        {x}
                                                    </i>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* the caption runs down her free side */}
                                    {SIDE_CAPTION.includes(mode) && !lines && (
                                        <div
                                            className="hl3__cap"
                                            style={{
                                                left: pct(rs > 0 ? m.x1 + 0.02 : m.x0 - 0.02),
                                                top: pct(
                                                    Math.max(m.head + body * 0.13, geo.top + 0.012),
                                                ),
                                            }}
                                        >
                                            <b>{sentence(m.title)}</b>
                                            {parts.length > 0 && (
                                                <>
                                                    <s />
                                                    <i>{m.sub}</i>
                                                </>
                                            )}
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
