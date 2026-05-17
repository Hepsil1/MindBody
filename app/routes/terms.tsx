import { Link } from "react-router";

export function meta() {
    const siteUrl = "https://mindbody.com.ua";
    return [
        { title: "Умови користування | MIND BODY" },
        {
            name: "description",
            content:
                "Правила та умови користування інтернет-магазином MIND BODY. Договір публічної оферти.",
        },
        { tagName: "link", rel: "canonical", href: `${siteUrl}/terms` },
        { property: "og:title", content: "Умови користування | MIND BODY" },
        { property: "og:url", content: `${siteUrl}/terms` },
        { property: "og:type", content: "article" },
        { name: "robots", content: "index, follow" },
    ];
}

export default function Terms() {
    return (
        <main className="info-page">
            <section
                className="page-hero"
                style={{
                    background:
                        "linear-gradient(135deg, var(--color-bg-cream) 0%, var(--color-bg-soft) 100%)",
                    padding: "120px 0 60px",
                    textAlign: "center",
                }}
            >
                <div className="container">
                    <nav
                        className="breadcrumb"
                        aria-label="Хлібні крихти"
                        style={{ marginBottom: "20px" }}
                    >
                        <Link to="/">Головна</Link>
                        <span aria-hidden="true"> / </span>
                        <span>Умови користування</span>
                    </nav>
                    <h1>Умови користування</h1>
                    <p style={{ marginTop: "12px", color: "var(--color-text-secondary)" }}>
                        Договір публічної оферти · Останнє оновлення: травень 2026
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "820px" }}>
                    <p style={{ marginBottom: "24px" }}>
                        Користуючись сайтом mindbody.com.ua, ви приймаєте умови цього договору
                        публічної оферти. Якщо ви не згодні з якимось пунктом — будь ласка, не
                        оформлюйте замовлення.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        1. Загальні положення
                    </h2>
                    <p>
                        MIND BODY — український бренд преміум-одягу для йоги, гімнастики та
                        активного повсякдення. Власник торгової марки веде діяльність як суб'єкт
                        господарювання на території України.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        2. Замовлення
                    </h2>
                    <ul>
                        <li>
                            Замовлення оформлюються через корзину на сайті або через месенджери.
                        </li>
                        <li>
                            Після оформлення ви отримуєте підтвердження на email або у месенджері.
                        </li>
                        <li>
                            Ми залишаємо за собою право відмовити в замовленні у разі відсутності
                            товару або підозрілої активності.
                        </li>
                    </ul>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        3. Ціни та оплата
                    </h2>
                    <p>
                        Усі ціни вказані в гривнях (₴) з урахуванням податків. Оплата приймається
                        онлайн (картка Visa/Mastercard, Apple Pay, Google Pay — за наявності) або
                        накладеним платежем при отриманні.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        4. Доставка
                    </h2>
                    <p>
                        Доставка здійснюється Новою Поштою та Укрпоштою по всій Україні. Деталі — на
                        сторінці <Link to="/delivery">«Доставка та оплата»</Link>. Безкоштовна
                        доставка від 2000₴.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        5. Повернення та обмін
                    </h2>
                    <p>
                        Ви маєте право на обмін або повернення товару протягом 14 днів з моменту
                        отримання, за умови збереження товарного вигляду, бірок та фірмової
                        упаковки. Деталі — у <Link to="/return-policy">політиці повернення</Link>.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        6. Інтелектуальна власність
                    </h2>
                    <p>
                        Усі тексти, фото, дизайн, лого MIND BODY захищені авторським правом.
                        Використання матеріалів сайту без письмової згоди заборонене.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        7. Обмеження відповідальності
                    </h2>
                    <p>
                        MIND BODY не несе відповідальності за збитки, спричинені неправильним
                        використанням товару, недотриманням інструкцій з догляду (див.{" "}
                        <Link to="/care-guide">«Догляд за виробами»</Link>) або форс-мажорними
                        обставинами.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        8. Зміни умов
                    </h2>
                    <p>
                        Ми можемо змінювати ці умови. Актуальна версія завжди доступна на цій
                        сторінці. Продовжуючи користуватись сайтом після змін, ви приймаєте нову
                        редакцію.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        9. Контакти
                    </h2>
                    <p style={{ marginBottom: "40px" }}>
                        <a href="mailto:connect@mindbody.com.ua">connect@mindbody.com.ua</a> · Через
                        сторінку <Link to="/contacts">контактів</Link>.
                    </p>

                    <div
                        style={{
                            padding: "24px",
                            background: "var(--color-bg-cream)",
                            borderRadius: "16px",
                            borderLeft: "4px solid var(--color-primary)",
                            color: "var(--color-text-secondary)",
                            fontSize: "14px",
                        }}
                    >
                        <strong>Примітка:</strong> базовий шаблон. Рекомендуємо узгодити з юристом,
                        додати реквізити ФОП та конкретні гарантії, що відповідають вашій
                        діяльності.
                    </div>
                </div>
            </section>
        </main>
    );
}
