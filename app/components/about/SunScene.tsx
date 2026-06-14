import { useEffect, useRef } from "react";

/**
 * MIND BODY "living sun" — a WebGL particle emblem for the /about hero.
 *
 * SSR-safe: three.js is dynamically imported INSIDE the effect, so it never
 * enters the server bundle and ships as its own client chunk. Thousands of
 * GPU particles (a dense core + radiating rays) breathe, swirl, glow with
 * additive blending, drift with the pointer and disperse as you scroll past
 * the hero. Respects prefers-reduced-motion (renders a single static frame)
 * and thins the particle count on small screens.
 */
export function SunScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let disposed = false;
        let cleanup: (() => void) | null = null;

        import("three")
            .then((THREE) => {
                if (disposed || !canvas) return;

                const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                const isMobile = window.innerWidth < 768;

                const renderer = new THREE.WebGLRenderer({
                    canvas,
                    antialias: true,
                    alpha: true,
                    powerPreference: "high-performance",
                });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                const sizeOf = () => {
                    const r = canvas.getBoundingClientRect();
                    return { w: r.width || window.innerWidth, h: r.height || window.innerHeight };
                };
                let { w, h } = sizeOf();
                renderer.setSize(w, h, false);

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
                camera.position.set(0, 0, 5.2);

                // ── Build the particle field ─────────────────────────────
                const CORE = isMobile ? 2600 : 5200;
                const RAYS = 18;
                const PER_RAY = isMobile ? 70 : 150;
                const total = CORE + RAYS * PER_RAY;

                const positions = new Float32Array(total * 3);
                const colors = new Float32Array(total * 3);
                const scales = new Float32Array(total);
                const phases = new Float32Array(total);

                // Brand palette stops: warm core → teal edge.
                const cCore = new THREE.Color("#f6ead2"); // warm cream-gold
                const cMid = new THREE.Color("#6fb7b1"); // light teal
                const cEdge = new THREE.Color("#2a5a5a"); // brand teal
                const tmp = new THREE.Color();

                const setColorByRadius = (i: number, radius: number) => {
                    const t = Math.min(radius / 2.6, 1);
                    if (t < 0.5) tmp.copy(cCore).lerp(cMid, t / 0.5);
                    else tmp.copy(cMid).lerp(cEdge, (t - 0.5) / 0.5);
                    colors[i * 3] = tmp.r;
                    colors[i * 3 + 1] = tmp.g;
                    colors[i * 3 + 2] = tmp.b;
                };

                let p = 0;
                // Dense glowing core — particles packed toward the centre.
                for (let i = 0; i < CORE; i++) {
                    const u = Math.random();
                    const radius = Math.pow(u, 1.7) * 1.55; // bias inward
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const flat = 0.45; // slightly disc-like
                    const x = radius * Math.sin(phi) * Math.cos(theta);
                    const y = radius * Math.sin(phi) * Math.sin(theta);
                    const z = radius * Math.cos(phi) * flat;
                    positions[p * 3] = x;
                    positions[p * 3 + 1] = y;
                    positions[p * 3 + 2] = z;
                    setColorByRadius(p, radius);
                    scales[p] = 0.5 + Math.random() * 1.3;
                    phases[p] = Math.random() * Math.PI * 2;
                    p++;
                }
                // Radiating wavy rays — the "sun" silhouette.
                for (let r = 0; r < RAYS; r++) {
                    const base = (r / RAYS) * Math.PI * 2;
                    for (let k = 0; k < PER_RAY; k++) {
                        const t = k / PER_RAY;
                        const radius = 1.4 + t * 1.2;
                        const wave = Math.sin(t * Math.PI * 3) * 0.12 * (1 - t);
                        const ang = base + wave;
                        const spread = (Math.random() - 0.5) * 0.06;
                        positions[p * 3] = Math.cos(ang) * radius + spread;
                        positions[p * 3 + 1] = Math.sin(ang) * radius + spread;
                        positions[p * 3 + 2] = (Math.random() - 0.5) * 0.15;
                        setColorByRadius(p, radius);
                        scales[p] = (0.4 + Math.random() * 0.8) * (1 - t * 0.6);
                        phases[p] = Math.random() * Math.PI * 2;
                        p++;
                    }
                }

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
                geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
                geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

                const uniforms = {
                    uTime: { value: 0 },
                    uScroll: { value: 0 },
                    uSize: { value: (isMobile ? 16 : 26) * Math.min(window.devicePixelRatio, 2) },
                };

                const material = new THREE.ShaderMaterial({
                    uniforms,
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    vertexShader: `
                        uniform float uTime;
                        uniform float uScroll;
                        uniform float uSize;
                        attribute float aScale;
                        attribute float aPhase;
                        attribute vec3 aColor;
                        varying vec3 vColor;
                        varying float vAlpha;
                        void main() {
                            vColor = aColor;
                            vec3 pos = position;
                            float breath = sin(uTime * 0.8 + aPhase) * 0.05;
                            pos *= 1.0 + breath;
                            pos *= 1.0 + uScroll * 0.7;
                            float a = uTime * 0.04;
                            mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
                            pos.xy = rot * pos.xy;
                            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                            gl_Position = projectionMatrix * mv;
                            float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aPhase * 3.0);
                            gl_PointSize = uSize * aScale * twinkle * (1.0 / -mv.z);
                            vAlpha = (1.0 - uScroll) * (1.0 - uScroll);
                        }
                    `,
                    fragmentShader: `
                        varying vec3 vColor;
                        varying float vAlpha;
                        void main() {
                            float d = length(gl_PointCoord - vec2(0.5));
                            float alpha = smoothstep(0.5, 0.0, d);
                            alpha = pow(alpha, 1.7);
                            gl_FragColor = vec4(vColor, alpha * vAlpha);
                        }
                    `,
                });

                const points = new THREE.Points(geo, material);
                scene.add(points);

                // ── Interaction ──────────────────────────────────────────
                const mouse = { x: 0, y: 0 };
                const target = { x: 0, y: 0 };
                const onPointer = (e: PointerEvent) => {
                    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
                    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
                };
                const onScroll = () => {
                    uniforms.uScroll.value = Math.min(window.scrollY / window.innerHeight, 1);
                };
                const onResize = () => {
                    ({ w, h } = sizeOf());
                    renderer.setSize(w, h, false);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                };
                window.addEventListener("pointermove", onPointer, { passive: true });
                window.addEventListener("scroll", onScroll, { passive: true });
                window.addEventListener("resize", onResize);
                onScroll();

                // ── Render loop ──────────────────────────────────────────
                const clock = new THREE.Clock();
                let raf = 0;
                const renderOnce = () => {
                    points.rotation.x = mouse.y * 0.18;
                    points.rotation.y = mouse.x * 0.18;
                    renderer.render(scene, camera);
                };
                const tick = () => {
                    uniforms.uTime.value = clock.getElapsedTime();
                    mouse.x += (target.x - mouse.x) * 0.04;
                    mouse.y += (target.y - mouse.y) * 0.04;
                    renderOnce();
                    raf = requestAnimationFrame(tick);
                };

                if (reduceMotion) {
                    uniforms.uTime.value = 1.2;
                    renderOnce();
                } else {
                    raf = requestAnimationFrame(tick);
                }

                cleanup = () => {
                    cancelAnimationFrame(raf);
                    window.removeEventListener("pointermove", onPointer);
                    window.removeEventListener("scroll", onScroll);
                    window.removeEventListener("resize", onResize);
                    geo.dispose();
                    material.dispose();
                    renderer.dispose();
                };
            })
            .catch((e) => {
                // WebGL/three failed to load — the CSS hero gradient + logo
                // still render, so this degrades gracefully.
                console.error("[SunScene] failed:", e);
            });

        return () => {
            disposed = true;
            cleanup?.();
        };
    }, []);

    return <canvas ref={canvasRef} className="about-sun__canvas" aria-hidden="true" />;
}

export default SunScene;
