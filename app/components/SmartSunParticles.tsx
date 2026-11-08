import { useEffect, useRef } from "react";

interface SmartSunParticlesProps {
    /**
     * "under" (default) — site-wide backdrop at z -1 behind content, drifting in
     * brand garment tints. Runs on mobile & desktop, maintaining a calm, slow
     * ambient drift even with prefers-reduced-motion (at 0.3x speed with mouse repulsion off).
     * "overlay" — /about brand atmosphere at z 1 above the opaque cream paper.
     */
    variant?: "under" | "overlay";
}

export default function SmartSunParticles({ variant = "under" }: SmartSunParticlesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlay = variant === "overlay";

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let disposed = false;
        const hasReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Calm slow drift even with reduced-motion (intentional quiet brand atmosphere)
        const motionFactor = hasReducedMotion ? 0.3 : 1;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const isMobile = window.innerWidth <= 768;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const sunImage = new Image();
        sunImage.src = "/logo-sun.png";

        // Brand garment tints — teal, marsala/plum, warm ochre, soft lavender.
        // Applied across all particle variants for a unified quiet-luxury atmosphere.
        const TINTS = ["#0f766e", "#722f37", "#b45309", "#8b7bb8"];
        const tinted: HTMLCanvasElement[] = [];
        const buildTints = () => {
            for (const color of TINTS) {
                const c = document.createElement("canvas");
                c.width = sunImage.naturalWidth;
                c.height = sunImage.naturalHeight;
                const cctx = c.getContext("2d");
                if (!cctx) continue;
                cctx.drawImage(sunImage, 0, 0);
                cctx.globalCompositeOperation = "source-in";
                cctx.fillStyle = color;
                cctx.fillRect(0, 0, c.width, c.height);
                tinted.push(c);
            }
        };

        interface SunParticle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            rotation: number;
            rotSpeed: number;
            alpha: number;
            /** index into `tinted`, or -1 = the original art */
            tint: number;
        }
        const particles: SunParticle[] = [];
        // Shared physics across under and overlay: free-floating particles drifting,
        // wrapping, and repelling. Overlay has more (smaller) suns drifting at ~40% speed.
        const numParticles = isMobile ? (overlay ? 9 : 16) : overlay ? 22 : 34;
        const speedMul = (overlay ? 0.4 : 0.7) * motionFactor;

        let mouseX = -1000;
        let mouseY = -1000;
        let animationFrameId: number;
        let isScrolling = false;
        let scrollTimeout: ReturnType<typeof setTimeout>;

        sunImage.onload = () => {
            if (disposed) return;
            buildTints();
            for (let i = 0; i < numParticles; i++) {
                // SMALL/MEDIUM brand suns with gentle presence
                const size = overlay
                    ? isMobile
                        ? Math.random() * 30 + 26
                        : Math.random() * 56 + 34
                    : isMobile
                      ? Math.random() * 30 + 30
                      : Math.random() * 60 + 36;
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * (isMobile ? 0.25 : 0.4) * speedMul,
                    vy: (Math.random() - 0.5) * (isMobile ? 0.25 : 0.4) * speedMul,
                    size,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * (isMobile ? 0.003 : 0.005) * speedMul,
                    // Brand tints with soft, calm presence on cream paper
                    alpha: overlay ? Math.random() * 0.12 + 0.08 : Math.random() * 0.08 + 0.07,
                    // Cycle through the brand tints so all colours are present site-wide
                    tint: tinted.length > 0 ? i % tinted.length : -1,
                });
            }
            render();
        };

        const render = () => {
            if (disposed) return;
            animationFrameId = requestAnimationFrame(render);

            // Overlay never pauses on scroll; under pauses gently during fast scrolling to conserve CPU.
            if (isScrolling && !overlay) return;

            ctx.clearRect(0, 0, width, height);

            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotSpeed;

                // Mouse repulsion — desktop only, disabled under reduced-motion
                if (!isMobile && !hasReducedMotion) {
                    const dx = mouseX - p.x;
                    const dy = mouseY - p.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 300) {
                        const force = (300 - distance) / 300;
                        p.vx -= (dx / distance) * force * 0.08;
                        p.vy -= (dy / distance) * force * 0.08;
                    }
                }

                // Particle repulsion — desktop only (O(n²), skip on mobile), scaled by motionFactor
                if (!isMobile) {
                    particles.forEach((p2, j) => {
                        if (i !== j) {
                            const dx2 = p2.x - p.x;
                            const dy2 = p2.y - p.y;
                            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                            if (dist2 < 280) {
                                const force2 = (280 - dist2) / 280;
                                p.vx -= (dx2 / dist2) * force2 * 0.015 * motionFactor;
                                p.vy -= (dy2 / dist2) * force2 * 0.015 * motionFactor;
                            }
                        }
                    });
                }

                // Velocity damping (scaled by speedMul so overlay's slower
                // particles settle into their own slower range, not home's).
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const maxSpeed = (isMobile ? 0.8 : 1.2) * speedMul;
                const minSpeed = (isMobile ? 0.08 : 0.15) * speedMul;
                if (speed > maxSpeed) {
                    p.vx *= 0.96;
                    p.vy *= 0.96;
                } else if (speed < minSpeed) {
                    p.vx += (Math.random() - 0.5) * 0.02 * speedMul;
                    p.vy += (Math.random() - 0.5) * 0.02 * speedMul;
                }

                // Wrap around edges
                const margin = p.size;
                if (p.x < -margin) p.x = width + margin;
                if (p.x > width + margin) p.x = -margin;
                if (p.y < -margin) p.y = height + margin;
                if (p.y > height + margin) p.y = -margin;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.globalAlpha = p.alpha;
                const art = p.tint >= 0 ? tinted[p.tint] : sunImage;
                ctx.drawImage(art, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });
        };

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        const handleMouseLeave = () => {
            mouseX = -1000;
            mouseY = -1000;
        };

        const handleScroll = () => {
            isScrolling = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(
                () => {
                    isScrolling = false;
                },
                isMobile ? 300 : 150,
            );
        };

        window.addEventListener("resize", handleResize, { passive: true });
        if (!isMobile) {
            window.addEventListener("mousemove", handleMouseMove, { passive: true });
            window.addEventListener("mouseout", handleMouseLeave, { passive: true });
        }
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            disposed = true;
            window.removeEventListener("resize", handleResize);
            if (!isMobile) {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseout", handleMouseLeave);
            }
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(scrollTimeout);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [overlay]);

    return (
        <canvas
            ref={canvasRef}
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
