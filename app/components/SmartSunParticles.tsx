import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * SmartSunParticles — the brand's drifting suns.
 *
 * How the suns move (why they never stall, and never look random)
 *  1. ONE shared, slowly evolving breeze: a divergence-free flow field built from
 *     three travelling sine waves (stream function ψ, wind = (∂ψ/∂y, −∂ψ/∂x)).
 *     Divergence-free means it never herds suns into clumps or leaves empty
 *     patches, so no pairwise repulsion is needed — the old O(n²) repulsion is
 *     what pushed suns into a dead-calm equilibrium.
 *  2. A prevailing heading (up and to the right, swinging ±30° over ~2.5 min)
 *     bent by the breeze, plus a per-sun sway: graceful S-curves, no straight lines.
 *  3. Speed is REGULATED, not integrated. Each sun steers toward a desired velocity
 *     whose length is its own cruise speed (0.30–0.70 px per 60 fps frame). Forces
 *     can bend the heading; nothing can drain the speed to zero.
 *  4. The cursor is just one more flow component: suns slide AROUND it (on the side
 *     they are already on) with a slight outward push, speeding up a little. The
 *     numbers are chosen so even a sun heading straight at it keeps ≥ 80 % of its
 *     cruise speed — it yields, it never freezes.
 *  5. Everything is time-based (px/s × dt): 60 / 120 / 144 Hz screens move alike.
 *  6. No scroll listener at all — scrolling (native or Lenis) never pauses the suns.
 * ──────────────────────────────────────────────────────────────────────────── */

interface SmartSunParticlesProps {
    /**
     * "under" (default) — site-wide backdrop at z -1 behind content.
     * "overlay" — /about brand atmosphere at z 1 above the opaque cream paper.
     *
     * Both share one motion model and never pause. Under prefers-reduced-motion
     * (the owner browses with it ON) the drift stays — owner decision — but a touch
     * calmer (×0.92, still ≥ 0.30 px/frame), with little spin and no cursor play.
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

// ── Cursor (desktop, motion allowed) ─────────────────────────────────────────
const CURSOR_RADIUS = 240;
/** px/s outward at the cursor's centre. */
const CURSOR_PUSH = 34;
/** px/s sideways at the cursor's centre — larger than the push, so suns flow AROUND it.
 *  Worst case (head-on) keeps |v| ≥ cruise · SLIDE/√(PUSH²+SLIDE²) ≈ 0.84 · cruise. */
const CURSOR_SLIDE = 52;
const MAX_DESIRED = 95;

// ── Opacity ──────────────────────────────────────────────────────────────────
const ALPHA_LO = 0.22;
const ALPHA_HI = 0.38;
/** Breathing, ± fraction of the sun's own opacity (peaks ≈ 0.45 at most). */
const BREATH = 0.12;
const ALPHA_CAP = 0.5;
const GLINT_MS = 2600;

interface Sun {
    x: number;
    y: number;
    /** px/s */
    vx: number;
    vy: number;
    /** art size, CSS px */
    size: number;
    /** personal cruise speed, px/s — always > 0 */
    cruise: number;
    /** fixed personal heading offset, rad */
    bias: number;
    swayAmp: number;
    swayPeriod: number;
    swayPhase: number;
    surgePeriod: number;
    surgePhase: number;
    /** rad/s, rad */
    spin: number;
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
    /** which way to slide round the cursor when approaching exactly head-on */
    side: 1 | -1;
    /** ms, stagger of the fade-in */
    delay: number;
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
        const count = isMobile ? (overlay ? 9 : 16) : overlay ? 22 : 34;
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
        let needsFit = true;
        const suns: Sun[] = [];
        let sprites: HTMLCanvasElement[][] = [];

        const fit = () => {
            needsFit = false;
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
            // Big change (rotate phone, resize window): keep the arrangement instead of
            // letting everything that fell outside wrap in as one column. Small changes
            // (mobile address bar) leave positions untouched, so nothing jumps.
            if (
                suns.length &&
                width > 0 &&
                height > 0 &&
                (Math.abs(w / width - 1) > 0.25 || Math.abs(h / height - 1) > 0.25)
            ) {
                for (const s of suns) {
                    s.x *= w / width;
                    s.y *= h / height;
                }
            }
            width = w;
            height = h;
            dpr = d;
        };

