import { useState } from "react";
import { useI18n } from "../i18n";
import { useToast } from "./Toast";

interface BackInStockFormProps {
    productId: string;
    /** "" when no size is picked yet — the subscription then covers any size. */
    size: string;
    color?: string;
}

export default function BackInStockForm({ productId, size, color }: BackInStockFormProps) {
    const { t, locale } = useI18n();
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes("@")) {
            showToast(t("Будь ласка, введіть дійсний email"), "warning");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/stock-subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    size,
                    color,
                    email,
                    locale,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setIsSubmitted(true);
                showToast(t("Вас успішно підписано на сповіщення"), "success");
            } else {
                showToast(data.error || t("Не вдалося підписатися"), "error");
            }
        } catch {
            showToast(t("Помилка з'єднання. Спробуйте пізніше."), "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="back-in-stock-box is-success">
                <div className="back-in-stock-box__icon">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>
                <div className="back-in-stock-box__text">
                    <strong>{t("Запит прийнято")}</strong>
                    <p>
                        {size
                            ? t(
                                  "Ми надішлемо вам листа на {email}, щойно розмір {size} буде відшито на виробництві.",
                                  { email, size },
                              )
                            : t(
                                  "Ми надішлемо вам листа на {email}, щойно модель знову з'явиться в наявності.",
                                  { email },
                              )}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="back-in-stock-box">
            <div className="back-in-stock-box__header">
                <span className="back-in-stock-box__badge">{t("Тимчасово немає в наявності")}</span>
                <h4 className="back-in-stock-box__title">
                    {size
                        ? t("Повідомити, коли з'явиться розмір {size}?", { size })
                        : t("Повідомити, коли модель з'явиться в наявності?")}
                </h4>
                <p className="back-in-stock-box__desc">
                    {t(
                        "Залиште email — ми відправимо персональне сповіщення в момент надходження партії.",
                    )}
                </p>
            </div>
            <form onSubmit={handleSubmit} className="back-in-stock-box__form">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={isSubmitting}
                    className="back-in-stock-box__input"
                />
                <button type="submit" disabled={isSubmitting} className="back-in-stock-box__btn">
                    {isSubmitting ? t("Зачекайте...") : t("Повідомити мене")}
                </button>
            </form>
        </div>
    );
}
