import { useEffect, useState } from "react";
import "../styles/loading-screen.css";

export function LoadingScreen() {
    const [isVisible, setIsVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        const hide = () => setIsVisible(false);

        // Hide after hydration — double-rAF guarantees at least one paint
        requestAnimationFrame(() => requestAnimationFrame(hide));

        // Hard cap: if page takes longer than 2.5s, force-hide anyway
        const maxTimer = setTimeout(hide, 2500);

        // Also hide if the document becomes interactive (handles slow loaders)
        const onReady = () => {
            if (document.readyState === "complete" || document.readyState === "interactive") {
                hide();
            }
        };
        document.addEventListener("readystatechange", onReady);

        return () => {
            clearTimeout(maxTimer);
            document.removeEventListener("readystatechange", onReady);
        };
    }, []);

    useEffect(() => {
        if (!isVisible) {
            const timer = setTimeout(() => setShouldRender(false), 350);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender) return null;

    return (
        // The inline backstop script in root.tsx hides this element by setting its
        // style (opacity/visibility/pointer-events) directly on the DOM — which may
        // run before React hydrates. suppressHydrationWarning tells React that this
        // one element's attributes are intentionally mutated outside it, so the
        // (expected) style mismatch isn't reported on every page load.
        <div
            className={`loading-screen ${!isVisible ? "loading-screen--hidden" : ""}`}
            suppressHydrationWarning
        >
            <div className="loading-screen__container">
                <img
                    src="/brand-sun.webp"
                    alt=""
                    width={72}
                    height={72}
                    className="loading-screen__logo"
                />
            </div>
        </div>
    );
}
