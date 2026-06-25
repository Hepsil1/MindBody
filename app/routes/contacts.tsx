import { useState } from "react";
import { buildWebpSrcset } from "../utils/responsive-image";
import { useSiteSettings } from "../utils/site-settings";
import { useI18n, LLink } from "../i18n";
import "../styles/contacts.css";

// Extensionless SSR routes ship no Cache-Control unless the route opts in
// (Caddy's @html matcher only covers / and *.html). Match / and /about.
export function headers() {
    return { "Cache-Control": "no-cache" };
}

// Page prose lives inline per locale (not in the t() dictionary).
// The `uk` variant is the canonical text — keep it byte-identical.
const CONTENT = {
    uk: {
        breadcrumbHome: "Головна",
        breadcrumbCurrent: "Контакти",
        title: "Контакти",
        subtitle: "Ми завжди раді допомогти вам та відповісти на будь-які ваші питання",
        phoneTitle: "Телефон",
        phoneHint: "Основний номер",
        emailTitle: "Email",
        emailHint: "Відповідь за 24 години",
        addressTitle: "Адреса",
        addressValue: "Україна · Доставка по всій країні",
        addressHint: "Онлайн-магазин",
        instagramTitle: "Instagram",
        instagramHint: "Слідкуйте за нами",
        formTitle: "Напишіть нам",
        formIntro:
            "Маєте питання? Заповніть форму, і наші консультанти зв'яжуться з вами якнайшвидше.",
    },
    en: {
        breadcrumbHome: "Home",
        breadcrumbCurrent: "Contacts",
        title: "Contacts",
        subtitle: "We are always happy to help you and answer any of your questions",
        phoneTitle: "Phone",
        phoneHint: "Main number",
        emailTitle: "Email",
        emailHint: "Reply within 24 hours",
        addressTitle: "Address",
        addressValue: "Ukraine · Nationwide delivery",
        addressHint: "Online store",
        instagramTitle: "Instagram",
        instagramHint: "Follow us",
        formTitle: "Write to us",
        formIntro:
            "Have a question? Fill in the form and our consultants will get back to you as soon as possible.",
    },
    ru: {
        breadcrumbHome: "Главная",
        breadcrumbCurrent: "Контакты",
        title: "Контакты",
        subtitle: "Мы всегда рады помочь вам и ответить на любые ваши вопросы",
        phoneTitle: "Телефон",
        phoneHint: "Основной номер",
        emailTitle: "Email",
        emailHint: "Ответ в течение 24 часов",
        addressTitle: "Адрес",
        addressValue: "Украина · Доставка по всей стране",
        addressHint: "Онлайн-магазин",
        instagramTitle: "Instagram",
        instagramHint: "Следите за нами",
        formTitle: "Напишите нам",
        formIntro:
            "Есть вопросы? Заполните форму, и наши консультанты свяжутся с вами как можно скорее.",
    },
} as const;

