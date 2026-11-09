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
 *  2. OMNIDIRECTIONAL: every sun owns a heading over the full 360° (handed out on a
 *     golden-angle sequence, so the sky is always evenly mixed — never one shared
 *     direction). The heading drifts very slowly and sways, and the breeze bends it
 *     a little: graceful S-curves, no straight lines.
 *  3. Speed is REGULATED, not integrated. Each sun steers toward a desired velocity
 *     whose length is its own cruise speed (0.20–0.45 px per 60 fps frame, every sun
 *     different, none fast). Forces can bend the heading; nothing can drain the speed
 *     to zero, nothing can push it past a calm ceiling.
 *  4. Everything is time-based (px/s × dt): 60 / 120 / 144 Hz screens move alike.
 *  5. No scroll LISTENER: scrollY is just read once per frame, so scrolling (native
 *     or Lenis) never pauses the suns.
 *
 * Look: small, delicate, noble. Flat brand pigments (lavender, marsala/plum, deep teal,
 * powder rose) stamped onto the logo with source-in, so the sun's lines stay pure and
 * crisp. Sizes 16–64 px (mostly tiny), opacity 0.08–0.18 on cream paper, soft sinusoidal
 * breath, no centre glow, no flashes.
 *
 * The cursor (alive, but light)
 *  - YIELD: a sun within 220 px visibly slides out of the way — pushed outward and
 *    curled around the cursor on the side it was already on (latched for the whole
 *    encounter, so it never flips mid-arc), at ~1.5–2.5 px/frame near the cursor.
 *  - SPIN: the breath of the mouse spins the sun up, softly.
 *  - AWAKENING: the sun glows up to +20 % brighter while the cursor is near, then
 *    eases back.
 *  - RETURN: when the cursor leaves, speed and glow relax back to the calm drift.
 *  - WAKE: a quick stroke of the cursor drags the air — suns beside the path get a
 *    one-off nudge along it and settle again.
 *  - SCROLL GUST: fast scrolling adds a little extra spin.
 * ──────────────────────────────────────────────────────────────────────────── */

interface SmartSunParticlesProps {
    /**
     * "under" (default) — site-wide backdrop at z -1 behind content.
     * "overlay" — /about brand atmosphere at z 1 above the opaque cream paper.
     *
     * Both share one motion model and never pause. Under prefers-reduced-motion
     * (the owner browses with it ON) the drift stays — owner decision — same speeds
     * (0.20–0.45 px/frame), with little spin, no parallax, no wake/scroll gust; the
     * cursor still visibly moves, spins and wakes the suns (×0.9) — the owner must
     * see the reaction.
     */
    variant?: "under" | "overlay";
}

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => x * x * (3 - 2 * x);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ── Brand pigments ───────────────────────────────────────────────────────────
// Flat pigment per sun (source-in onto /logo-sun.png) — the early, beloved look.
// `boost` trims opacity so pale and dark pigments carry equal visual weight on the
// cream paper (dark plum is trimmed, pale rose / lavender are lifted).
interface Tint {
    color: string;
    boost: number;
}
const TINTS: Tint[] = [
    // soft lavender
    { color: "#8c72bd", boost: 1.08 },
    // noble plum / marsala
    { color: "#7b2938", boost: 0.9 },
    // deep teal
    { color: "#0d7a71", boost: 0.96 },
    // soft powder rose / cashmere
    { color: "#c87a80", boost: 1.1 },
];

// ── Sprites ──────────────────────────────────────────────────────────────────
/** Pre-painted sprite sizes (px). A sun uses the smallest tier ≥ its on-screen
 *  device size, so it is minified ≤ 2× only: crisp on retina, no shimmer while
 *  rotating, and ~2 MB total instead of re-scaling a 504 px source every frame.
 *  The 32 tier serves the tiny suns (≈18–28 px on a 1× screen); 48 and 96 keep the
 *  36–56 px band within ~1.2× of its sprite. 256 stays for 64 px suns on 3× screens. */
const TIERS = [32, 48, 64, 96, 128, 256];
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
    // Recolour: source-in keeps the logo's own alpha and swaps its pixels for a flat pigment.
    g.globalCompositeOperation = "source-in";
    g.fillStyle = tint.color;
    g.fillRect(0, 0, size, size);
    return c;
}

/** One sprite per tier for a tint. Every tier is rasterised straight from the source
 *  image (never re-downsampled from a larger tier), so thin rays stay as sharp as possible. */