        // ── cursor ───────────────────────────────────────────────────────────
        let mouseX = 0;
        let mouseY = 0;
        let mouseActive = false;
        let cursorX = 0;
        let cursorY = 0;
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

        // ── seeding ──────────────────────────────────────────────────────────
        const seed = () => {
            suns.length = 0;
            // Balanced pigments in random order, so every colour is always present.
            const order = TINTS.map((_, i) => i).sort(() => Math.random() - 0.5);
            const now = performance.now();
            const scale = reduced ? REDUCED_SPEED : 1;
            for (let i = 0; i < count; i++) {
                // depth: many small/far suns, a few larger/closer ones
                const depth = Math.pow(Math.random(), 1.5);
                // Even placement: best of 6 candidates = farthest from the suns already placed.
                let px = 0;
                let py = 0;
                let far = -1;
                for (let c = 0; c < 6; c++) {
                    const cx = Math.random() * width;
                    const cy = Math.random() * height;
                    let nearest = Infinity;
                    for (const o of suns) {
                        const d2 = (o.x - cx) * (o.x - cx) + (o.y - cy) * (o.y - cy);
                        if (d2 < nearest) nearest = d2;
                    }
                    if (nearest > far) {
                        far = nearest;
                        px = cx;
                        py = cy;
                    }
                }
                const tint = order[i % order.length];
                const bias = rand(-0.3, 0.3);
                const cruise =
                    CRUISE_MIN + (CRUISE_MAX - CRUISE_MIN) * (0.7 * depth + 0.3 * Math.random());
                const mix = 0.35 * depth + 0.65 * Math.random();
                const heading = PREVAIL + bias;
                suns.push({
                    x: px,
                    y: py,
                    vx: Math.cos(heading) * cruise * scale,
                    vy: Math.sin(heading) * cruise * scale,
                    size: sizeMin + (sizeMax - sizeMin) * depth,
                    cruise,
                    bias,
                    swayAmp: rand(0.18, 0.4),
                    swayPeriod: rand(8, 15),
                    swayPhase: Math.random() * TAU,
                    surgePeriod: rand(14, 24),
                    surgePhase: Math.random() * TAU,
                    spin: (Math.random() < 0.5 ? -1 : 1) * rand(0.03, 0.1),
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
                    delay: Math.random() * 900,
                });
            }
        };

        // ── the loop ─────────────────────────────────────────────────────────
        let lastNow = -1;
        let startAt = 0;

