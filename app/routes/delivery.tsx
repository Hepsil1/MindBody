import { Link } from "react-router";

export default function Delivery() {
    return (
        <main className="delivery-page">
            <section className="page-hero" style={{
                background: 'linear-gradient(135deg, var(--color-bg-cream) 0%, var(--color-bg-soft) 100%)',
                padding: '120px 0 60px',
                textAlign: 'center'
            }}>
                <div className="container">
                    <nav className="breadcrumb" style={{ marginBottom: '20px' }}>
                        <Link to="/">Головна</Link>
                        <span> / </span>
                        <span>Доставка та оплата</span>
                    </nav>
                    <h1>Доставка та оплата</h1>
                </div>
            </section>

            <section className="section" style={{ background: '#fff' }}>
                <div className="container" style={{ maxWidth: '900px' }}>
                    <div style={{ marginBottom: '60px' }}>
                        <h2 style={{ marginBottom: '30px', color: 'var(--color-primary)' }}>Доставка</h2>

                        <div style={{ marginBottom: '30px', padding: '30px', background: 'var(--color-bg-cream)', borderRadius: '16px' }}>
                            <h3 style={{ marginBottom: '15px' }}>Нова Пошта</h3>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                <li style={{ marginBottom: '10px', paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: 'var(--color-primary)' }}>✓</span>
                                    Доставка у відділення — 1-3 дні
                                </li>
                                <li style={{ marginBottom: '10px', paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: 'var(--color-primary)' }}>✓</span>
                                    Кур'єрська доставка за адресою
                                </li>
                                <li style={{ marginBottom: '10px', paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: 'var(--color-primary)' }}>✓</span>
                                    Поштомат Нової Пошти
                                </li>
                            </ul>
                        </div>

                        <div style={{ marginBottom: '30px', padding: '30px', background: 'var(--color-bg-cream)', borderRadius: '16px' }}>
                            <h3 style={{ marginBottom: '15px' }}>Укрпошта</h3>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                <li style={{ marginBottom: '10px', paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: 'var(--color-primary)' }}>✓</span>
                                    Доставка у відділення — 3-7 днів
                                </li>
                            </ul>
                        </div>

                        <div style={{ padding: '20px', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)', borderRadius: '16px', color: '#fff', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                            <strong>Ми доставляємо по всій Україні — Нова Пошта та Укрпошта</strong>
                        </div>
                    </div>

                    <div id="payment">
                        <h2 style={{ marginBottom: '30px', color: 'var(--color-primary)' }}>Оплата</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                            <div style={{ padding: '30px', background: 'var(--color-bg-cream)', borderRadius: '16px' }}>
                                <h3 style={{ marginBottom: '15px' }}>Оплата онлайн</h3>
                                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '15px' }}>
                                    Visa, Mastercard, Apple Pay, Google Pay
                                </p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <span className="payment-badge" style={{ background: 'var(--color-primary)', color: '#fff' }}>Visa</span>
                                    <span className="payment-badge" style={{ background: 'var(--color-primary)', color: '#fff' }}>Mastercard</span>
                                    <span className="payment-badge" style={{ background: 'var(--color-primary)', color: '#fff' }}>Apple Pay</span>
                                </div>
                            </div>
                            <div style={{ padding: '30px', background: 'var(--color-bg-cream)', borderRadius: '16px' }}>
                                <h3 style={{ marginBottom: '15px' }}>Накладений платіж</h3>
                                <p style={{ color: 'var(--color-text-secondary)' }}>
                                    Оплата при отриманні у відділенні Нової Пошти
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '60px' }}>
                        <h2 style={{ marginBottom: '30px', color: 'var(--color-primary)' }}>Обмін та повернення</h2>
                        <div style={{ padding: '30px', background: 'var(--color-bg-cream)', borderRadius: '16px' }}>
                            <p style={{ marginBottom: '15px' }}>
                                Ви можете обміняти або повернути товар протягом <strong>14 днів</strong> з моменту отримання.
                            </p>
                            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--color-text-secondary)' }}>
                                <li style={{ marginBottom: '10px', paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0 }}>•</span>
                                    Товар повинен бути у первісному вигляді з бірками
                                </li>
                                <li style={{ marginBottom: '10px', paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0 }}>•</span>
                                    Для обміну зв'яжіться з нами за телефоном або email
                                </li>
                                <li style={{ paddingLeft: '25px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0 }}>•</span>
                                    Повернення коштів протягом 3-5 робочих днів
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
