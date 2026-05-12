import { Link } from "react-router";

export function meta() {
    const siteUrl = "https://mindbody.com.ua";
    return [
        { title: "Політика конфіденційності | MIND BODY" },
        { name: "description", content: "Як ми збираємо, зберігаємо й захищаємо ваші персональні дані. Політика конфіденційності MIND BODY відповідно до Закону України \"Про захист персональних даних\"." },
        { tagName: "link", rel: "canonical", href: `${siteUrl}/privacy` },
        { property: "og:title", content: "Політика конфіденційності | MIND BODY" },
        { property: "og:url", content: `${siteUrl}/privacy` },
        { property: "og:type", content: "article" },
        { name: "robots", content: "index, follow" },
    ];
}

export default function Privacy() {
    return (
        <main className="info-page">
            <section className="page-hero" style={{
                background: 'linear-gradient(135deg, var(--color-bg-cream) 0%, var(--color-bg-soft) 100%)',
                padding: '120px 0 60px',
                textAlign: 'center'
            }}>
                <div className="container">
                    <nav className="breadcrumb" aria-label="Хлібні крихти" style={{ marginBottom: '20px' }}>
                        <Link to="/">Головна</Link>
                        <span aria-hidden="true"> / </span>
                        <span>Політика конфіденційності</span>
                    </nav>
                    <h1>Політика конфіденційності</h1>
                    <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)' }}>
                        Останнє оновлення: травень 2026
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: '#fff' }}>
                <div className="container" style={{ maxWidth: '820px' }}>
                    <p style={{ marginBottom: '24px' }}>
                        MIND BODY поважає вашу приватність. Ця політика пояснює, які дані ми збираємо,
                        як використовуємо та захищаємо їх відповідно до Закону України
                        «Про захист персональних даних» та принципів GDPR.
                    </p>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>1. Які дані ми збираємо</h2>
                    <ul>
                        <li>Контактні дані: ім'я, прізвище, телефон, email — необхідні для оформлення та доставки замовлення.</li>
                        <li>Адресу доставки: місто, відділення Нової Пошти або Укрпошти.</li>
                        <li>Технічні дані: IP-адреса, тип браузера, час відвідування, cookies — для аналітики та безпеки.</li>
                        <li>Історію замовлень — для якісного обслуговування та повернень.</li>
                    </ul>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>2. Мета обробки даних</h2>
                    <ul>
                        <li>Оформлення та виконання замовлення.</li>
                        <li>Комунікація щодо статусу замовлення.</li>
                        <li>Покращення сервісу та продуктів (анонімізована аналітика).</li>
                        <li>Маркетингові розсилки — лише за вашою згодою (можна відписатись у будь-який момент).</li>
                    </ul>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>3. Зберігання та захист</h2>
                    <p>
                        Дані зберігаються на захищених серверах в Україні. Доступ мають лише уповноважені
                        співробітники. Ми використовуємо HTTPS, шифрування паролів (bcrypt) та регулярний аудит безпеки.
                    </p>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>4. Передача третім особам</h2>
                    <p>
                        Ми не продаємо ваші дані. Передаємо лише партнерам, необхідним для виконання замовлення:
                        Новій Пошті, Укрпошті, платіжним системам (LiqPay, monobank — за наявності).
                    </p>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>5. Ваші права</h2>
                    <ul>
                        <li>Отримати копію ваших даних, які ми зберігаємо.</li>
                        <li>Виправити неточну інформацію.</li>
                        <li>Видалити обліковий запис та персональні дані (право бути забутим).</li>
                        <li>Відписатись від розсилок одним кліком.</li>
                    </ul>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>6. Cookies</h2>
                    <p>
                        Ми використовуємо технічні cookies (необхідні для роботи сайту) та аналітичні
                        (для розуміння поведінки користувачів). Ви можете керувати cookies через
                        налаштування браузера.
                    </p>

                    <h2 style={{ marginTop: '40px', color: 'var(--color-primary)' }}>7. Контакти</h2>
                    <p style={{ marginBottom: '40px' }}>
                        З питань обробки персональних даних: <a href="mailto:connect@mindbody.com.ua">connect@mindbody.com.ua</a>
                        {' '}або через сторінку <Link to="/contacts">контактів</Link>.
                    </p>

                    <div style={{
                        padding: '24px',
                        background: 'var(--color-bg-cream)',
                        borderRadius: '16px',
                        borderLeft: '4px solid var(--color-primary)',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px'
                    }}>
                        <strong>Примітка:</strong> цей документ — базовий шаблон. Перед публічним запуском
                        рекомендуємо перевірити з юристом, що відповідає вашій фактичній обробці даних та реєстрації ФОП.
                    </div>
                </div>
            </section>
        </main>
    );
}
