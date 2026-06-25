import { useEffect } from "react";
import type Lenis from "lenis";

/**
 * Lenis smooth-scroll, scoped to whatever page mounts it. Dynamically imported
 * (SSR-safe) and destroyed on unmount so pages that DON'T call it keep native
 * scrolling. Respects prefers-reduced-motion. Lenis adds its own `lenis`
 * classes to <html>; the page CSS (or about-page.css) styles them.
 */
export function useSmoothScroll(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        // Skip Lenis on touch devices. Phones/tablets already have smooth,
        // GPU-accelerated momentum scrolling; layering Lenis's per-frame RAF on
        // top fought with the heavy home sections (the Instagram iPhone block)
        // and caused scroll stutter/lag. Desktop (fine pointer) keeps Lenis.
        if (window.matchMedia("(pointer: coarse)").matches) return;

        let lenis: Lenis | null = null;
        let rafId = 0;
        let cancelled = false;

        import("lenis")
            .then(({ default: LenisCtor }) => {
                if (cancelled) return;
                lenis = new LenisCtor({ lerp: 0.09, wheelMultiplier: 1, touchMultiplier: 1.4 });
                const raf = (time: number) => {
                    lenis?.raf(time);
                    rafId = requestAnimationFrame(raf);
                };
                rafId = requestAnimationFrame(raf);
            })
            .catch(() => {});

        return () => {
            cancelled = true;
            if (rafId) cancelAnimationFrame(rafId);
            lenis?.destroy();
        };
    }, [enabled]);
}
