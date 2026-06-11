import { useState, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import { useI18n } from "../i18n";
import type { ReviewData } from "../types/product";

// Product reviews block — fetches /api/reviews?productId, renders the list +
// average, and a moderated submit form. Self-contained (only needs productId);
// extracted from app/routes/p.$slug.tsx. Styling comes from product-page.css,
// which the PDP route imports globally.
export default function ReviewsSection({ productId }: { productId: string }) {
    const { showToast } = useToast();
    const { t, locale } = useI18n();
    const [reviews, setReviews] = useState<ReviewData[]>([]);
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState("");
    const [formText, setFormText] = useState("");
    const [formRating, setFormRating] = useState(5);
    const [submitting, setSubmitting] = useState(false);
    // Track first load so we don't flash "be the first to review" before the
    // fetch resolves (which misrepresents products that DO have reviews).
    const [loaded, setLoaded] = useState(false);

    const fetchReviews = useCallback(async () => {
        try {
            const res = await fetch(`/api/reviews?productId=${productId}`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data.reviews || []);
                setAvg(data.avg || 0);
                setCount(data.count || 0);
            }
        } catch {
            /* silent */
        } finally {
            setLoaded(true);
        }
    }, [productId]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim() || !formText.trim()) {
            showToast(t("Будь ласка, заповніть всі поля"), "error");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    authorName: formName.trim(),
                    rating: formRating,
                    text: formText.trim(),
                }),
            });
            if (res.ok) {
                const data = await res.json();
                showToast(data.message || t("Дякуємо за ваш відгук! ✨"));
                setFormName("");
                setFormText("");
                setFormRating(5);
                setShowForm(false);
                // Don't refetch — review is pending moderation and won't appear yet
            } else {
                const data = await res.json().catch(() => null);
                showToast(data?.error || t("Помилка при збереженні"), "error");
            }
        } catch {
            showToast(t("Помилка з'єднання"), "error");
        }
        setSubmitting(false);
    };

    const renderStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);
    const getInitials = (name: string) =>
        (name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .substring(0, 2) || "?";
    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="reviews-section">
            <div className="reviews-header">
                <h3>
                    {t("Відгуки")} {count > 0 && `(${count})`}
                </h3>
                {count > 0 && (
                    <div className="avg-rating">
                        <span className="stars">{renderStars(Math.round(avg))}</span>
                        <span>{t("{avg} з 5", { avg })}</span>
                    </div>
                )}
            </div>

            {!loaded ? (
                <p className="reviews-empty" aria-busy="true">
                    {t("Завантаження відгуків…")}
                </p>
            ) : reviews.length > 0 ? (
                <div className="reviews-list">
                    {reviews.map((r) => (
                        <div key={r.id} className="review-card">
                            <div className="review-card__header">
                                <div className="review-card__author">
                                    <div className="review-card__avatar">
                                        {getInitials(r.authorName)}
                                    </div>
                                    <div>
                                        <div className="review-card__name">{r.authorName}</div>
                                        <div className="review-card__date">
                                            {formatDate(r.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="review-card__stars">{renderStars(r.rating)}</div>
                            </div>
                            <p className="review-card__text">{r.text}</p>
                            {r.isVerified && (
                                <span className="review-card__verified">
                                    {t("✓ Підтверджена покупка")}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="reviews-empty">{t("Поки що немає відгуків. Будьте першими! ✨")}</p>
            )}

            {!showForm ? (
                <button onClick={() => setShowForm(true)} className="review-write-btn">
                    {t("Написати відгук")}
                </button>
            ) : (
                <form className="review-form" onSubmit={handleSubmit}>
                    <h4>{t("Залишити відгук")}</h4>

                    <div className="review-form__field">
                        <label>{t("Оцінка")}</label>
                        <div
                            className="review-form__stars-input"
                            role="radiogroup"
                            aria-label={t("Оцінка товару")}
                        >
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    role="radio"
                                    aria-checked={n <= formRating}
                                    aria-label={t("Оцінка {n} з 5", { n })}
                                    className={n <= formRating ? "active" : ""}
                                    onClick={() => setFormRating(n)}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="review-form__field">
                        <label>{t("Ваше ім'я")}</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={t("Ольга")}
                            maxLength={50}
                        />
                    </div>

                    <div className="review-form__field">
                        <label htmlFor="review-text">{t("Ваш відгук")}</label>
                        <textarea
                            id="review-text"
                            value={formText}
                            onChange={(e) => setFormText(e.target.value)}
                            placeholder={t("Розкажіть про свій досвід із цим товаром...")}
                            maxLength={1000}
                        />
                    </div>

                    <div className="review-form__actions">
                        <button type="submit" className="review-form__submit" disabled={submitting}>
                            {submitting ? t("Відправка...") : t("Надіслати відгук")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#999",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                            }}
                        >
                            {t("Скасувати")}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
