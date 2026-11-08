import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * SmartSunParticles — the brand's drifting suns.
 *
 * The suns are a separate organism that lives on the PAGE, not on the glass
 *  A. Document space. Every sun has coordinates on the whole page (x across, y down
 *     the full document height). The canvas is a fixed viewport-sized window that
 *     paints `y − scrollY·k`: scroll and the page slides past the suns, they stay
 *     where they are and keep flying. They are seeded evenly over the entire page
 *     (density per screen is constant, the count follows the document height) and
 *     the whole page is simulated, so a sun you scrolled past is still living.
 *  B. Depth. k ∈ [0.80, 1] (small/far suns ≈ 0.80): a far sun trails the page by up
 *     to 20 % of the scroll, a near one is pinned to it → quiet parallax. Each sun
 *     wraps inside its own layer height `viewport + maxScroll·k`, which guarantees
 *     full coverage at scroll 0 and at the very bottom. (Reduced motion: k = 1.)
 *  C. Content height changes (lazy images, route change) never move a visible sun:
 *     y is never rescaled; extra suns are born into the emptiest gaps of the new
 *     area, surplus ones are removed only while off-screen.
 *
 * How the suns move (why they never stall, and never look random)
 *  1. ONE shared, slowly evolving breeze: a divergence-free flow field built from
 *     three travelling sine waves (stream function ψ, wind = (∂ψ/∂y, −∂ψ/∂x)).
 *     Divergence-free means it never herds suns into clumps or leaves empty
 *     patches, so no pairwise repulsion is needed.
 *  2. A prevailing heading (up and to the right, swinging ±30° over ~2.5 min)
 *     bent by the breeze, plus a per-sun sway: graceful S-curves, no straight lines.
 *  3. Speed is REGULATED, not integrated. Each sun steers toward a desired velocity
 *     whose length is its own cruise speed (0.30–0.70 px per 60 fps frame). Forces
 *     can bend the heading; nothing can drain the speed to zero.
 *  4. Everything is time-based (px/s × dt): 60 / 120 / 144 Hz screens move alike.
 *  5. No scroll LISTENER: scrollY is just read once per frame, so scrolling (native
 *     or Lenis) never pauses the suns.
 *
 * The cursor (a sun "wakes up" when you come near)
 *  - AWAKENING: inside ~260 px the sun's glow eases up (fast), and lingers when you
 *    leave (slow): a warm tinted aura behind it, a gently larger and brighter body,
 *    and a graceful spin-up — an easing angular velocity, in the sense of the curl.
 *  - SILKY CURL: it slides AROUND the cursor on the side it was already on (latched
 *    for the whole encounter, so it never flips mid-arc) with a soft outward push.
 *    A head-on sun keeps ≥ 80 % of its cruise speed — it yields, it never freezes.
 *  - WAKE: a quick stroke of the cursor drags the air — suns beside the path get a
 *    one-off gust along it and settle again over ~1.5 s.
 *  - SCROLL GUST: fast scrolling stirs the suns (extra spin, a touch brighter).
 * ──────────────────────────────────────────────────────────────────────────── */

interface SmartSunParticlesProps {
    /**
     * "under" (default) — site-wide backdrop at z -1 behind content.
     * "overlay" — /about brand atmosphere at z 1 above the opaque cream paper.
     *
     * Both share one motion model and never pause. Under prefers-reduced-motion
     * (the owner browses with it ON) the drift stays — owner decision — but a touch
     * calmer (×0.92, still ≥ 0.30 px/frame), with little spin, no parallax, no
     * wake/scroll gust; the cursor still wakes the suns, in a gentler key (×0.7).
     */
    variant?: "under" | "overlay";
}

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => x * x * (3 - 2 * x);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ── Brand pigments ───────────────────────────────────────────────────────────
// Each sun is painted with a diagonal "silk" sheen (light → body → shade).
// `boost` trims opacity so pale and dark pigments carry equal visual weight on
// the cream paper (dark marsala is trimmed, pale rose-gold is lifted).
interface Tint {
    light: string;
    base: string;
    deep: string;
    boost: number;
}
const TINTS: Tint[] = [
    // terracotta
    { light: "#e58a62", base: "#c4552f", deep: "#8f3a1d", boost: 1.0 },
    // warm amber
    { light: "#f5c860", base: "#dd9418", deep: "#a8650a", boost: 1.02 },
    // deep teal / emerald
    { light: "#34b5a0", base: "#0f766e", deep: "#0a4d48", boost: 0.95 },
    // royal marsala / plum (brand --color-marsala)
    { light: "#b24a63", base: "#722f37", deep: "#471923", boost: 0.92 },
    // lavender / amethyst
    { light: "#c2a8f0", base: "#8a63c0", deep: "#5d3d94", boost: 1.08 },
    // rose gold
    { light: "#f3c7b5", base: "#cf8f86", deep: "#a05f63", boost: 1.15 },
];

