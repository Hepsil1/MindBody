import React, { useEffect, useState } from 'react';
import '../styles/loading-screen.css';

export function LoadingScreen() {
    const [isVisible, setIsVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        // Hide immediately once React hydrates — the page is ready
        // Use requestAnimationFrame to ensure at least one paint happened
        requestAnimationFrame(() => {
            setIsVisible(false);
        });

        // Absolute failsafe: 1.5s max (was 3s)
        const maxTimer = setTimeout(() => {
            setIsVisible(false);
        }, 1500);

        return () => {
            clearTimeout(maxTimer);
        };
    }, []);

    useEffect(() => {
        if (!isVisible) {
            // Shorter fade: 400ms (was 800ms)
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender) return null;

    return (
        <div className={`loading-screen ${!isVisible ? 'loading-screen--hidden' : ''}`}>
            <div className="loading-screen__container">
                <div className="loading-screen__pulse"></div>
                <img
                    src="/brand-sun.png"
                    alt="Loading..."
                    className="loading-screen__logo"
                />
            </div>
        </div>
    );
}
