import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
    LOCALES,
    LOCALE_NAMES,
    type Locale,
    localizePath,
    setLocaleCookie,
    useI18n,
} from "../i18n";
import "../styles/language-gate.css";

/**
 * First-visit language chooser. The root loader decides whether to mount it
 * (no mb_locale cookie + not a bot); after a choice the cookie is set and the
 * gate never shows again. Appears with a short delay so the LoadingScreen
 * finishes its fade first.
 */
export function LanguageGate() {
    const [visible, setVisible] = useState(false);
    const [done, setDone] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { locale: current, t } = useI18n();
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // LoadingScreen hides ~right after hydration (350 ms fade) — wait it out.
        const id = setTimeout(() => setVisible(true), 900);
        return () => clearTimeout(id);
    }, []);

    useEffect(() => {
        if (!visible || done) return;
        cardRef.current?.querySelector<HTMLButtonElement>("button[data-active='true']")?.focus();
    }, [visible, done]);

    const choose = (locale: Locale) => {
        setLocaleCookie(locale);
        setDone(true);
        if (locale !== current) {
            navigate(localizePath(location.pathname + location.search, locale));
        }
    };

    // Escape = keep the current language (still remembers the choice).
    useEffect(() => {
        if (!visible || done) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") choose(current);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, done, current]);

    if (done) return null;

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
