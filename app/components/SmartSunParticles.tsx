import { useEffect, useRef } from "react";

export default function SmartSunParticles() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Respect user's motion preference
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const isMobile = window.innerWidth <= 768;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const sunImage = new Image();
        sunImage.src = "/logo-sun.png";

        const particles: any[] = [];
        // Mobile: fewer, smaller particles for battery & GPU savings
        const numParticles = isMobile ? 5 : 12;

        let mouseX = -1000;
        let mouseY = -1000;
        let animationFrameId: number;
        let isScrolling = false;
        let scrollTimeout: any;

        sunImage.onload = () => {
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * (isMobile ? 0.25 : 0.4),
                    vy: (Math.random() - 0.5) * (isMobile ? 0.25 : 0.4),
                    // Mobile: smaller particles (60-130px vs 80-230px desktop)
                    size: isMobile ? Math.random() * 70 + 60 : Math.random() * 150 + 80,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * (isMobile ? 0.003 : 0.005),
                    alpha: Math.random() * 0.08 + 0.02,
                });
            }
            render();
        };

        const render = () => {
            animationFrameId = requestAnimationFrame(render);

            if (isScrolling) return;

            ctx.clearRect(0, 0, width, height);

            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotSpeed;

                // Mouse repulsion — desktop only (no mouse on mobile)
                if (!isMobile) {
                    const dx = mouseX - p.x;
                    const dy = mouseY - p.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 300) {
                        const force = (300 - distance) / 300;
                        p.vx -= (dx / distance) * force * 0.08;
                        p.vy -= (dy / distance) * force * 0.08;
                    }
                }

                // Particle repulsion — desktop only (O(n²), skip on mobile)
                if (!isMobile) {
                    particles.forEach((p2, j) => {
                        if (i !== j) {
                            const dx2 = p2.x - p.x;
                            const dy2 = p2.y - p.y;
                            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                            if (dist2 < 280) {
                                const force2 = (280 - dist2) / 280;
                                p.vx -= (dx2 / dist2) * force2 * 0.015;
                                p.vy -= (dy2 / dist2) * force2 * 0.015;
                            }
                        }
                    });
                }

                // Velocity damping
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const maxSpeed = isMobile ? 0.8 : 1.2;
                const minSpeed = isMobile ? 0.08 : 0.15;
                if (speed > maxSpeed) {
                    p.vx *= 0.96;
                    p.vy *= 0.96;
                } else if (speed < minSpeed) {
                    p.vx += (Math.random() - 0.5) * 0.02;
                    p.vy += (Math.random() - 0.5) * 0.02;
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
                ctx.drawImage(sunImage, -p.size / 2, -p.size / 2, p.size, p.size);
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
            window.removeEventListener("resize", handleResize);
            if (!isMobile) {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseout", handleMouseLeave);
            }
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(scrollTimeout);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: -1,
            }}
        />
    );
}
