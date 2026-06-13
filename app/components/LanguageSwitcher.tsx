import { Link, useLocation } from "react-router";
import { useState, useRef, useEffect } from "react";
import { LOCALES, LOCALE_SHORT, localizePath, setLocaleCookie, useI18n } from "../i18n";
import "../styles/language-gate.css";

const LOCALE_NAME: Record<string, string> = {
    uk: "Українська",
    en: "English",
    ru: "Русский",
};

/**
 * Single-button language dropdown. The trigger shows the current locale (UA/EN/RU);
 * clicking opens a menu of all locales. The options are real <Link>s, rendered in
 * the DOM at all times (just visually hidden until open) so they stay crawlable and
 * match the hreflang alternates; selecting one persists the choice in mb_locale.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
    const location = useLocation();
    const { locale: current, t } = useI18n();
    const here = location.pathname + location.search;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside pointer / Escape.
    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className={`lang-switch ${className}`.trim()}>
            <button
                type="button"
                className="lang-switch__trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t("Мова сайту")}
                onClick={() => setOpen((v) => !v)}
            >
                <span>{LOCALE_SHORT[current]}</span>
                <svg
                    className={`lang-switch__chevron${open ? " is-open" : ""}`}
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            <div className={`lang-switch__menu${open ? " is-open" : ""}`} role="menu">
                {LOCALES.map((locale) => (
                    <Link
                        key={locale}
                        to={localizePath(here, locale)}
                        role="menuitem"
                        className={`lang-switch__option${locale === current ? " is-active" : ""}`}
                        aria-current={locale === current ? "true" : undefined}
                        tabIndex={open ? 0 : -1}
                        onClick={() => {
                            setLocaleCookie(locale);
                            setOpen(false);
                        }}
                    >
                        <span className="lang-switch__option-code">{LOCALE_SHORT[locale]}</span>
                        <span className="lang-switch__option-name">
                            {LOCALE_NAME[locale] ?? LOCALE_SHORT[locale]}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
