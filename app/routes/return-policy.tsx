import { Link } from "react-router";
import { DEFAULT_SITE_URL } from "../utils/site-url";

export function meta() {
    const siteUrl = DEFAULT_SITE_URL;
    return [
        { title: "Повернення та обмін | MIND BODY" },
        {
            name: "description",
            content:
                "Як повернути або обміняти товар MIND BODY: 14 днів, прості умови, повне повернення коштів.",
        },
        { tagName: "link", rel: "canonical", href: `${siteUrl}/return-policy` },
        { property: "og:title", content: "Повернення та обмін | MIND BODY" },
        { property: "og:url", content: `${siteUrl}/return-policy` },
        { property: "og:type", content: "article" },
        { name: "robots", content: "index, follow" },
    ];
}

export default function ReturnPolicy() {
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
                        <span>Повернення</span>
                    </nav>
                    <h1>Повернення та обмін</h1>
                    <p
                        style={{
                            marginTop: "12px",
                            color: "var(--color-text-secondary)",
                            maxWidth: "560px",
                            margin: "12px auto 0",
                        }}
                    >
                        14 днів на роздуми. Без зайвих питань.
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "820px" }}>
                    <div
                        style={{
                            padding: "32px",
                            background:
                                "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                            color: "#fff",
                            borderRadius: "20px",
                            marginBottom: "48px",
                            textAlign: "center",
                        }}
                    >
                        <h2 style={{ marginBottom: "12px", color: "#fff" }}>
                            14 днів — щоб переконатись
                        </h2>
                        <p style={{ opacity: 0.92, fontSize: "17px", lineHeight: 1.6 }}>
                            Якщо щось не підійшло — поверніть або обміняйте без пояснень. Ми хочемо,
                            щоб ви носили те, що по-справжньому подобається.
                        </p>
                    </div>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        Умови повернення
                    </h2>
                    <ul>
                        <li>
                            <strong>Термін:</strong> 14 календарних днів з моменту отримання.
                        </li>
                        <li>
                            <strong>Стан товару:</strong> новий, не носився, з усіма бірками та
                            оригінальною упаковкою.
                        </li>
                        <li>
                            <strong>Чек/підтвердження:</strong> номер замовлення або email на який
                            оформлювали.
                        </li>
                    </ul>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        Як повернути — 3 кроки
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "20px",
                            marginBottom: "32px",
                        }}
                    >
                        <div
                            style={{
                                padding: "24px",
                                background: "var(--color-bg-cream)",
                                borderRadius: "16px",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "32px",
                                    fontFamily: "'Cormorant Garamond', serif",
                                    color: "var(--color-primary)",
                                    marginBottom: "8px",
                                }}
                            >
                                1
                            </div>
                            <strong>Напишіть нам</strong>
                            <p
                                style={{
                                    marginTop: "8px",
                                    color: "var(--color-text-secondary)",
                                    fontSize: "14px",
                                }}
                            >
                                В Telegram, Viber або на пошту з номером замовлення.
                            </p>
                        </div>
                        <div
                            style={{
                                padding: "24px",
                                background: "var(--color-bg-cream)",
                                borderRadius: "16px",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "32px",
                                    fontFamily: "'Cormorant Garamond', serif",
                                    color: "var(--color-primary)",
                                    marginBottom: "8px",
                                }}
                            >
                                2
                            </div>
                            <strong>Відправте товар</strong>
                            <p
                                style={{
                                    marginTop: "8px",
                                    color: "var(--color-text-secondary)",
                                    fontSize: "14px",
                                }}
                            >
                                Новою Поштою на адресу, яку ми надамо.
                            </p>
                        </div>
                        <div
                            style={{
                                padding: "24px",
                                background: "var(--color-bg-cream)",
                                borderRadius: "16px",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "32px",
                                    fontFamily: "'Cormorant Garamond', serif",
                                    color: "var(--color-primary)",
                                    marginBottom: "8px",
                                }}
                            >
                                3
                            </div>
                            <strong>Отримайте кошти</strong>
                            <p
                                style={{
                                    marginTop: "8px",
                                    color: "var(--color-text-secondary)",
                                    fontSize: "14px",
                                }}
                            >
                                Повернення на картку — 3-5 робочих днів.
                            </p>
                        </div>
                    </div>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        Що неможливо повернути
                    </h2>
                    <ul>
                        <li>Білизну та купальники — з міркувань гігієни.</li>
                        <li>Товари зі слідами носіння, прання, без бірок.</li>
                        <li>
                            Товари, придбані за спеціальною акцією «без повернення» (зазначається на
                            сторінці товару).
                        </li>
                    </ul>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>Обмін</h2>
                    <p>
                        Можна обміняти на інший розмір, колір або модель тієї ж ціни. Якщо ціна
                        нової моделі вища — доплачуєте різницю, якщо нижча — повернемо різницю.
                    </p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>Зв'язатись</h2>
                    <p style={{ marginBottom: "40px" }}>
                        Найшвидше — <Link to="/contacts">через сторінку контактів</Link> або у
                        Telegram/Viber. Ми відповідаємо протягом дня.
                    </p>
                </div>
            </section>
        </main>
    );
}
