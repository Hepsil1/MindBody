import { useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect, useState } from "react";
import { getOrderByToken, type TrackedOrder } from "../services/orderTracking.server";
import { resolveSiteUrl } from "../utils/site-url";
import { useI18n, useMoney, LLink } from "../i18n";
import { useToast } from "../components/Toast";
import { trackPurchase } from "../utils/analytics.client";
import { useSiteSettings, viberChatUrl } from "../utils/site-settings";
import "../styles/order-page.css";

export const meta: MetaFunction = () => {
    return [
        { title: "Статус замовлення | MIND BODY" },
        { name: "robots", content: "noindex, nofollow" },
    ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
    const token = params.token;
    if (!token) {
        throw new Response("Замовлення не знайдено", { status: 404 });
    }

    const order = await getOrderByToken(token);
    if (!order) {
        throw new Response("Замовлення не знайдено", { status: 404 });
    }

    const url = new URL(request.url);
    const isFresh = url.searchParams.get("new") === "1";

    return {
        order,
        isFresh,
        siteUrl: resolveSiteUrl(),
    };
}

export default function OrderStatusPage() {
    const { order, isFresh } = useLoaderData<typeof loader>();
    const { t } = useI18n();
    const money = useMoney();
    const { showToast } = useToast();
    const settings = useSiteSettings();
    const tgLink = settings.contacts?.telegramUrl || "https://t.me/Juliamindbody";
    const viberLink = settings.contacts?.viberPhone
        ? viberChatUrl(settings.contacts.viberPhone)
        : "";

    // Idempotent client-side purchase tracking (prevents duplicate conversions on F5)
    useEffect(() => {
        if (!isFresh || typeof window === "undefined") return;

        const storageKey = `mb_purchase_${order.number}`;
        // Storage can throw (blocked site data) — then fall through and track
        // once per page load rather than crash the effect.
        let alreadyTracked = false;
        try {
            alreadyTracked = !!localStorage.getItem(storageKey);
        } catch {
            /* storage unavailable */
        }
        if (!alreadyTracked) {
            try {
                trackPurchase({
                    orderId: String(order.number),
                    total: order.total,
                    items: order.items.map((i) => ({
                        // Same id as view_item / add_to_cart (product.id) so GA4/Meta
                        // funnels join the purchase to the right product.
                        id: String(i.productId),
                        name: i.name,
                        price: i.price,
                        quantity: i.quantity,
                        variant: [i.size, i.color].filter(Boolean).join(" / ") || undefined,
                    })),
                });
                try {
                    localStorage.setItem(storageKey, new Date().toISOString());
                } catch {
                    /* storage unavailable */
                }
            } catch (err) {
                console.error("[analytics] purchase tracking error:", err);
            }
        }
    }, [isFresh, order]);

    const copyOrderNumber = () => {
        navigator.clipboard
            .writeText(String(order.number))
            .then(() => showToast(t("Номер замовлення скопійовано"), "success"))
            .catch(() => showToast(t("Не вдалося скопіювати"), "warning"));
    };

    return (
        <main className="order-page">
            <div className="order-container">
                {/* Hero Confirmation */}
                <div className="order-hero">
                    <div className="order-hero__icon">
                        <svg
                            width="44"
                            height="44"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                    <span className="order-hero__kicker">{t("ЗАМОВЛЕННЯ ПРИЙНЯТО")}</span>
                    <h1 className="order-hero__title">
                        {order.customer.firstName
                            ? t("Дякуємо, {name}!", { name: order.customer.firstName })
                            : t("Дякуємо за замовлення!")}
                    </h1>
                    <p className="order-hero__subtitle">
                        {t(
                            "Ми вже готуємо ваші речі до відправлення. Збережіть це посилання для відстеження статусу.",
                        )}
                    </p>

                    <div className="order-hero__number-pill">
                        <span className="order-hero__number-label">{t("№ замовлення:")}</span>
                        <strong className="order-hero__number-val">#{order.number}</strong>
                        <button
                            type="button"
                            onClick={copyOrderNumber}
                            className="order-hero__copy-btn"
                            title={t("Копіювати номер")}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>{t("Копіювати")}</span>
                        </button>
                    </div>
                </div>

                {/* Timeline status bar */}
                <section className="order-timeline-card">
                    <h2 className="order-section-title">{t("Статус виконання")}</h2>
                    <div className="order-timeline">
                        {order.timeline.map((stage, idx) => (
                            <div
                                key={stage.status}
                                className={`order-timeline__step ${stage.done ? "is-done" : ""} ${stage.current ? "is-current" : ""}`}
                            >
                                <div className="order-timeline__marker">
                                    {stage.done ? (
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                        >
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : (
                                        <span>{idx + 1}</span>
                                    )}
                                </div>
                                <div className="order-timeline__content">
                                    <span className="order-timeline__label">{t(stage.label)}</span>
                                    {stage.at && (
                                        <time className="order-timeline__time">
                                            {new Date(stage.at).toLocaleDateString("uk-UA", {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </time>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tracking Button for Nova Poshta */}
                    {order.trackingUrl && (
                        <div className="order-ttn-box">
                            <div className="order-ttn-box__info">
                                <span className="order-ttn-box__label">
                                    {t("ТТН Нової Пошти:")}
                                </span>
                                <strong className="order-ttn-box__code">
                                    {order.trackingNumber}
                                </strong>
                            </div>
                            <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="order-ttn-box__btn"
                            >
                                <span>{t("Відстежити посилку")}</span>
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </a>
                        </div>
                    )}
                </section>

                {/* Details layout: Items + Delivery info */}
                <div className="order-details-grid">
                    {/* Items List */}
                    <div className="order-card order-card--items">
                        <h2 className="order-section-title">
                            {t("Склад замовлення")} ({order.items.length})
                        </h2>
                        <ul className="order-items-list">
                            {order.items.map((item, i) => (
                                <li key={i} className="order-item">
                                    <div className="order-item__image-wrap">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="order-item__image"
                                        />
                                    </div>
                                    <div className="order-item__info">
                                        <h3 className="order-item__name">
                                            {item.slug ? (
                                                <LLink to={`/p/${item.slug}`}>{item.name}</LLink>
                                            ) : (
                                                item.name
                                            )}
                                        </h3>
                                        <div className="order-item__meta">
                                            {item.size && (
                                                <span>
                                                    {t("Розмір:")} <strong>{item.size}</strong>
                                                </span>
                                            )}
                                            {item.color && (
                                                <span>
                                                    {t("Колір:")} <strong>{item.color}</strong>
                                                </span>
                                            )}
                                            <span>
                                                {t("К-сть:")} <strong>{item.quantity}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="order-item__price">
                                        {money(item.price * item.quantity)}
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div className="order-summary-footer">
                            {order.discountAmount > 0 && (
                                <div className="order-summary-row order-summary-row--discount">
                                    <span>{t("Знижка за промокодом:")}</span>
                                    <span>-{money(order.discountAmount)}</span>
                                </div>
                            )}
                            <div className="order-summary-row order-summary-row--total">
                                <span>{t("Разом до сплати:")}</span>
                                <strong className="order-total-amount">{money(order.total)}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Delivery & Help Card */}
                    <div className="order-card order-card--side">
                        <h2 className="order-section-title">{t("Доставка та контакт")}</h2>

                        <div className="order-info-block">
                            <span className="order-info-block__label">{t("Отримувач:")}</span>
                            <div className="order-info-block__val">
                                <div>{order.customer.firstName}</div>
                                {order.customer.maskedPhone && (
                                    <div>{order.customer.maskedPhone}</div>
                                )}
                                {order.customer.maskedEmail && (
                                    <div>{order.customer.maskedEmail}</div>
                                )}
                            </div>
                        </div>

                        <div className="order-info-block">
                            <span className="order-info-block__label">{t("Адреса доставки:")}</span>
                            <div className="order-info-block__val">
                                <div>{order.delivery.city || t("Україна")}</div>
                                <div>{order.delivery.warehouse || t("Відділення Нової Пошти")}</div>
                                {order.delivery.comment && (
                                    <div className="order-info-block__comment">
                                        <em>«{order.delivery.comment}»</em>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="order-support-box">
                            <h3 className="order-support-box__title">
                                {t("Потрібна допомога з замовленням?")}
                            </h3>
                            <p className="order-support-box__text">
                                {t(
                                    "Наші турботливі консультанти на зв'язку щодня з 09:00 до 20:00.",
                                )}
                            </p>
                            <div className="order-support-box__actions">
                                {tgLink && (
                                    <a
                                        href={tgLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="order-support-btn order-support-btn--tg"
                                    >
                                        Telegram
                                    </a>
                                )}
                                {viberLink && (
                                    <a
                                        href={viberLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="order-support-btn order-support-btn--viber"
                                    >
                                        Viber
                                    </a>
                                )}
                                <LLink
                                    to="/contacts"
                                    className="order-support-btn order-support-btn--ghost"
                                >
                                    {t("Контакти")}
                                </LLink>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Back to store CTA */}
                <div className="order-footer-cta">
                    <LLink to="/shop/yoga" className="order-continue-btn">
                        {t("Продовжити покупки")}
                    </LLink>
                </div>
            </div>
        </main>
    );
}
