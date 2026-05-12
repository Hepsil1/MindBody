import { useEffect, useState } from "react";
import { Link } from "react-router";

const STORAGE_KEY = "mb_cookies_consent_v1";

export function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) setVisible(true);
        } catch {
            // private mode / SSR — keep hidden
        }
    }, []);

    const accept = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: Date.now() })); } catch {}
        setVisible(false);
    };

    const decline = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, at: Date.now() })); } catch {}
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            className="cookie-banner"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cookie-banner-title"
            aria-describedby="cookie-banner-desc"
        >
            <div className="cookie-banner__inner">
                <div className="cookie-banner__text">
                    <strong id="cookie-banner-title">Ми використовуємо cookies</strong>
                    <p id="cookie-banner-desc">
                        Щоб сайт працював коректно та ставав зручнішим. Деталі — у{" "}
                        <Link to="/privacy">Політиці конфіденційності</Link>.
                    </p>
                </div>
                <div className="cookie-banner__actions">
                    <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={decline}>
                        Лише необхідні
                    </button>
                    <button type="button" className="cookie-banner__btn cookie-banner__btn--primary" onClick={accept}>
                        Прийняти
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CookieBanner;
