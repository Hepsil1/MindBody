import { Link } from "react-router";
import { useState } from "react";
import { useToast } from "./Toast";

export default function Footer() {
    const { showToast } = useToast();
    const [contact, setContact] = useState('');
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact.trim() || contact.trim().length < 3) {
            showToast('Введіть номер телефону або email', 'error');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact: contact.trim() })
            });
            if (res.ok) {
                showToast('Дякуємо! Ми зв\'яжемось з вами найближчим часом ✨');
                setContact('');
            } else {
                showToast('Помилка при відправці', 'error');
            }
        } catch {
            showToast('Помилка з\'єднання', 'error');
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
                            <img src="/pics/mind_body_logo_sun.png" alt="MIND BODY" className="footer-puma__logo-img" />
                        </div>

                        <div className="footer-puma__nav-grid">
                            <div className="footer-puma__nav-col">
                                <h5 className="footer-puma__col-header">Допомога</h5>
                                <ul className="footer-puma__nav-list">
                                    <li><Link to="/contacts">Контакти</Link></li>
                                    <li><Link to="/size-guide">Таблиця розмірів</Link></li>
                                    <li><Link to="/delivery">Доставка та оплата</Link></li>
                                </ul>
                            </div>

                            <div className="footer-puma__nav-col">
                                <h5 className="footer-puma__col-header">Каталог</h5>
                                <ul className="footer-puma__nav-list">
                                    <li><Link to="/shop/yoga">Yoga</Link></li>
                                    <li><Link to="/shop/sport">Sport</Link></li>
                                    <li><Link to="/shop/dance">Dance</Link></li>
                                    <li><Link to="/shop/casual">Casual</Link></li>
                                    <li><Link to="/shop/kids">Kids</Link></li>
                                    <li><Link to="/shop/yogatools">YogaTools</Link></li>
                                </ul>
                            </div>

                            <div className="footer-puma__nav-col">
                                <h5 className="footer-puma__col-header">Про компанію</h5>
                                <ul className="footer-puma__nav-list">
                                    <li><Link to="/about">Про нас</Link></li>
                                </ul>
                            </div>

                            <div className="footer-puma__nav-col">
                                <h5 className="footer-puma__col-header">Зв'язатись</h5>
                                <ul className="footer-puma__nav-list">
                                    <li>
                                        <a href="tel:+380966650855">
                                            📞 +38 (096) 665-08-55
                                        </a>
                                    </li>
                                    <li>
                                        <a href="viber://chat?number=%2B380509656737" target="_blank" rel="noopener noreferrer">
                                            Viber
                                        </a>
                                    </li>
                                    <li>
                                        <a href="https://wa.me/380973542848" target="_blank" rel="noopener noreferrer">
                                            WhatsApp
                                        </a>
                                    </li>
                                    <li>
                                        <a href="https://t.me/+380509656737" target="_blank" rel="noopener noreferrer">
                                            Telegram
                                        </a>
                                    </li>
                                    <li>
                                        <a href="https://instagram.com/mindbody.sportwear" target="_blank" rel="noopener noreferrer">
                                            Instagram
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
                                    <h4 className="mind-feedback__title">ШВИДКЕ ЗАПИТАННЯ</h4>
                                    <span className="mind-feedback__subtitle">(ЗВОРОТНІЙ ЗВ'ЯЗОК)</span>
                                </div>
                                <a href="https://instagram.com/mindbody.sportwear" target="_blank" rel="noopener noreferrer" className="mind-feedback__social-link" aria-label="Instagram">
                                    <div className="insta-icon-wrapper">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                    </div>
                                </a>
                            </div>

                            <form className="mind-feedback__form" onSubmit={handleSubmit}>
                                <input
                                    type="text"
                                    placeholder="Ваш номер телефону або email"
                                    className="mind-feedback__input"
                                    value={contact}
                                    onChange={e => setContact(e.target.value)}
                                    disabled={sending}
                                />
                                <button type="submit" className="mind-feedback__btn" disabled={sending}>
                                    {sending ? 'ВІДПРАВКА...' : 'НАДIСЛАТИ'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* FULL WIDTH DIVIDER */}
            <div className="footer-puma__full-divider"></div>

            {/* BOTTOM BAR SECTION */}
            <div className="footer-puma__container">
                <div className="footer-puma__bottom-row">
                    <div className="footer-puma__country-select">
                        <span className="footer-puma__flag">🇺🇦</span>
                        <span className="footer-puma__country-name">УКРАЇНА (УКРАЇНСЬКА)</span>
                        <span className="footer-puma__arrow">▼</span>
                    </div>

                    <div className="footer-puma__logo-center">
                        <img src="/pics/mind_body_1.png" alt="MIND BODY" className="footer-puma__logo-small" />
                    </div>

                    <div className="footer-puma__copyright-text">
                        Всі права захищені © MIND BODY, {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        </footer>
    );
}
