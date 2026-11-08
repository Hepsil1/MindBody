import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
    LOCALES,
    LOCALE_NAMES,
    LOCALE_SHORT,
    type Locale,
    localizePath,
    setLocaleCookie,
    useI18n,
} from "../i18n";
import "../styles/language-gate.css";

/**
 * First-visit language chooser. The root loader decides whether to mount it
 * (no mb_locale cookie + not a bot); after a choice the cookie is set and the
 * gate never shows again. On desktop: centered modal dialog.
 * On mobile (≤768px): non-blocking bottom banner that does NOT intercept taps
 * on the rest of the site and auto-dismisses on outside interaction.
 */
export function LanguageGate() {
    const [visible, setVisible] = useState(false);
    const [done, setDone] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { locale: current, t } = useI18n();
    const cardRef = useRef<HTMLDivElement>(null);

    // SSR-safe media query check
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener?.("change", handler);
        return () => mq.removeEventListener?.("change", handler);
    }, []);

    useEffect(() => {
        // LoadingScreen hides ~right after hydration (350 ms fade) — wait it out.
        const id = setTimeout(() => setVisible(true), 900);
        return () => clearTimeout(id);
    }, []);

    // Desktop only: autofocus on active choice
    useEffect(() => {
        if (!visible || done || isMobile) return;
        cardRef.current?.querySelector<HTMLButtonElement>("button[data-active='true']")?.focus();
    }, [visible, done, isMobile]);

    const choose = (locale: Locale, navigateIfDifferent = true) => {
        setLocaleCookie(locale);
        setDone(true);
        if (navigateIfDifferent && locale !== current) {
            navigate(localizePath(location.pathname + location.search, locale));
        }
    };

    // Desktop only: Escape = keep current language
    useEffect(() => {
        if (!visible || done || isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") choose(current);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, done, current, isMobile]);

    // Mobile only: dismiss without locking cookie when user taps outside the banner
    useEffect(() => {
        if (!visible || done || !isMobile) return;
        const handleOutside = (e: PointerEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                // User interacted with the site - quietly dismiss banner without forcing a permanent cookie
                setDone(true);
            }
        };
        window.addEventListener("pointerdown", handleOutside, { capture: true, passive: true });
        return () => window.removeEventListener("pointerdown", handleOutside, { capture: true });
    }, [visible, done, isMobile]);

    if (done) return null;

    if (isMobile) {
        return (
            <aside
                className={`lang-gate lang-gate--mobile ${visible ? "lang-gate--visible" : ""}`}
                role="region"
                aria-label={t("Оберіть мову")}
            >
                <div className="lang-gate__card" ref={cardRef}>
                    <div className="lang-gate__mobile-info">
                        <img
                            src="/brand-sun.webp"
                            alt=""
                            width={22}
                            height={22}
                            className="lang-gate__mobile-sun"
                        />
                        <span className="lang-gate__mobile-title">{t("Мова / Language")}</span>
                    </div>
                    <div className="lang-gate__mobile-options">
                        {LOCALES.map((locale) => (
                            <button
                                key={locale}
                                type="button"
                                className={`lang-gate__mobile-option ${
                                    locale === current ? "lang-gate__mobile-option--active" : ""
                                }`}
                                data-active={locale === current ? "true" : undefined}
                                onClick={() => choose(locale)}
                            >
                                {LOCALE_SHORT[locale] ?? locale.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="lang-gate__mobile-close"
                        aria-label={t("Закрити")}
                        onClick={() => choose(current, false)}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </aside>
        );
    }

    return (
        <div
            className={`lang-gate ${visible ? "lang-gate--visible" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Choose your language"
            onClick={() => choose(current)}
        >
            <div className="lang-gate__card" ref={cardRef} onClick={(e) => e.stopPropagation()}>
                <img
                    src="/brand-sun.webp"
                    alt=""
                    width={44}
                    height={44}
                    className="lang-gate__sun"
                />
                <h2 className="lang-gate__title">{t("Оберіть мову")}</h2>
                <p className="lang-gate__subtitle">Choose your language · Выберите язык</p>
                <div className="lang-gate__options">
                    {LOCALES.map((locale) => (
                        <button
                            key={locale}
                            type="button"
                            className={`lang-gate__option ${locale === current ? "lang-gate__option--active" : ""}`}
                            data-active={locale === current ? "true" : undefined}
                            onClick={() => choose(locale)}
                        >
                            <span className="lang-gate__option-name">{LOCALE_NAMES[locale]}</span>
                            <span className="lang-gate__option-currency">
                                {locale === "uk" ? "₴ UAH" : "$ USD"}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
