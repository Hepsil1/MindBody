import { Link } from "react-router";
import { useState } from "react";
import { useToast } from "./Toast";
import { useSiteSettings, viberChatUrl, whatsappUrl } from "../utils/site-settings";

export default function Footer() {
    const { showToast } = useToast();
    // Owner-editable contacts (admin → Редактор сайту → Налаштування).
    const { contacts } = useSiteSettings();
    const [contact, setContact] = useState("");
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = contact.trim();
        if (!trimmed) {
            showToast("Введіть номер телефону або email", "error");
            return;
        }
        const phoneRegex = /^\+?(38)?0?\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneDigits = trimmed.replace(/[\s\-()]/g, "");
        if (!phoneRegex.test(phoneDigits) && !emailRegex.test(trimmed)) {
            showToast("Введіть коректний номер телефону або email", "error");
            return;
        }
        setSending(true);
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contact: trimmed }),
            });
            if (res.ok) {
                showToast("Дякуємо! Ми зв'яжемось з вами найближчим часом ✨");
                setContact("");
            } else {
                showToast("Помилка при відправці", "error");
            }
        } catch {
            showToast("Помилка з'єднання", "error");
        }
        setSending(false);
    };

    return (
        <footer className="footer-puma">
            <div className="footer-puma__container">
                <div className="footer-puma__content-wrapper">
                    {/* LEFT SIDE: LOGO & NAVIGATION */}
                    <div className="footer-puma__left-group">
                        <div className="footer-puma__logo-top">
                            <picture>
                                <source srcSet="/pics/mind_body_logo_sun.webp" type="image/webp" />
                                <img
                                    src="/pics/mind_body_logo_sun.png"
                                    alt="MIND BODY"
                                    className="footer-puma__logo-img"
                                    loading="lazy"
                                />
                            </picture>
                        </div>

                        <div className="footer-puma__nav-grid">
                            {/* Допомога — 5 high-intent links. Dropped "Догляд за
                                виробами" (folds into FAQ) per audit. */}
                            <div className="footer-puma__nav-col">
                                <h3 className="footer-puma__col-header">Допомога</h3>
                                <ul className="footer-puma__nav-list">
                                    <li>
                                        <Link to="/contacts">Контакти</Link>
                                    </li>
                                    <li>
                                        <Link to="/size-guide">Таблиця розмірів</Link>
                                    </li>
                                    <li>
                                        <Link to="/delivery">Доставка та оплата</Link>
                                    </li>
                                    <li>
                                        <Link to="/return-policy">Повернення</Link>
                                    </li>
                                    <li>
                                        <Link to="/faq">Часті запитання</Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Каталог column DROPPED entirely — duplicated the
                                burger-menu nav and was the largest mobile-footer
                                noise contributor (6 links × 44px = 264px). User
                                explicitly requested removal. */}

                            {/* Про компанію — kept 3 items. Public offer page
                                doesn't exist yet (admin task: create /offer
                                route) — using /terms (ToS) as the closest
                                legal fit. */}
                            <div className="footer-puma__nav-col">
                                <h3 className="footer-puma__col-header">Про компанію</h3>
                                <ul className="footer-puma__nav-list">
                                    <li>
                                        <Link to="/about">Про нас</Link>
                                    </li>
                                    <li>
                                        <Link to="/terms">Умови користування</Link>
                                    </li>
                                    <li>
                                        <Link to="/privacy">Політика конфіденційності</Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Зв'язатись — restructured per 10-agent synthesis:
                                phone as tel:-CTA (the conversion link), 4 messengers
                                collapsed to icon row (text duplicates were eating
                                5 rows × 44px). Aria-labels on each per a11y skill. */}
                            <div className="footer-puma__nav-col footer-puma__nav-col--contact">
                                <h3 className="footer-puma__col-header">Зв'язатись</h3>
                                <a
                                    href={`tel:${contacts.phoneTel}`}
                                    className="footer-puma__phone-cta"
                                    aria-label={`Подзвонити: ${contacts.phoneDisplay}`}
                                >
                                    <svg
                                        aria-hidden="true"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    {contacts.phoneDisplay}
                                </a>
                                {/* Sprint 1 D1.2 #45 TRUST-006 — explicit support
                                    hours sets response expectation. Baymard:
                                    reduces "когда мне ответят?" anxiety. */}
                                <p className="footer-puma__hours">{contacts.hoursLabel}</p>
                                <ul
                                    className="footer-puma__social-icons"
                                    aria-label="Месенджери та соцмережі"
                                >
                                    <li>
                                        <a
                                            href={contacts.instagramUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Instagram MindBody"
                                            className="footer-puma__social-link footer-puma__social-link--ig"
                                        >
                                            <svg
                                                aria-hidden="true"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                            </svg>
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href={contacts.telegramUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Telegram MindBody"
                                            className="footer-puma__social-link footer-puma__social-link--tg"
                                        >
                                            <svg
                                                aria-hidden="true"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                                            </svg>
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href={viberChatUrl(contacts.viberPhone)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Viber MindBody"
                                            className="footer-puma__social-link footer-puma__social-link--viber"
                                        >
                                            <svg
                                                aria-hidden="true"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.696 6.704.633 9.83c-.069 3.115-.149 8.953 5.475 10.542h.005l-.005 2.414s-.036.977.61 1.177c.776.243 1.234-.501 1.978-1.302.408-.44.97-1.084 1.395-1.578 3.85.324 6.8-.418 7.137-.527.776-.252 5.158-.815 5.872-6.638.738-6.002-.36-9.793-2.339-11.504l-.012-.005c-.6-.55-3.013-2.31-8.402-2.33 0 0-.398-.025-1.273-.025-.762 0-1.785.052-1.785.052zm.052 1.69c.875 0 1.273.025 1.273.025h.052c4.872 0 7.024 1.461 7.532 1.926 1.676 1.42 2.539 4.84 1.893 9.973-.6 4.872-4.124 5.184-4.78 5.39-.275.086-2.917.745-6.252.526 0 0-2.484 3-3.26 3.778-.122.122-.265.171-.36.146-.135-.034-.171-.197-.171-.434l.022-4.014c-4.75-1.32-4.473-6.279-4.41-8.882.057-2.61.534-4.746 1.969-6.166 1.953-1.785 5.45-2.064 7.072-2.064.156 0 .305-.005.42-.005zm.34 2.418c-.116 0-.214.099-.214.222 0 .121.099.22.219.22 1.59.005 2.92.523 3.992 1.55 1.07 1.027 1.61 2.367 1.614 4.004 0 .121.098.22.22.22.121 0 .22-.099.22-.22-.005-1.764-.594-3.245-1.755-4.343-1.16-1.098-2.598-1.65-4.296-1.653zm.706 1.388c-.117 0-.214.098-.214.22 0 .122.097.22.214.22 1.143.005 2.084.391 2.821 1.132.737.741 1.106 1.69 1.106 2.835 0 .121.098.22.22.22.121 0 .22-.099.22-.22-.005-1.252-.41-2.31-1.219-3.124-.81-.815-1.85-1.252-3.148-1.252zm.706 1.388c-.117 0-.214.098-.214.22 0 .117.097.215.214.22.685 0 1.235.224 1.66.65.428.43.654.998.654 1.703 0 .117.097.215.219.22.121 0 .22-.103.22-.22-.005-.815-.27-1.487-.785-2.012-.514-.524-1.176-.78-1.968-.78zM7.16 5.94c-.187 0-.4.069-.611.207-.487.327-1.057.811-1.444 1.36-.392.55-.59 1.218-.535 1.85.026.317.224.802.422 1.213.317.611.679 1.214 1.087 1.787a17.43 17.43 0 0 0 2.5 2.745c.86.75 1.74 1.418 2.65 1.985.91.567 1.866.949 2.703 1.025.583.054 1.232-.143 1.787-.531.554-.388 1.04-.952 1.366-1.435.21-.317.243-.658.131-.97-.092-.275-.286-.515-.591-.682-.305-.167-.711-.378-1.026-.539-.392-.21-.71-.292-1.026-.169-.317.123-.532.515-.732.683-.099.083-.225.114-.347.082-.65-.176-1.6-.81-2.508-1.717-.91-.91-1.547-1.86-1.722-2.512-.032-.121.005-.247.088-.346.167-.2.555-.414.678-.731.123-.317.041-.634-.169-1.025-.16-.317-.371-.722-.539-1.027-.167-.305-.408-.499-.682-.591-.151-.05-.303-.077-.45-.078z" />
                                            </svg>
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href={whatsappUrl(contacts.whatsappPhone)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="WhatsApp MindBody"
                                            className="footer-puma__social-link footer-puma__social-link--wa"
                                        >
                                            <svg
                                                aria-hidden="true"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.875 11.875 0 0 0 5.69 1.446h.005c9.847 0 16.017-10.59 10.495-19.345zM12.03 22.04h-.004a9.86 9.86 0 0 1-5.026-1.378l-.36-.214-3.74.975 1-3.64-.235-.374a9.86 9.86 0 0 1-1.51-5.247c.001-8.726 10.601-13.087 16.77-6.92 6.165 6.158 1.838 16.799-6.895 16.799zm5.43-7.403c-.298-.149-1.762-.868-2.034-.967-.273-.099-.471-.149-.67.149-.197.297-.769.967-.942 1.164-.173.198-.347.224-.644.075-.298-.149-1.256-.464-2.392-1.475-.884-.788-1.484-1.762-1.658-2.059-.173-.297-.018-.458.13-.606.134-.135.297-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.613-.916-2.207-.242-.581-.487-.502-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                            </svg>
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* PREMIUM FEEDBACK BLOCK */}
                    <div className="footer-puma__right-group">
                        <div className="mind-feedback">
                            <div className="mind-feedback__header">
                                <div className="mind-feedback__title-wrap">
                                    <h4 className="mind-feedback__title">Давай поговоримо</h4>
                                    <span className="mind-feedback__subtitle">
                                        маєш запитання — напиши
                                    </span>
                                </div>
                                <a
                                    href="https://instagram.com/mindbody_sportwear"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mind-feedback__social-link"
                                    aria-label="Instagram"
                                >
                                    <div className="insta-icon-wrapper">
                                        <svg
                                            aria-hidden="true"
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                    </div>
                                </a>
                            </div>

                            <form
                                className="mind-feedback__form"
                                onSubmit={handleSubmit}
                                noValidate
                            >
                                <label
                                    htmlFor="footer-feedback-contact"
                                    className="visually-hidden"
                                >
                                    Ваш номер телефону або email
                                </label>
                                <input
                                    id="footer-feedback-contact"
                                    type="text"
                                    inputMode="email"
                                    autoComplete="email"
                                    placeholder="Ваш номер телефону або email"
                                    className="mind-feedback__input"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    disabled={sending}
                                    aria-required="true"
                                />
                                <button
                                    type="submit"
                                    className="mind-feedback__btn"
                                    disabled={sending}
                                    aria-busy={sending}
                                >
                                    {sending ? "ВІДПРАВКА..." : "НАДIСЛАТИ"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* F-004 — payment badges now match what the checkout actually
                offers. Visa/Mastercard stay because the courier-terminal
                option uses them (see /delivery), but Apple Pay / Google Pay
                are dropped: they had been advertising an online flow we
                don't have, which collides with the «only cash on delivery»
                radio at checkout. They come back when card acquiring goes
                live. */}
            <div className="footer-puma__trust-row">
                <ul className="footer-puma__pay-icons" aria-label="Способи оплати">
                    <li>
                        <img
                            src="/icons/payment/visa.svg"
                            alt="Visa"
                            width="32"
                            height="20"
                            loading="lazy"
                            decoding="async"
                        />
                    </li>
                    <li>
                        <img
                            src="/icons/payment/mastercard.svg"
                            alt="Mastercard"
                            width="32"
                            height="20"
                            loading="lazy"
                            decoding="async"
                        />
                    </li>
                    <li className="footer-puma__pay-text">Готівка або картка при отриманні</li>
                </ul>
                <p className="footer-puma__ssl-badge">
                    <svg
                        aria-hidden="true"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Безпечне з'єднання · SSL
                </p>
            </div>

            {/* FULL WIDTH DIVIDER */}
            <div className="footer-puma__full-divider"></div>

            {/* BOTTOM — stacked centered on mobile, per 10-agent synthesis.
                Country selector dropped (single-market, false affordance) —
                replaced with "Made in Ukraine" caption that signals locale
                without pretending to be interactive. */}
            <div className="footer-puma__container">
                <div className="footer-puma__bottom-row">
                    <div className="footer-puma__logo-center">
                        <picture>
                            <source srcSet="/pics/mind_body_1.webp" type="image/webp" />
                            <img
                                src="/pics/mind_body_1.png"
                                alt="MIND BODY"
                                className="footer-puma__logo-small"
                                loading="lazy"
                            />
                        </picture>
                    </div>

                    <div className="footer-puma__made-in">
                        Зроблено в Україні
                        <span aria-hidden="true" className="footer-puma__dot">
                            {" "}
                            ·{" "}
                        </span>
                        Доставка Новою Поштою
                    </div>

                    {/* Sprint 1 D1.3 — #33 TRUST-004 business info (placeholder).
                        Legal entity per ЗУ «Про захист прав споживачів» ст.15 +
                        Baymard trust signal. Real ФОП / ЄДРПОУ replaces this
                        when the user provides values. */}
                    <address className="footer-puma__legal">
                        MIND BODY
                        <span aria-hidden="true"> · </span>
                        <a href="mailto:hello@mindbody-sportwear.com">
                            hello@mindbody-sportwear.com
                        </a>
                        <span aria-hidden="true"> · </span>
                        Україна · Доставка по всій країні
                    </address>

                    <div className="footer-puma__copyright-text">
                        © MIND BODY,{" "}
                        <span suppressHydrationWarning>{new Date().getFullYear()}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
