import { Link, useLocation } from "react-router";
import { LOCALES, LOCALE_SHORT, localizePath, setLocaleCookie, useI18n } from "../i18n";
import "../styles/language-gate.css";

/**
 * Compact UA · EN · RU switcher. Each option is a real <Link> to the same
 * page in the target locale (crawlable, matches the hreflang alternates);
 * clicking also persists the choice in the mb_locale cookie.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
    const location = useLocation();
    const { locale: current, t } = useI18n();
    const here = location.pathname + location.search;

    return (
        <nav className={`lang-switch ${className}`.trim()} aria-label={t("Мова сайту")}>
            {LOCALES.map((locale) => (
                <Link
                    key={locale}
                    to={localizePath(here, locale)}
                    className={`lang-switch__item ${
                        locale === current ? "lang-switch__item--active" : ""
                    }`}
                    aria-current={locale === current ? "true" : undefined}
                    onClick={() => setLocaleCookie(locale)}
                >
                    {LOCALE_SHORT[locale]}
                </Link>
            ))}
        </nav>
    );
}
