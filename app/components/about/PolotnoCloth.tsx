import { useEffect, useRef } from "react";

/**
 * Polotno — "The Living Bolt".
 *
 * The MIND BODY /about page is one continuous piece of WebGL silk. This is the
 * single persistent hero object: a full-viewport fixed canvas running a custom
 * fragment-shader cloth (luminous cream→teal satin with sliva shadow folds and
 * a travelling cream "sun" specular). Scroll writes morph TARGETS into a shared
 * ref (unroll / fold / drape / tension / settle); one rAF lerps the live
 * uniforms toward them so the cloth unrolls, gathers, drapes, pulls taut and
 * finally settles into a heavy deep-teal/plum satin for the contact close.
 *
 * Pointer pushes the silk (impulse + glint); the more the visitor MOVES (scroll
 * + pointer velocity) the harder it billows — movement is the brand. SSR-safe
 * (three is dynamically imported inside the effect → own client chunk).
 * prefers-reduced-motion / no-WebGL → one static lit frame (the CSS gradient
 * backdrop carries the rest). Full dispose + RAF pause on tab hide.
 */
export interface ClothTargets {
    /** 0→1 load reveal, driven internally (silk unrolls top→bottom). */
    unroll: number;
    /** 0→1 manifesto folds. */
    fold: number;
    /** 0→1 story drape (lean to one side). */
    drape: number;
    /** 0→1 process taut vertical seams. */
    tension: number;
    /** 0→1 contact: darken to deep-teal/plum satin. */
    settle: number;
    /** 0→1 local darken hint (reserved; legibility handled in CSS). */
    dark: number;
    /** 0→~1 energy from scroll velocity → turbulence amplitude/speed. */
    scrollVel: number;
}

export function makeClothTargets(): ClothTargets {
    return { unroll: 0, fold: 0, drape: 0, tension: 0, settle: 0, dark: 0, scrollVel: 0 };
}

const VERT = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uAspect, uDown, uUnroll, uFold, uDrape, uTension, uSettle, uVel;
uniform vec2 uMouse;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }

float H(vec2 p, float t, float fold, float drape, float tension){
    p.x += drape * 0.25 * (p.y - 0.5);
    vec2 q = vec2(fbm(p * 2.0 + t), fbm(p * 2.0 + vec2(5.2, 1.3) - t));
    float base = fbm(p * 3.0 + q * (1.3 + fold * 1.4) + vec2(0.0, t * 1.8));
    float seams = sin(p.x * (5.0 + tension * 12.0)) * tension * 0.14;
    float folds = fold * 0.28 * sin(p.y * 5.0 + base * 4.0);
    return base + seams + folds;
}