// ── Sprites ──────────────────────────────────────────────────────────────────
/** Pre-painted sprite sizes (px). A sun uses the smallest tier ≥ its on-screen
 *  device size, so it is minified ≤ 2× only: crisp on retina, no shimmer while
 *  rotating, and ~2 MB total instead of re-scaling a 504 px source every frame. */
const TIERS = [64, 128, 256];
/** The logo fills this share of its sprite square; the rest is padding so the
 *  points of the sun never clip while it rotates. */
const ART_FILL = 0.88;

function paintTop(img: HTMLImageElement, size: number, tint: Tint): HTMLCanvasElement | null {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (!g) return null;
    g.imageSmoothingQuality = "high";
    const art = size * ART_FILL;
    const off = (size - art) / 2;
    g.drawImage(img, off, off, art, art);
    // Recolour: source-in keeps the logo's own alpha and swaps its pixels for the sheen.
    g.globalCompositeOperation = "source-in";
    const sheen = g.createLinearGradient(off, off, off + art, off + art);
    sheen.addColorStop(0, tint.light);
    sheen.addColorStop(0.5, tint.base);
    sheen.addColorStop(1, tint.deep);
    g.fillStyle = sheen;
    g.fillRect(0, 0, size, size);
    return c;
}

/** One sprite per tier for a tint; lower tiers are halved from the one above. */
function buildTintSprites(img: HTMLImageElement, tint: Tint): HTMLCanvasElement[] {
    const out: HTMLCanvasElement[] = [];
    const top = paintTop(img, TIERS[TIERS.length - 1], tint);
    if (!top) return out;
    out[TIERS.length - 1] = top;
    for (let i = TIERS.length - 2; i >= 0; i--) {
        const c = document.createElement("canvas");
        c.width = c.height = TIERS[i];
        const g = c.getContext("2d");
        if (!g) return [];
        g.imageSmoothingQuality = "high";
        g.drawImage(out[i + 1], 0, 0, TIERS[i], TIERS[i]);
        out[i] = c;
    }
    return out;
}

const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Soft aura in the sun's own pigment — the "luminance" a woken sun radiates.
 *  Painted once per tint; drawn scaled, so it costs one drawImage per awake sun. */
