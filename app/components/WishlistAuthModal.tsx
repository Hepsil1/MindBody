import { useEffect, useRef } from "react";
import { useI18n, LLink } from "../i18n";

interface Props {
    onClose: () => void;
}

export function WishlistAuthModal({ onClose }: Props) {
    const { t } = useI18n();
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        // Delay focus so the modal is painted first
        const id = setTimeout(() => modalRef.current?.focus(), 50);
        return () => {
            clearTimeout(id);
            document.body.style.overflow = prevOverflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    return (
        <div className="wish-auth-overlay" onClick={onClose} role="presentation">
            <div
                ref={modalRef}
                className="wish-auth-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="wish-auth-title"
                tabIndex={-1}
            >
                <button
                    className="wish-auth-modal__close"
                    onClick={onClose}
                    aria-label={t("Закрити")}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="wish-auth-modal__heart" aria-hidden="true">
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="none"
                    >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </div>

                <h2 id="wish-auth-title" className="wish-auth-modal__title">
                    {t("Збережіть улюблені товари")}
                </h2>
                <p className="wish-auth-modal__desc">
                    {t(
                        "Увійдіть або зареєструйтеся, щоб зберігати обране та повертатися до нього будь-коли",
                    )}
                </p>

                <div className="wish-auth-modal__actions">
                    <LLink
                        to="/auth"
                        className="wish-auth-modal__btn wish-auth-modal__btn--primary"
                        onClick={onClose}
                    >
                        {t("Увійти")}
                    </LLink>
                    <LLink
                        to="/auth?mode=register"
                        className="wish-auth-modal__btn wish-auth-modal__btn--outline"
                        onClick={onClose}
                    >
                        {t("Зареєструватись")}
                    </LLink>
                </div>

                <p className="wish-auth-modal__hint">{t("Товар буде збережено після входу")}</p>
            </div>
        </div>
    );
}
