import { useEffect, useState } from "react";
import { useI18n, LLink } from "../i18n";

const STORAGE_KEY = "mb_cookies_consent_v1";

export function CookieBanner() {
    const { t } = useI18n();
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
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: Date.now() }));
        } catch {}
        // Notify <Analytics> in the same render so GA4/Pixel come up
        // without a reload — the listener over there calls
        // ensureAnalyticsLoaded() and reads the storage flag we just
        // wrote. Keep the literal in sync with utils/analytics.client.ts.
        try {
            window.dispatchEvent(new CustomEvent("mb-cookies-accepted"));
        } catch {}
        setVisible(false);
    };

    const decline = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, at: Date.now() }));
        } catch {}
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
                    <strong id="cookie-banner-title">{t("Ми використовуємо cookies")}</strong>
                    <p id="cookie-banner-desc">
                        {t("Щоб сайт працював коректно та ставав зручнішим. Деталі — у")}{" "}
                        <LLink to="/privacy">{t("Політиці конфіденційності")}</LLink>.
                    </p>
                </div>
                <div className="cookie-banner__actions">
                    <button
                        type="button"
                        className="cookie-banner__btn cookie-banner__btn--ghost"
                        onClick={decline}
                    >
                        {t("Лише необхідні")}
                    </button>
                    <button
                        type="button"
                        className="cookie-banner__btn cookie-banner__btn--primary"
                        onClick={accept}
                    >
                        {t("Прийняти")}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CookieBanner;