function buildTintSprites(img: HTMLImageElement, tint: Tint): HTMLCanvasElement[] {
    const out: HTMLCanvasElement[] = [];
    for (let i = 0; i < TIERS.length; i++) {
        const sprite = paintTop(img, TIERS[i], tint);
        if (!sprite) return [];
        out[i] = sprite;
    }
    return out;
}

// ── Motion tuning ────────────────────────────────────────────────────────────
/** Speeds are authored per 60 fps frame (the brief's unit) and applied per second. */
const PER_FRAME = 60;
/** Cruise speed band: 0.20–0.45 px per 60 fps frame. The ±5 % surge is already inside
 *  the band (0.21·0.95 ≈ 0.20, 0.42·1.05 ≈ 0.44), so every sun stays calm, in every mode. */
const CRUISE_MIN = 0.21 * PER_FRAME;
const CRUISE_MAX = 0.42 * PER_FRAME;
const SURGE = 0.05;
/** Steering time constant (s): how silkily velocity follows the desired velocity. */
const RELAX_S = 1.0;
/** Slow wander of a sun's own heading (rad/s, ±): the trajectory keeps changing softly. */
const TURN_MAX = 0.012;
/** Golden angle: successive suns get headings that never cluster in one direction. */
const GOLDEN_ANGLE = 2.399963;
/** How strongly the breeze bends the heading. < 1, so the heading can never reverse. */
const WIND_WEIGHT = 0.55;

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
const PER_SCREEN = { desktop: { under: 31, overlay: 21 }, mobile: { under: 15, overlay: 9 } };
/** Hard ceiling for the whole page — keeps very long pages cheap. */
const MAX_SUNS = { desktop: 170, mobile: 80 };

/** Size mix: many tiny suns, some medium, a few larger ones (never above 64 px). Each band is the
 *  art size in CSS px; `share` is the chance of drawing from it. */
const SIZE_SHARE = { small: 0.62, medium: 0.28 }; // the rest (≈10 %) are the largest (≤ 64 px)
type SizeBands = { small: [number, number]; medium: [number, number]; large: [number, number] };
const SIZE_BANDS: Record<"desktop" | "mobile", Record<"under" | "overlay", SizeBands>> = {
    desktop: {
        under: { small: [16, 28], medium: [32, 46], large: [50, 64] },
        overlay: { small: [16, 26], medium: [30, 44], large: [48, 60] },
    },
    mobile: {
        under: { small: [16, 26], medium: [30, 40], large: [42, 48] },
        overlay: { small: [15, 24], medium: [28, 38], large: [40, 46] },
    },
};
/** Parallax floor: the farthest sun trails the page by up to 1 − this of the scroll. */
const PARALLAX_MIN = 0.8;

// ── Cursor (desktop) ─────────────────────────────────────────────────────────
const CURSOR_RADIUS = 220;
/** px/s outward at the cursor's centre (≈ 2 px/frame) — the sun clearly yields. */
const CURSOR_PUSH = 105;
/** px/s sideways at the cursor's centre — the sun flows AROUND, not just away. */
const CURSOR_SLIDE = 55;
/** Ceiling on the desired speed (px/s) = 2.5 px/frame: lively near the cursor, never frantic. */
const MAX_DESIRED = 150;
/** Steering time constant (s) at the cursor's centre: the sun reacts fast, then
 *  RELAX_S takes over again as the cursor leaves → smooth return to the calm drift. */
const RELAX_NEAR_S = 0.22;
/** Wake: cursor velocity (capped, px/s) → acceleration of nearby suns. Equilibrium
 *  push ≈ cap · KICK · RELAX_S ≈ 40 px/s at the strongest stroke. */
const WAKE_KICK = 0.03;
const WAKE_CAP = 1400;
/** Hard ceiling on a sun's real speed (px/s) ≈ 2.8 px/frame, whatever the wake does. */
const MAX_SPEED = 168;
/** Spin (rad/s) in the sense of the curl, and extra spin from a scroll gust. */
const SPIN_AWAKE = 1.1;
const SPIN_GUST = 0.3;
const GUST_FULL = 2400; // px/s of scroll that counts as a full gust
/** Cursor awakening: opacity gain (fraction) at the cursor's centre. */
const GLOW = 0.2;

