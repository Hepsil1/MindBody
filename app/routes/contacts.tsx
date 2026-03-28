import { Link } from "react-router";
import styles from "../styles/contacts.css?url";


export default function Contacts() {
    return (
        <main className="contacts-page">
            {/* Hero Section */}
            <section className="contacts-hero">
                <div className="container">
                    <nav className="breadcrumb">
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
                        <a href="tel:+380966650855" className="contact-card">
                            <div className="contact-card__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                            <h3>Телефон</h3>
                            <span className="contact-card__value">+380 (96) 665-08-55</span>
                            <span className="contact-card__hint">Основний номер</span>
                        </a>

                        <a href="mailto:hello@mind-body.com.ua" className="contact-card">
                            <div className="contact-card__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <h3>Email</h3>
                            <span className="contact-card__value">hello@mind-body.com.ua</span>
                            <span className="contact-card__hint">Відповідь за 24 години</span>
                        </a>

                        <div className="contact-card">
                            <div className="contact-card__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <h3>Адреса</h3>
                            <span className="contact-card__value">Одеса, Україна</span>
                            <span className="contact-card__hint">Онлайн-магазин</span>
                        </div>

                        <a href="https://instagram.com/mindbody.sportwear" target="_blank" rel="noopener noreferrer" className="contact-card">
                            <div className="contact-card__icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                            <p>Маєте питання? Заповніть форму, і наші консультанти зв'яжуться з вами якнайшвидше для допомоги.</p>

                            <form className="contacts-form" onSubmit={(e) => e.preventDefault()}>
                                <div className="form-field">
                                    <label htmlFor="name">Ім'я</label>
                                    <input type="text" id="name" placeholder="Ваше ім'я" />
                                </div>

                                <div className="form-field">
                                    <label htmlFor="email">Email / Телефон</label>
                                    <input type="text" id="email" placeholder="Как нам з вами зв'язатися" />
                                </div>

                                <div className="form-field">
                                    <label htmlFor="message">Повідомлення</label>
                                    <textarea id="message" rows={4} placeholder="Ваше запитання або побажання..."></textarea>
                                </div>

                                <button type="submit" className="btn-submit">
                                    Надіслати повідомлення
                                </button>
                            </form>
                        </div>

                        <div className="contacts-image-container">
                            <img src="/pics1cloths/IMG_6212.JPG" alt="MIND BODY Collection" />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