void main(){
    float t = uTime * 0.09 * (0.7 + 0.9 * uVel);
    vec2 p = vUv; p.x *= uAspect;

    float md = 0.0;
    if (uMouse.x >= 0.0) {
        vec2 mp = vec2(uMouse.x * uAspect, uMouse.y);
        float d = distance(p, mp);
        md = exp(-d * d * 20.0) * (0.5 + 0.9 * uDown);
    }

    float fold = uFold + uSettle * 0.4;
    float h = H(p, t, fold, uDrape, uTension) + md * 0.2 + uVel * 0.05 * fbm(p * 5.0 + t);
    float e = 0.0027;
    float hx = H(p + vec2(e, 0.0), t, fold, uDrape, uTension) - H(p - vec2(e, 0.0), t, fold, uDrape, uTension);
    float hy = H(p + vec2(0.0, e), t, fold, uDrape, uTension) - H(p - vec2(0.0, e), t, fold, uDrape, uTension);
    vec3 nrm = normalize(vec3(-hx, -hy, e * 8.0));

    vec3 L = normalize(vec3(0.4, 0.55, 0.78));
    float diff = clamp(dot(nrm, L) * 0.6 + 0.42, 0.0, 1.0);
    float spec = pow(max(dot(reflect(-L, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 26.0);
    float sweep = smoothstep(0.13, 0.0, abs(vUv.x - fract(uTime * 0.045)));

    vec3 creamHi = vec3(0.985, 0.965, 0.930);
    vec3 cream   = vec3(0.925, 0.895, 0.850);
    vec3 teal    = vec3(0.320, 0.490, 0.480);
    vec3 tealDk  = vec3(0.140, 0.330, 0.330);
    vec3 sliva   = vec3(0.280, 0.220, 0.400);

    vec3 lightCol = mix(tealDk, cream, smoothstep(0.22, 0.78, diff));
    lightCol = mix(lightCol, creamHi, smoothstep(0.82, 1.0, diff));
    lightCol = mix(sliva * 0.9, lightCol, smoothstep(0.0, 0.30, diff));

    vec3 darkCol = mix(vec3(0.05, 0.12, 0.13), vec3(0.16, 0.40, 0.40), smoothstep(0.2, 0.85, diff));
    darkCol = mix(vec3(0.12, 0.08, 0.18), darkCol, smoothstep(0.0, 0.40, diff));

    vec3 col = mix(lightCol, darkCol, uSettle);
    col += mix(creamHi, vec3(0.98, 0.93, 0.82), uSettle) * (spec * 0.7 + sweep * 0.22 * diff + md * 0.6);

    float reveal = smoothstep((1.0 - uUnroll) - 0.14, (1.0 - uUnroll) + 0.02, vUv.y);
    vec3 voidCol = mix(vec3(0.965, 0.945, 0.910), vec3(0.05, 0.12, 0.13), uSettle);
    col = mix(voidCol, col, reveal);

    float vig = smoothstep(1.3, 0.3, distance(vUv, vec2(0.5)));
    col *= 0.92 + 0.08 * vig;

    gl_FragColor = vec4(col, 1.0);
}`;

export function PolotnoCloth({ targetsRef }: { targetsRef: React.MutableRefObject<ClothTargets> }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let disposed = false;
        let cleanup: (() => void) | null = null;

        import("three")
            .then((THREE) => {
                if (disposed || !canvas) return;

                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

                let renderer: import("three").WebGLRenderer;
                try {
                    renderer = new THREE.WebGLRenderer({
                        canvas,
                        antialias: true,
                        alpha: false,
                        powerPreference: "high-performance",
                    });
                } catch (err) {
                    console.error("[Polotno] WebGL unavailable:", err);
                    return; // CSS gradient backdrop carries the page
                }
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                const scene = new THREE.Scene();
                const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

                const uniforms = {
                    uTime: { value: 0 },
                    uAspect: { value: 1 },
                    uMouse: { value: new THREE.Vector2(-1, -1) },
                    uDown: { value: 0 },
                    uUnroll: { value: 0 },
                    uFold: { value: 0 },
                    uDrape: { value: 0 },
                    uTension: { value: 0 },
                    uSettle: { value: 0 },
                    uVel: { value: 0 },
                };

                const material = new THREE.ShaderMaterial({
                    uniforms,
                    vertexShader: VERT,
                    fragmentShader: FRAG,
                });
                const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
                scene.add(quad);

                const size = () => {
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    renderer.setSize(w, h, false);
                    uniforms.uAspect.value = w / h;
                };
                size();

                // ── Pointer (smoothed push + velocity) ───────────────────
                const mouse = new THREE.Vector2(-1, -1);
                const mTarget = new THREE.Vector2(-1, -1);
                let pointerVel = 0;
                let lastMove = performance.now();
                const onMove = (e: PointerEvent) => {
                    const nx = e.clientX / window.innerWidth;
                    const ny = 1 - e.clientY / window.innerHeight;
                    if (mTarget.x >= 0) {
                        pointerVel = Math.min(
                            1,
                            pointerVel + Math.hypot(nx - mTarget.x, ny - mTarget.y) * 6,
                        );
                    }
                    mTarget.set(nx, ny);
                    lastMove = performance.now();
                };
                const onDown = () => {
                    uniforms.uDown.value = 1;
                };
                const onUp = () => {
                    uniforms.uDown.value = 0;
                };
                window.addEventListener("pointermove", onMove, { passive: true });
                window.addEventListener("pointerdown", onDown, { passive: true });
                window.addEventListener("pointerup", onUp, { passive: true });
                window.addEventListener("resize", size);

                const clock = new THREE.Clock();
                const t0 = performance.now();
                let raf = 0;
                const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

                const render = () => {
                    uniforms.uTime.value = clock.getElapsedTime();

                    // Load unroll: ease-out cubic over ~1.3s, top→bottom.
                    const el = (performance.now() - t0) / 1300;
                    uniforms.uUnroll.value = el >= 1 ? 1 : 1 - Math.pow(1 - Math.min(el, 1), 3);

                    const tg = targetsRef.current;
                    uniforms.uFold.value = lerp(uniforms.uFold.value, tg.fold, 0.06);
                    uniforms.uDrape.value = lerp(uniforms.uDrape.value, tg.drape, 0.06);
                    uniforms.uTension.value = lerp(uniforms.uTension.value, tg.tension, 0.06);
                    uniforms.uSettle.value = lerp(uniforms.uSettle.value, tg.settle, 0.05);

                    // Energy: pointer + scroll velocity, decaying.
                    pointerVel *= 0.92;
                    const energy = Math.min(1, pointerVel + (tg.scrollVel || 0));
                    uniforms.uVel.value = lerp(uniforms.uVel.value, energy, 0.1);

                    // Fade the pointer out after it stops moving.
                    if (performance.now() - lastMove > 1400) mTarget.set(-1, -1);
                    if (mTarget.x < 0) {
                        mouse.set(-1, -1);
                    } else if (mouse.x < 0) {
                        mouse.copy(mTarget);
                    } else {
                        mouse.lerp(mTarget, 0.12);
                    }
                    uniforms.uMouse.value.copy(mouse);

                    renderer.render(scene, camera);
                    if (!disposed) raf = requestAnimationFrame(render);
                };

                if (reduce) {
                    uniforms.uUnroll.value = 1;
                    uniforms.uTime.value = 2.0;
                    uniforms.uFold.value = 0.35;
                    renderer.render(scene, camera);
                } else {
                    raf = requestAnimationFrame(render);
                }

                const onVis = () => {
                    if (document.hidden) {
                        cancelAnimationFrame(raf);
                    } else if (!reduce && !disposed) {
                        raf = requestAnimationFrame(render);
                    }
                };
                document.addEventListener("visibilitychange", onVis);

                cleanup = () => {
                    cancelAnimationFrame(raf);
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerdown", onDown);
                    window.removeEventListener("pointerup", onUp);
                    window.removeEventListener("resize", size);
                    document.removeEventListener("visibilitychange", onVis);
                    quad.geometry.dispose();
                    material.dispose();
                    renderer.dispose();
                };
            })
            .catch((err) => {
                console.error("[Polotno] three load failed:", err);
            });

        return () => {
            disposed = true;
            cleanup?.();
        };
    }, [targetsRef]);

    return <canvas ref={canvasRef} className="polotno-cloth__canvas" aria-hidden="true" />;
}

export default PolotnoCloth;