// ── Opacity ──────────────────────────────────────────────────────────────────
const ALPHA_LO = 0.11;
const ALPHA_HI = 0.22;
/** Per-sun clamp after the pigment boost. */
const ALPHA_MIN = 0.11;
const ALPHA_MAX = 0.22;
/** Breathing (sinusoidal), ± fraction of the sun's own opacity. */
const BREATH = 0.14;
/** Absolute ceiling of any sun's opacity, breath and cursor glow included. */
const ALPHA_CAP = 0.3;

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
    /** personal heading, rad — full 360°, drifts slowly at `turn` */
    dir: number;
    /** heading drift, rad/s */
    turn: number;
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
    /** which way to curl round the cursor — latched for the whole encounter */
    side: 1 | -1;
    /** true while inside the cursor radius (side is latched on entry) */
    engaged: boolean;
    /** cursor awakening 0..1, eased in fast and out slowly */
    glow: number;
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
        const bands = SIZE_BANDS[isMobile ? "mobile" : "desktop"][overlay ? "overlay" : "under"];
        const sizeMin = bands.small[0];
        const sizeMax = bands.large[1];

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
        /** shuffled pigments, handed out in turn so every colour is always present */
        const order = TINTS.map((_, i) => i).sort(() => Math.random() - 0.5);
        let tintSeq = 0;
        /** running golden-angle heading sequence (random start) */
        let dirSeq = Math.random() * TAU;

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
            // size first (many tiny, some medium, a few large), depth follows from it:
            // small = far (trails the page, calmer), large = near (pinned to the page).
            const roll = Math.random();
            const band =
                roll < SIZE_SHARE.small
                    ? bands.small
                    : roll < SIZE_SHARE.small + SIZE_SHARE.medium
                      ? bands.medium
                      : bands.large;
            const size = rand(band[0], band[1]);
            const depth = clamp01((size - sizeMin) / (sizeMax - sizeMin));
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
            // Own heading over the full circle: golden-angle step + a little jitter.
            dirSeq += GOLDEN_ANGLE + rand(-0.4, 0.4);
            const dir = dirSeq % TAU;
            // Own speed: every sun different, none fast (depth only tilts the draw).
            const cruise =
                CRUISE_MIN + (CRUISE_MAX - CRUISE_MIN) * (0.4 * depth + 0.6 * Math.random());
            const mix = 0.35 * depth + 0.65 * Math.random();
            const spin = (Math.random() < 0.5 ? -1 : 1) * rand(0.03, 0.1);
            return {
                x: px,
                y: py,
                vx: Math.cos(dir) * cruise,
                vy: Math.sin(dir) * cruise,
                size,
                par,
                cruise,
                dir,
                turn: rand(-TURN_MAX, TURN_MAX),
                swayAmp: rand(0.18, 0.4),
                swayPeriod: rand(8, 15),
                swayPhase: Math.random() * TAU,
                surgePeriod: rand(14, 24),
                surgePhase: Math.random() * TAU,
                spin,
                omega: spin * (reduced ? 0.3 : 1),
                rot: Math.random() * TAU,
                alpha: Math.min(
                    ALPHA_MAX,
                    Math.max(
                        ALPHA_MIN,
                        (ALPHA_LO + (ALPHA_HI - ALPHA_LO) * mix) * TINTS[tint].boost,
                    ),
                ),
                breathPeriod: rand(9, 16),
                breathPhase: Math.random() * TAU,
                tint,
                side: Math.random() < 0.5 ? -1 : 1,
                engaged: false,
                glow: 0,
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

            const spinScale = reduced ? 0.3 : 1;
            // Pointer play stays under reduced motion (it is user-initiated), but gentler.
            const interactive = canHover;
            const cursorMax = reduced ? 0.9 : 1;

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
                    const follow = 1 - Math.exp(-dt / 0.04);
                    const nx = cursorX + (mouseX - cursorX) * follow;
                    const ny = cursorY + (mouseY - cursorY) * follow;
                    const vf = 1 - Math.exp(-dt / 0.08);
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
            cursorGain += (gainTarget - cursorGain) * (1 - Math.exp(-dt / 0.2));

            // Scroll gust: how hard the page is being stirred right now (smoothed).
            const sv = (scrollY - lastScrollY) / dt;
            lastScrollY = scrollY;
            scrollVel += (sv - scrollVel) * (1 - Math.exp(-dt / 0.18));
            const gust = reduced ? 0 : clamp01(Math.abs(scrollVel) / GUST_FULL);

            const relax = 1 - Math.exp(-dt / RELAX_S);
            const spinUp = 1 - Math.exp(-dt / 0.3);
            const spinDown = 1 - Math.exp(-dt / 1.2);
            const glowUp = 1 - Math.exp(-dt / 0.25);
            const glowDown = 1 - Math.exp(-dt / 0.9);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < suns.length; i++) {
                const s = suns[i];
                const k = kOf(s);
                const layerH = height + maxScroll * k;
                const q = s.size / ART_FILL;

                // 1) Desired velocity: own heading bent by the shared breeze, personal sway,
                //    own cruise speed. The heading itself wanders very slowly.
                s.dir += s.turn * dt;
                sampleBreeze(s.x, s.y, t);
                const heading =
                    Math.atan2(
                        Math.sin(s.dir) + WIND_WEIGHT * breeze.y,
                        Math.cos(s.dir) + WIND_WEIGHT * breeze.x,
                    ) +
                    s.swayAmp * Math.sin((t * TAU) / s.swayPeriod + s.swayPhase);
                const cruise =
                    s.cruise * (1 + SURGE * Math.sin((t * TAU) / s.surgePeriod + s.surgePhase));
                const dx = Math.cos(heading);
                const dy = Math.sin(heading);
                let tx = dx * cruise;
                let ty = dy * cruise;

                // 2) Cursor (viewport space): curl round it on the side the sun is on, nudge
                //    outward, and let the wake of a quick stroke carry it a little.
                let curl = 0;
                // near: 0..1 proximity-weighted cursor influence on this sun (drives
                // steering speed and glow); stays 0 when the cursor is away.
                let near = 0;
                if (cursorGain > 0.002) {
                    const rx = s.x - cursorX;
                    const ry = s.y - scrollY * k - cursorY;
                    const d2 = rx * rx + ry * ry;
                    if (d2 < CURSOR_RADIUS * CURSOR_RADIUS && d2 > 1) {
                        const d = Math.sqrt(d2);
                        const nx = rx / d;
                        const ny = ry / d;
                        // Plateau in the inner ~20 % so the reaction is felt across the
                        // whole zone, with a soft edge (no hard ring).
                        const w = smooth(clamp01(1.25 * (1 - d / CURSOR_RADIUS))) * cursorGain;
                        near = w;
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
                // Near the cursor the sun steers quickly (it clearly reacts); away from it,
                // slowly again — which is also what makes the return silky.
                s.glow += (near - s.glow) * (near > s.glow ? glowUp : glowDown);
                const steer =
                    near > 0.001
                        ? 1 - Math.exp(-dt / (RELAX_S - (RELAX_S - RELAX_NEAR_S) * near))
                        : relax;
                s.vx += (tx - s.vx) * steer;
                s.vy += (ty - s.vy) * steer;
                const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                if (sp > MAX_SPEED) {
                    s.vx *= MAX_SPEED / sp;
                    s.vy *= MAX_SPEED / sp;
                }
                s.x += s.vx * dt;
                s.y += s.vy * dt;

                // Spin: resting drift + a slow spin-up in the sense of the curl + a
                // scroll gust, all eased (up fast-ish, down slowly) — never a snap.
                const spinTarget =
                    s.spin * spinScale +
                    curl * SPIN_AWAKE * (reduced ? 0.8 : 1) +
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
                    s.turn = rand(-TURN_MAX, TURN_MAX);
                    s.swayPhase = Math.random() * TAU;
                    s.side = Math.random() < 0.5 ? -1 : 1;
                }

                // 6) Project page → viewport and cull.
                const sy = s.y - scrollY * k;
                const margin = q;
                if (sy < -margin || sy > height + margin || s.x < -margin || s.x > width + margin) {
                    continue;
                }
                const tiers = sprites[s.tint];
                if (!tiers || !tiers.length) continue;

                // 7) Draw: sinusoidal breath + the cursor's soft awakening (up to +GLOW).
                const intro = smooth(clamp01((now - s.born) / 1200));
                const breath = 1 + BREATH * Math.sin((t * TAU) / s.breathPeriod + s.breathPhase);
                const alpha = Math.min(ALPHA_CAP, s.alpha * breath * (1 + GLOW * s.glow)) * intro;

                const dev = q * dpr;
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
                ctx.drawImage(sprite, -q / 2, -q / 2, q, q);
            }
        };

        // ── boot ─────────────────────────────────────────────────────────────
        const img = new Image();
        img.onload = () => {
            if (disposed) return;
            sprites = TINTS.map((tint) => buildTintSprites(img, tint));
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