        const frame = (now: number) => {
            if (disposed) return;
            rafId = requestAnimationFrame(frame);

            if (needsFit || getDpr() !== dpr) fit();
            if (lastNow < 0) {
                lastNow = now;
                startAt = now;
            }
            // Clamped, so a throttled / resumed tab never teleports the suns.
            const dt = Math.min(0.05, (now - lastNow) / 1000);
            lastNow = now;
            if (dt <= 0) return;
            const t = now / 1000;

            const scale = reduced ? REDUCED_SPEED : 1;
            const spinScale = reduced ? 0.3 : 1;
            const interactive = canHover && !reduced;

            // Cursor eased on both position and influence: no pops on enter / leave.
            if (interactive && mouseActive) {
                if (cursorGain < 0.01) {
                    cursorX = mouseX;
                    cursorY = mouseY;
                } else {
                    const follow = 1 - Math.exp(-dt / 0.06);
                    cursorX += (mouseX - cursorX) * follow;
                    cursorY += (mouseY - cursorY) * follow;
                }
            }
            const gainTarget = interactive && mouseActive ? 1 : 0;
            cursorGain += (gainTarget - cursorGain) * (1 - Math.exp(-dt / 0.35));

            const prevail = PREVAIL + PREVAIL_SWING * Math.sin((t * TAU) / PREVAIL_PERIOD);
            const pcx = Math.cos(prevail);
            const pcy = Math.sin(prevail);
            const relax = 1 - Math.exp(-dt / RELAX_S);
            const glowEase = 1 - Math.exp(-dt / 0.25);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < suns.length; i++) {
                const s = suns[i];

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

                // 2) Cursor: slide around it on the side the sun is already on, nudge outward.
                let glowTarget = 0;
                if (cursorGain > 0.002) {
                    const rx = s.x - cursorX;
                    const ry = s.y - cursorY;
                    const d2 = rx * rx + ry * ry;
                    if (d2 < CURSOR_RADIUS * CURSOR_RADIUS && d2 > 1) {
                        const d = Math.sqrt(d2);
                        const nx = rx / d;
                        const ny = ry / d;
                        const f = 1 - d / CURSOR_RADIUS;
                        const w = smooth(f) * cursorGain;
                        let sx = -ny;
                        let sy = nx;
                        const along = sx * dx + sy * dy;
                        const side = Math.abs(along) > 0.15 ? Math.sign(along) : s.side;
                        sx *= side;
                        sy *= side;
                        tx += (nx * CURSOR_PUSH + sx * CURSOR_SLIDE) * w;
                        ty += (ny * CURSOR_PUSH + sy * CURSOR_SLIDE) * w;
                        glowTarget = w;
                    }
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
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.rot += s.spin * spinScale * dt;
                s.glow += (glowTarget - s.glow) * glowEase;

                // 5) Endless flight: leave one edge fully, re-enter from the opposite one.
                const q = s.size / ART_FILL;
                let wrapped = false;
                if (s.x < -q) {
                    s.x = width + q;
                    wrapped = true;
                } else if (s.x > width + q) {
                    s.x = -q;
                    wrapped = true;
                }
                if (s.y < -q) {
                    s.y = height + q;
                    wrapped = true;
                } else if (s.y > height + q) {
                    s.y = -q;
                    wrapped = true;
                }
                // Off-screen anyway — a fresh personality each lap keeps the flight non-repeating.
                if (wrapped) {
                    s.bias = rand(-0.3, 0.3);
                    s.swayPhase = Math.random() * TAU;
                    s.side = Math.random() < 0.5 ? -1 : 1;
                }

                // 6) Draw: breathing opacity, cursor glow, a rare glint like sun on silk.
                const tiers = sprites[s.tint];
                if (!tiers || !tiers.length) continue;
                let glint = 0;
                if (now >= s.glintAt) {
                    const g = (now - s.glintAt) / GLINT_MS;
                    if (g < 1) glint = Math.sin(g * Math.PI);
                    else s.glintAt = now + rand(25000, 70000);
                }
                const intro = smooth(clamp01((now - startAt - s.delay) / 1200));
                const breath = 1 + BREATH * Math.sin((t * TAU) / s.breathPeriod + s.breathPhase);
                const alpha = Math.min(
                    ALPHA_CAP,
                    s.alpha * breath * (1 + 0.45 * s.glow + 0.55 * glint) * intro,
                );

                const dev = q * dpr;
                let sprite = tiers[tiers.length - 1];
                for (let k = 0; k < TIERS.length; k++) {
                    if (TIERS[k] >= dev) {
                        sprite = tiers[k];
                        break;
                    }
                }
                const c = Math.cos(s.rot) * dpr;
                const n = Math.sin(s.rot) * dpr;
                ctx.setTransform(c, n, -n, c, s.x * dpr, s.y * dpr);
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, -q / 2, -q / 2, q, q);
            }
        };

        // ── boot ─────────────────────────────────────────────────────────────
        const img = new Image();
        img.onload = () => {
            if (disposed) return;
            sprites = TINTS.map((tint) => buildTintSprites(img, tint));
            fit();
            seed();
            rafId = requestAnimationFrame(frame);
        };
        img.src = "/logo-sun.png";

        const resizeObserver = new ResizeObserver(() => {
            needsFit = true;
        });
        resizeObserver.observe(canvas);
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