export default function Contacts() {
    // Owner-editable contacts (admin → Редактор сайту → Налаштування).
    const { contacts } = useSiteSettings();
    const { t, locale } = useI18n();
    const c = CONTENT[locale];
    const [form, setForm] = useState({ name: "", contact: "", message: "" });
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.contact.trim() || !form.message.trim()) return;
        setStatus("sending");
        try {
            // Submit structured fields to the server, which validates them,
            // composes + sends the Telegram notification and persists the lead.
            // (The old direct /api/telegram/send call is now locked down.)
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    contact: form.contact,
                    message: form.message,
                }),
            });
            if (!res.ok) throw new Error("send failed");
            setStatus("sent");
            setForm({ name: "", contact: "", message: "" });
        } catch {
            setStatus("error");
        }
    };

    return (
        <main className="contacts-page">
            {/* Hero Section */}
            <section className="contacts-hero">
                <div className="container">
                    <nav className="breadcrumb" aria-label="Breadcrumb">
                        <LLink to="/">{c.breadcrumbHome}</LLink>
                        <span> / </span>
                        <span>{c.breadcrumbCurrent}</span>
                    </nav>
                    <h1 className="contacts-hero__title">{c.title}</h1>
                    <p className="contacts-hero__subtitle">{c.subtitle}</p>
                </div>
            </section>

            <section className="contacts-content">
                <div className="container">
                    {/* Contact Cards Grid */}
                    <div className="contacts-grid">
                        <a href={`tel:${contacts.phoneTel}`} className="contact-card">
                            <div className="contact-card__icon">
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                            <h3>{c.phoneTitle}</h3>
                            <span className="contact-card__value">{contacts.phoneDisplay}</span>
                            <span className="contact-card__hint">{c.phoneHint}</span>
                        </a>

                        <a href="mailto:hello@mindbody-sportwear.com" className="contact-card">
                            <div className="contact-card__icon">
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <h3>{c.emailTitle}</h3>
                            <span className="contact-card__value">
                                hello@mindbody-sportwear.com
                            </span>
                            <span className="contact-card__hint">{c.emailHint}</span>
                        </a>

                        <div className="contact-card">
                            <div className="contact-card__icon">
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <h3>{c.addressTitle}</h3>
                            <span className="contact-card__value">{c.addressValue}</span>
                            <span className="contact-card__hint">{c.addressHint}</span>
                        </div>

                        <a
                            href={contacts.instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="contact-card"
                        >
                            <div className="contact-card__icon">
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                                </svg>
                            </div>
                            <h3>{c.instagramTitle}</h3>
                            <span className="contact-card__value">@mindbody_sportwear</span>
                            <span className="contact-card__hint">{c.instagramHint}</span>
                        </a>
                    </div>

                    {/* Form Section */}
                    <div id="contact-form" className="contacts-form-section">
                        <div className="contacts-form-container">
                            <h2>{c.formTitle}</h2>
                            <p>{c.formIntro}</p>

                            {status === "sent" ? (
                                <div className="contacts-form-success">
                                    <svg
                                        width="48"
                                        height="48"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                    >
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                    <h3>{t("Повідомлення надіслано!")}</h3>
                                    <p>{t("Ми зв'яжемося з вами найближчим часом.")}</p>
                                    <button
                                        className="btn-submit"
                                        onClick={() => setStatus("idle")}
                                    >
                                        {t("Надіслати ще")}
                                    </button>
                                </div>
                            ) : (
                                <form className="contacts-form" onSubmit={handleSubmit} noValidate>
                                    <div className="form-field">
                                        <label htmlFor="name">{t("Ім'я *")}</label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={form.name}
                                            onChange={handleChange}
                                            placeholder={t("Ваше ім'я")}
                                            autoComplete="name"
                                            required
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="contact">{t("Email / Телефон *")}</label>
                                        <input
                                            type="text"
                                            id="contact"
                                            name="contact"
                                            value={form.contact}
                                            onChange={handleChange}
                                            placeholder={t("email або +380...")}
                                            autoComplete="email"
                                            inputMode="email"
                                            required
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="message">{t("Повідомлення *")}</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            rows={4}
                                            value={form.message}
                                            onChange={handleChange}
                                            placeholder={t("Ваше запитання або побажання...")}
                                            autoComplete="off"
                                            required
                                        />
                                    </div>

                                    {status === "error" && (
                                        <p className="contacts-form-error">
                                            {t(
                                                "Помилка надсилання. Спробуйте ще раз або зателефонуйте нам.",
                                            )}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={status === "sending"}
                                    >
                                        {status === "sending"
                                            ? t("Надсилання...")
                                            : t("Надіслати повідомлення")}
                                    </button>
                                </form>
                            )}
                        </div>

                        <div className="contacts-image-container">
                            <picture>
                                <source
                                    srcSet={buildWebpSrcset("/pics1cloths/IMG_6212.webp")}
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    type="image/webp"
                                />
                                <img
                                    src="/pics1cloths/IMG_6212.webp"
                                    alt="MIND BODY Collection"
                                    loading="lazy"
                                    decoding="async"
                                />
                            </picture>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
