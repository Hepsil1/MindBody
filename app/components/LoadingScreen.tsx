import React, { useEffect, useState } from 'react';

export function LoadingScreen() {
    const [isVisible, setIsVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        // Hide loader once DOM is interactive (don't wait for all images/fonts)
        const handleReady = () => {
            setIsVisible(false);
        };

        // If DOM is already ready, hide immediately
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            handleReady();
        } else {
            document.addEventListener('DOMContentLoaded', handleReady);
        }

        // Failsafe: always hide after 3 seconds max
        const maxTimer = setTimeout(() => {
            setIsVisible(false);
        }, 3000);

        return () => {
            document.removeEventListener('DOMContentLoaded', handleReady);
            clearTimeout(maxTimer);
        };
    }, []);

    useEffect(() => {
        if (!isVisible) {
            // Wait for fade out animation to finish before unmounting
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 800); // Match transition duration (0.8s)
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                // Premium Upgrade: Subtle Radial Gradient for Depth
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #F4F2ED 100%)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isVisible ? 1 : 0,
                transition: 'opacity 0.8s ease-in-out', // Smoother fade out
                pointerEvents: isVisible ? 'all' : 'none',
            }}
        >
            {/* Upgrade: Breathing Container */}
            <div style={{ animation: 'breathe 3s ease-in-out infinite alternate' }}>
                <img
                    src="/brand-sun.png"
                    alt="Loading..."
                    style={{
                        width: '90px',
                        height: '90px',
                        // High energy rotation
                        animation: 'spin 3s linear infinite',
                    }}
                />
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes breathe {
          0% { transform: scale(0.9); opacity: 0.9; }
          100% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