const HALO_PX = 128;
function buildHalo(tint: Tint): HTMLCanvasElement | null {
    const c = document.createElement("canvas");
    c.width = c.height = HALO_PX;
    const g = c.getContext("2d");
    if (!g) return null;
    const m = HALO_PX / 2;
    const grad = g.createRadialGradient(m, m, 0, m, m, m);
    grad.addColorStop(0, rgba(tint.light, 0.9));
    grad.addColorStop(0.28, rgba(tint.light, 0.5));
    grad.addColorStop(0.62, rgba(tint.base, 0.14));
    grad.addColorStop(1, rgba(tint.base, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, HALO_PX, HALO_PX);
    return c;
}

// ── Motion tuning ────────────────────────────────────────────────────────────
/** Speeds are authored per 60 fps frame (the brief's unit) and applied per second. */
const PER_FRAME = 60;
/** Cruise speed band. With the ±9 % surge and the reduced-motion trim below, every
 *  sun stays inside 0.30–0.70 px/frame — in every mode, on every variant. */
const CRUISE_MIN = 0.36 * PER_FRAME;
const CRUISE_MAX = 0.64 * PER_FRAME;
const SURGE = 0.09;
/** Reduced-motion trim: 0.36 · 0.91 · 0.92 ≈ 0.30 px/frame — calmer, never stalled. */
const REDUCED_SPEED = 0.92;
/** Steering time constant (s): how silkily velocity follows the desired velocity. */
const RELAX_S = 0.8;
/** Prevailing heading in screen coordinates (rad): up and to the right, like warm air rising. */
const PREVAIL = -0.95;
const PREVAIL_SWING = 0.5;
const PREVAIL_PERIOD = 150;
/** How strongly the breeze bends the heading. < 1, so the heading can never reverse. */
const WIND_WEIGHT = 0.7;

/** Three shear waves of the stream function: direction (rad), wavelength (px), period (s), phase. */
const WAVES = [
    { dir: 0.35, wavelength: 760, period: 31, phase: 0.0 },
    { dir: 2.2, wavelength: 540, period: 23, phase: 1.7 },
    { dir: 4.0, wavelength: 910, period: 37, phase: 4.1 },
].map((w) => ({
    cos: Math.cos(w.dir),
    sin: Math.sin(w.dir),
    k: TAU / w.wavelength,
    omega: TAU / w.period,
    phase: w.phase,
}));

/** Breeze at (x, y, t): unit-bounded, divergence-free. Result lands in `breeze`. */
const breeze = { x: 0, y: 0 };
function sampleBreeze(x: number, y: number, t: number) {
    let bx = 0;
    let by = 0;
    for (let i = 0; i < WAVES.length; i++) {
        const w = WAVES[i];
        const c = Math.cos(w.k * (w.cos * x + w.sin * y) + w.omega * t + w.phase);
        bx += w.sin * c; //  ∂ψ/∂y
        by -= w.cos * c; // −∂ψ/∂x
    }
    breeze.x = bx / WAVES.length;
    breeze.y = by / WAVES.length;
}

// ── Page space ───────────────────────────────────────────────────────────────
/** Suns per screen of page height (the count follows the document height). */
const PER_SCREEN = { desktop: { under: 34, overlay: 22 }, mobile: { under: 16, overlay: 9 } };
/** Hard ceiling for the whole page — keeps very long pages cheap. */
const MAX_SUNS = { desktop: 190, mobile: 90 };
/** Parallax floor: the farthest sun trails the page by up to 1 − this of the scroll. */
const PARALLAX_MIN = 0.8;

// ── Cursor (desktop) ─────────────────────────────────────────────────────────
const CURSOR_RADIUS = 260;
/** px/s outward at the cursor's centre. */
const CURSOR_PUSH = 40;
/** px/s sideways at the cursor's centre — larger than the push, so suns flow AROUND it.
 *  Worst case (head-on) keeps |v| ≥ cruise · SLIDE/√(PUSH²+SLIDE²) ≈ 0.9 · cruise. */
const CURSOR_SLIDE = 84;
const MAX_DESIRED = 150;
/** Wake: cursor velocity (capped, px/s) → acceleration of nearby suns. Equilibrium
 *  push ≈ cap · KICK · RELAX_S ≈ 90 px/s at the strongest stroke. */
const WAKE_KICK = 0.08;
const WAKE_CAP = 1400;
/** Hard ceiling on a sun's real speed (px/s), whatever the wake does. */
const MAX_SPEED = 190;
/** Awake spin (rad/s) in the sense of the curl, and extra spin from a scroll gust. */
const SPIN_AWAKE = 1.7;
const SPIN_GUST = 1.3;
/** A woken sun grows by this much and its aura reaches this many × its size. */
const BLOOM = 0.2;
const HALO_SCALE = 2.7;
const GUST_FULL = 2400; // px/s of scroll that counts as a full gust

// ── Opacity ──────────────────────────────────────────────────────────────────
const ALPHA_LO = 0.22;
const ALPHA_HI = 0.38;
/** Breathing, ± fraction of the sun's own opacity (peaks ≈ 0.45 at most). */
const BREATH = 0.12;
const ALPHA_CAP = 0.5;
/** A woken sun may exceed the cap by this much (it is the one in the spotlight). */
const ALPHA_CAP_AWAKE = 0.16;
const GLINT_MS = 2600;

interface Sun {
    /** page space: x across, y down the whole document (layer coordinates, see k) */
    x: number;
    y: number;
    /** px/s */
    vx: number;
    vy: number;
    /** art size, CSS px */
    size: number;
    /** depth parallax factor, PARALLAX_MIN..1 (1 = pinned to the page) */
    par: number;
    /** personal cruise speed, px/s — always > 0 */
    cruise: number;
    /** fixed personal heading offset, rad */
    bias: number;
    swayAmp: number;
    swayPeriod: number;
    swayPhase: number;
    surgePeriod: number;
    surgePhase: number;
    /** resting spin, rad/s; current spin, rad/s; angle, rad */
    spin: number;
    omega: number;
    rot: number;
    /** base opacity, already balanced per pigment */
    alpha: number;
    breathPeriod: number;
    breathPhase: number;
    tint: number;
    /** 0..1 — how awake the sun is (eased proximity to the cursor) */
    glow: number;
    /** timestamp (ms) when the next rare glint starts */
    glintAt: number;
    /** which way to curl round the cursor — latched for the whole encounter */
    side: 1 | -1;
    /** true while inside the cursor radius (side is latched on entry) */
    engaged: boolean;
    /** timestamp (ms) when the fade-in starts */
    born: number;
}

export default function SmartSunParticles({ variant = "under" }: SmartSunParticlesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlay = variant === "overlay";

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let disposed = false;
        let rafId = 0;

        // ── environment ──────────────────────────────────────────────────────
        const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
        let reduced = reducedMq.matches;
        const onReducedChange = () => {
            reduced = reducedMq.matches;
        };
        reducedMq.addEventListener("change", onReducedChange);

        const isMobile = window.innerWidth <= 768;
        const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        const perScreen =
            PER_SCREEN[isMobile ? "mobile" : "desktop"][overlay ? "overlay" : "under"];
        const maxSuns = MAX_SUNS[isMobile ? "mobile" : "desktop"];
        const [sizeMin, sizeMax] = isMobile
            ? overlay
                ? [30, 62]
                : [34, 70]
            : overlay
              ? [34, 92]
              : [38, 104];

        // ── canvas fitting: retina-sharp (DPR ≤ 2), re-measured on resize / zoom ──
        const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);
        let width = 0;
        let height = 0;
        let dpr = getDpr();
        /** scrollable distance of the document (scrollHeight − viewport) */
        let maxScroll = 0;
        let needsLayout = true;
        let lastLayoutAt = 0;
        const suns: Sun[] = [];
        let sprites: HTMLCanvasElement[][] = [];
        let halos: (HTMLCanvasElement | null)[] = [];
        /** shuffled pigments, handed out in turn so every colour is always present */
        const order = TINTS.map((_, i) => i).sort(() => Math.random() - 0.5);
        let tintSeq = 0;

        /** parallax factor in effect (reduced motion pins every sun to the page) */
        const kOf = (s: Sun) => (reduced ? 1 : s.par);

        const layout = () => {
            needsLayout = false;
            // The canvas's own CSS box is the truth (window.innerWidth includes the scrollbar).
            const w = canvas.clientWidth || window.innerWidth;
            const h = canvas.clientHeight || window.innerHeight;
            const d = getDpr();
            const bw = Math.round(w * d);
            const bh = Math.round(h * d);
            if (bw !== canvas.width || bh !== canvas.height) {
                canvas.width = bw; // reallocates + clears; repainted in this same frame
                canvas.height = bh;
                ctx.imageSmoothingQuality = "high";
            }
            // Big width change (rotate phone, resize window): keep the arrangement across
            // the page. Small changes leave positions untouched, so nothing jumps. y is
            // NEVER rescaled — it is page space, and a visible sun must not move when the
            // document grows; new suns are born into the new area instead (reconcile).
            if (suns.length && width > 0 && Math.abs(w / width - 1) > 0.25) {
                for (const s of suns) s.x *= w / width;
            }
            width = w;
            height = h;
            dpr = d;
            maxScroll = Math.max(0, document.documentElement.scrollHeight - h);
        };

        // ── cursor ───────────────────────────────────────────────────────────
        let mouseX = 0;
        let mouseY = 0;
        let mouseActive = false;
        let cursorX = 0;
        let cursorY = 0;
        let cursorVx = 0;
        let cursorVy = 0;
        let cursorGain = 0;

        const onMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            mouseActive = true;
        };
        // relatedTarget is null only when the pointer leaves the window — a bare
        // "mouseout" also fires on every child-element crossing and made the glow flicker.
        const onMouseOut = (e: MouseEvent) => {
            if (!e.relatedTarget) mouseActive = false;
        };
        const onBlur = () => {
            mouseActive = false;
        };

        // ── birth ────────────────────────────────────────────────────────────
        /** One new sun in the emptiest of `tries` random spots on the page. */
        const makeSun = (now: number, delay: number, tries: number): Sun => {
            // depth: many small/far suns, a few larger/closer ones
            const depth = Math.pow(Math.random(), 1.5);
            const par = PARALLAX_MIN + (1 - PARALLAX_MIN) * depth;
            const kk = reduced ? 1 : par;
            const layerH = height + maxScroll * kk;
            // "Virtual" page height so suns of different layers are compared fairly.
            const page = height + maxScroll;
            let px = 0;
            let py = 0;
            let far = -1;
            for (let c = 0; c < tries; c++) {
                const cx = Math.random() * width;
                const cy = Math.random() * layerH;
                const cv = (cy / layerH) * page;
                let nearest = Infinity;
                for (const o of suns) {
                    const ov = (o.y / (height + maxScroll * kOf(o))) * page;
                    const d2 = (o.x - cx) * (o.x - cx) + (ov - cv) * (ov - cv);
                    if (d2 < nearest) nearest = d2;
                }
                if (nearest > far) {
                    far = nearest;
                    px = cx;
                    py = cy;
                }
            }
            const tint = order[tintSeq++ % order.length];
            const bias = rand(-0.3, 0.3);
            const cruise =
                CRUISE_MIN + (CRUISE_MAX - CRUISE_MIN) * (0.7 * depth + 0.3 * Math.random());
            const mix = 0.35 * depth + 0.65 * Math.random();
            const heading = PREVAIL + bias;
            const scale = reduced ? REDUCED_SPEED : 1;
            const spin = (Math.random() < 0.5 ? -1 : 1) * rand(0.03, 0.1);
            return {
                x: px,
                y: py,
                vx: Math.cos(heading) * cruise * scale,
                vy: Math.sin(heading) * cruise * scale,
                size: sizeMin + (sizeMax - sizeMin) * depth,
                par,
                cruise,
                bias,
                swayAmp: rand(0.18, 0.4),
                swayPeriod: rand(8, 15),
                swayPhase: Math.random() * TAU,
                surgePeriod: rand(14, 24),
                surgePhase: Math.random() * TAU,
                spin,
                omega: spin * (reduced ? 0.3 : 1),
                rot: Math.random() * TAU,
                alpha: Math.min(
                    0.4,
                    Math.max(0.2, (ALPHA_LO + (ALPHA_HI - ALPHA_LO) * mix) * TINTS[tint].boost),
                ),
                breathPeriod: rand(9, 16),
                breathPhase: Math.random() * TAU,
                tint,
                glow: 0,
                glintAt: now + rand(4000, 24000),
                side: Math.random() < 0.5 ? -1 : 1,
                engaged: false,
                born: now + delay,
            };
        };

        /** How many suns the whole page should hold right now. */
        const targetCount = () => {
            if (height <= 0) return 0;
            const screens = (height + maxScroll * 0.9) / height;
            return Math.min(maxSuns, Math.max(perScreen, Math.round(perScreen * screens)));
        };

        /** Page got taller / shorter: fill gaps with new suns, retire surplus off-screen. */
        const reconcile = (now: number, scrollY: number, initial: boolean) => {
            const want = targetCount();
            while (suns.length < want) {
                suns.push(makeSun(now, initial ? Math.random() * 900 : 0, initial ? 6 : 10));
            }
            for (let i = suns.length - 1; i >= 0 && suns.length > want; i--) {
                const s = suns[i];
                const sy = s.y - scrollY * kOf(s);
                const m = (s.size / ART_FILL) * 2;
                if (sy < -m || sy > height + m) suns.splice(i, 1);
            }
        };

        // ── the loop ─────────────────────────────────────────────────────────
        let lastNow = -1;
        let lastScrollY = 0;
        let scrollVel = 0;
        let seeded = false;

        const frame = (now: number) => {
            if (disposed) return;
            rafId = requestAnimationFrame(frame);

            const scrollY = window.scrollY || 0;
            if (lastNow < 0) {
                lastNow = now;
                lastScrollY = scrollY;
            }
            // Re-measure on resize / zoom / content change, and every ~0.6 s to catch
            // late-loading images growing the page (ResizeObserver covers most of it).
            if (needsLayout || getDpr() !== dpr || now - lastLayoutAt > 600) {
                const prevMax = maxScroll;
                const prevH = height;
                layout();
                lastLayoutAt = now;
                if (!seeded || prevMax !== maxScroll || prevH !== height) {
                    reconcile(now, scrollY, !seeded);
                    seeded = true;
                }
            }
            // Clamped, so a throttled / resumed tab never teleports the suns.
            const dt = Math.min(0.05, (now - lastNow) / 1000);
            lastNow = now;
            if (dt <= 0) return;
            const t = now / 1000;

            const scale = reduced ? REDUCED_SPEED : 1;
            const spinScale = reduced ? 0.3 : 1;
            // Pointer play stays under reduced motion (it is user-initiated), but gentler.
            const interactive = canHover;
            const cursorMax = reduced ? 0.7 : 1;

            // Cursor eased on both position and influence: no pops on enter / leave.
            let wakeX = 0;
            let wakeY = 0;
            if (interactive && mouseActive) {
                if (cursorGain < 0.01) {
                    cursorX = mouseX;
                    cursorY = mouseY;
                    cursorVx = 0;
                    cursorVy = 0;
                } else {
                    const follow = 1 - Math.exp(-dt / 0.06);
                    const nx = cursorX + (mouseX - cursorX) * follow;
                    const ny = cursorY + (mouseY - cursorY) * follow;
                    const vf = 1 - Math.exp(-dt / 0.1);
                    cursorVx += ((nx - cursorX) / dt - cursorVx) * vf;
                    cursorVy += ((ny - cursorY) / dt - cursorVy) * vf;
                    cursorX = nx;
                    cursorY = ny;
                }
                // The wake: cursor velocity, capped in length.
                const sp = Math.hypot(cursorVx, cursorVy);
                if (!reduced && sp > 1) {
                    const cap = Math.min(sp, WAKE_CAP) / sp;
                    wakeX = cursorVx * cap;
                    wakeY = cursorVy * cap;
                }
            }
            const gainTarget = interactive && mouseActive ? cursorMax : 0;
            cursorGain += (gainTarget - cursorGain) * (1 - Math.exp(-dt / 0.35));

            // Scroll gust: how hard the page is being stirred right now (smoothed).
            const sv = (scrollY - lastScrollY) / dt;
            lastScrollY = scrollY;
            scrollVel += (sv - scrollVel) * (1 - Math.exp(-dt / 0.18));
            const gust = reduced ? 0 : clamp01(Math.abs(scrollVel) / GUST_FULL);

            const prevail = PREVAIL + PREVAIL_SWING * Math.sin((t * TAU) / PREVAIL_PERIOD);
            const pcx = Math.cos(prevail);
            const pcy = Math.sin(prevail);
            const relax = 1 - Math.exp(-dt / RELAX_S);
            const glowUp = 1 - Math.exp(-dt / 0.22); // wakes quickly…
            const glowDown = 1 - Math.exp(-dt / 0.7); // …and lingers, like an afterglow
            const spinUp = 1 - Math.exp(-dt / 0.45);
            const spinDown = 1 - Math.exp(-dt / 1.2);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < suns.length; i++) {
                const s = suns[i];
                const k = kOf(s);
                const layerH = height + maxScroll * k;
                const q = s.size / ART_FILL;

                // 1) Desired velocity: breeze-bent heading, personal sway, own cruise speed.
                sampleBreeze(s.x, s.y, t);
                const heading =
                    Math.atan2(pcy + WIND_WEIGHT * breeze.y, pcx + WIND_WEIGHT * breeze.x) +
                    s.bias +
                    s.swayAmp * Math.sin((t * TAU) / s.swayPeriod + s.swayPhase);
                const cruise =
                    s.cruise *
                    scale *
                    (1 + SURGE * Math.sin((t * TAU) / s.surgePeriod + s.surgePhase));
                const dx = Math.cos(heading);
                const dy = Math.sin(heading);
                let tx = dx * cruise;
                let ty = dy * cruise;

                // 2) Cursor (viewport space): curl round it on the side the sun is on, nudge
                //    outward, and let the wake of a quick stroke carry it a little.
                let glowTarget = 0;
                let curl = 0;
                if (cursorGain > 0.002) {
                    const rx = s.x - cursorX;
                    const ry = s.y - scrollY * k - cursorY;
                    const d2 = rx * rx + ry * ry;
                    if (d2 < CURSOR_RADIUS * CURSOR_RADIUS && d2 > 1) {
                        const d = Math.sqrt(d2);
                        const nx = rx / d;
                        const ny = ry / d;
                        const f = 1 - d / CURSOR_RADIUS;
                        const w = smooth(f) * cursorGain;
                        let sx = -ny;
                        let sy = nx;
                        if (!s.engaged) {
                            // Latch the side once, on entry: no flip-flopping mid-arc.
                            const along = sx * dx + sy * dy;
                            if (Math.abs(along) > 0.15) s.side = along > 0 ? 1 : -1;
                            s.engaged = true;
                        }
                        sx *= s.side;
                        sy *= s.side;
                        tx += (nx * CURSOR_PUSH + sx * CURSOR_SLIDE) * w;
                        ty += (ny * CURSOR_PUSH + sy * CURSOR_SLIDE) * w;
                        // One-off gust from a quick stroke, shaped like the curl: strongest
                        // beside the path, fading with distance.
                        if (wakeX !== 0 || wakeY !== 0) {
                            s.vx += wakeX * WAKE_KICK * w * dt;
                            s.vy += wakeY * WAKE_KICK * w * dt;
                        }
                        // Aura swells fast: full glow at ~60 % of the radius.
                        glowTarget = smooth(clamp01(f * 1.7)) * cursorGain;
                        curl = s.side * w;
                    } else {
                        s.engaged = false;
                    }
                } else {
                    s.engaged = false;
                }

                // 3) Bounds on the desired speed: never below 80 % of cruise, never frantic.
                const want = Math.sqrt(tx * tx + ty * ty);
                const floor = cruise * 0.8;
                if (want < floor) {
                    if (want > 1e-4) {
                        tx *= floor / want;
                        ty *= floor / want;
                    } else {
                        tx = dx * floor;
                        ty = dy * floor;
                    }
                } else if (want > MAX_DESIRED) {
                    tx *= MAX_DESIRED / want;
                    ty *= MAX_DESIRED / want;
                }

                // 4) Steer (silky relaxation toward the desired velocity), then move.
                s.vx += (tx - s.vx) * relax;
                s.vy += (ty - s.vy) * relax;
                const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                if (sp > MAX_SPEED) {
                    s.vx *= MAX_SPEED / sp;
                    s.vy *= MAX_SPEED / sp;
                }
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.glow += (glowTarget - s.glow) * (glowTarget > s.glow ? glowUp : glowDown);

                // Spin: resting drift + a graceful spin-up in the sense of the curl + a
                // scroll gust, all eased (up fast-ish, down slowly) — never a snap.
                const spinTarget =
                    s.spin * spinScale +
                    curl * SPIN_AWAKE * (reduced ? 0.45 : 1) +
                    (s.spin < 0 ? -1 : 1) * SPIN_GUST * gust;
                s.omega +=
                    (spinTarget - s.omega) *
                    (Math.abs(spinTarget) > Math.abs(s.omega) ? spinUp : spinDown);
                s.rot += s.omega * dt;

                // 5) Endless flight over the whole page: leave one edge fully, re-enter from
                //    the opposite one. (Off-screen by construction: see header, point B.)
                let wrapped = false;
                if (s.x < -q) {
                    s.x = width + q;
                    wrapped = true;
                } else if (s.x > width + q) {
                    s.x = -q;
                    wrapped = true;
                }
                if (s.y < -q) {
                    s.y = layerH + q;
                    wrapped = true;
                } else if (s.y > layerH + q) {
                    s.y = -q;
                    wrapped = true;
                }
                // A fresh personality each lap keeps the flight non-repeating.
                if (wrapped) {
                    s.bias = rand(-0.3, 0.3);
                    s.swayPhase = Math.random() * TAU;
                    s.side = Math.random() < 0.5 ? -1 : 1;
                }

                // 6) Project page → viewport and cull. Margin covers the bloom and the aura.
                const sy = s.y - scrollY * k;
                const margin = q * 1.5;
                if (sy < -margin || sy > height + margin || s.x < -margin || s.x > width + margin) {
                    continue;
                }
                const tiers = sprites[s.tint];
                if (!tiers || !tiers.length) continue;

                // 7) Draw: breathing opacity, cursor glow, a rare glint like sun on silk.
                let glint = 0;
                if (now >= s.glintAt) {
                    const g = (now - s.glintAt) / GLINT_MS;
                    if (g < 1) glint = Math.sin(g * Math.PI);
                    else s.glintAt = now + rand(25000, 70000);
                }
                const intro = smooth(clamp01((now - s.born) / 1200));
                const breath = 1 + BREATH * Math.sin((t * TAU) / s.breathPeriod + s.breathPhase);
                const awake = smooth(s.glow);
                const alpha = Math.min(
                    ALPHA_CAP + ALPHA_CAP_AWAKE * awake,
                    s.alpha * breath * (1 + 0.75 * awake + 0.55 * glint + 0.3 * gust) * intro,
                );

                // Aura first (behind the body): a pulsing pool of the sun's own light.
                const halo = halos[s.tint];
                if (halo && awake > 0.015) {
                    const hs = q * HALO_SCALE * (0.92 + 0.08 * Math.sin(t * 2.4 + s.breathPhase));
                    ctx.setTransform(dpr, 0, 0, dpr, s.x * dpr, sy * dpr);
                    ctx.globalAlpha = Math.min(0.62, 0.62 * awake) * intro;
                    ctx.drawImage(halo, -hs / 2, -hs / 2, hs, hs);
                }

                const qd = q * (1 + BLOOM * awake);
                const dev = qd * dpr;
                let sprite = tiers[tiers.length - 1];
                for (let j = 0; j < TIERS.length; j++) {
                    if (TIERS[j] >= dev) {
                        sprite = tiers[j];
                        break;
                    }
                }
                const c = Math.cos(s.rot) * dpr;
                const n = Math.sin(s.rot) * dpr;
                ctx.setTransform(c, n, -n, c, s.x * dpr, sy * dpr);
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, -qd / 2, -qd / 2, qd, qd);
            }
        };

        // ── boot ─────────────────────────────────────────────────────────────
        const img = new Image();
        img.onload = () => {
            if (disposed) return;
            sprites = TINTS.map((tint) => buildTintSprites(img, tint));
            halos = TINTS.map((tint) => buildHalo(tint));
            layout();
            rafId = requestAnimationFrame(frame);
        };
        img.src = "/logo-sun.png";

        // Canvas = viewport size; body = document height (content loading / route change).
        const resizeObserver = new ResizeObserver(() => {
            needsLayout = true;
        });
        resizeObserver.observe(canvas);
        resizeObserver.observe(document.body);
        if (canHover) {
            window.addEventListener("mousemove", onMouseMove, { passive: true });
            window.addEventListener("mouseout", onMouseOut, { passive: true });
            window.addEventListener("blur", onBlur);
        }

        return () => {
            disposed = true;
            cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
            reducedMq.removeEventListener("change", onReducedChange);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseout", onMouseOut);
            window.removeEventListener("blur", onBlur);
            img.onload = null;
            sprites = [];
            halos = [];
            suns.length = 0;
        };
    }, [overlay]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={"smart-sun-particles" + (overlay ? " smart-sun-particles--overlay" : "")}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                // Overlay floats above the /about opaque paper (its ::before/::after
                // ambiance layers are z1; content is in its own stacking contexts).
                zIndex: overlay ? 1 : -1,
            }}
        />
    );
}
