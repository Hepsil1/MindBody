import { Link } from "react-router";
import { useState } from "react";
import { buildWebpSrcset } from "../utils/responsive-image";
import { useSiteSettings } from "../utils/site-settings";
import "../styles/contacts.css";

export default function Contacts() {
    // Owner-editable contacts (admin → Редактор сайту → Налаштування).
    const { contacts } = useSiteSettings();
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
            const text = `📩 *Нове повідомлення з сайту*\n\n👤 *Ім'я:* ${form.name}\n📞 *Контакт:* ${form.contact}\n💬 *Повідомлення:* ${form.message}`;
            const res = await fetch("/api/telegram/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
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
                        <Link to="/">Головна</Link>
                        <span> / </span>
                        <span>Контакти</span>
                    </nav>
                    <h1 className="contacts-hero__title">Контакти</h1>
                    <p className="contacts-hero__subtitle">
                        Ми завжди раді допомогти вам та відповісти на будь-які ваші питання
                    </p>
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
                            <h3>Телефон</h3>
                            <span className="contact-card__value">{contacts.phoneDisplay}</span>
                            <span className="contact-card__hint">Основний номер</span>
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
                            <h3>Email</h3>
                            <span className="contact-card__value">
                                hello@mindbody-sportwear.com
                            </span>
                            <span className="contact-card__hint">Відповідь за 24 години</span>
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
                            <h3>Адреса</h3>
                            <span className="contact-card__value">Одеса, Україна</span>
                            <span className="contact-card__hint">Онлайн-магазин</span>
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
                            <h3>Instagram</h3>
                            <span className="contact-card__value">@mindbody.sportwear</span>
                            <span className="contact-card__hint">Слідкуйте за нами</span>
                        </a>
                    </div>

                    {/* Form Section */}
                    <div id="contact-form" className="contacts-form-section">
                        <div className="contacts-form-container">
                            <h2>Напишіть нам</h2>
                            <p>
                                Маєте питання? Заповніть форму, і наші консультанти зв'яжуться з
                                вами якнайшвидше.
                            </p>

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
                                    <h3>Повідомлення надіслано!</h3>
                                    <p>Ми зв'яжемося з вами найближчим часом.</p>
                                    <button
                                        className="btn-submit"
                                        onClick={() => setStatus("idle")}
                                    >
                                        Надіслати ще
                                    </button>
                                </div>
                            ) : (
                                <form className="contacts-form" onSubmit={handleSubmit} noValidate>
                                    <div className="form-field">
                                        <label htmlFor="name">Ім'я *</label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={form.name}
                                            onChange={handleChange}
                                            placeholder="Ваше ім'я"
                                            autoComplete="name"
                                            required
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="contact">Email / Телефон *</label>
                                        <input
                                            type="text"
                                            id="contact"
                                            name="contact"
                                            value={form.contact}
                                            onChange={handleChange}
                                            placeholder="email або +380..."
                                            autoComplete="email"
                                            inputMode="email"
                                            required
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="message">Повідомлення *</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            rows={4}
                                            value={form.message}
                                            onChange={handleChange}
                                            placeholder="Ваше запитання або побажання..."
                                            autoComplete="off"
                                            required
                                        />
                                    </div>

                                    {status === "error" && (
                                        <p className="contacts-form-error">
                                            Помилка надсилання. Спробуйте ще раз або зателефонуйте
                                            нам.
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={status === "sending"}
                                    >
                                        {status === "sending"
                                            ? "Надсилання..."
                                            : "Надіслати повідомлення"}
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
