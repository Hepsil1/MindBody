import { LLink, useI18n } from "../i18n";

// Extensionless SSR routes ship no Cache-Control unless the route opts in
// (Caddy's @html matcher only covers / and *.html). Match / and /about.
export function headers() {
    return { "Cache-Control": "no-cache" };
}

const CONTENT = {
    uk: {
        breadcrumbHome: "Головна",
        title: "Доставка та оплата",
        deliveryHeading: "Доставка",
        paidBanner:
            "За тарифами Нової Пошти: ≈70–120 ₴ залежно від ваги та маршруту, оплата при отриманні.",
        carriers: [
            {
                name: "Нова Пошта",
                items: [
                    "Доставка у відділення — 1-3 дні",
                    "Кур'єрська доставка за адресою",
                    "Поштомат Нової Пошти",
                ],
            },
            {
                name: "Укрпошта",
                items: ["Доставка у відділення — 3-7 днів"],
            },
        ],
        coverage: "Ми доставляємо по всій Україні — Нова Пошта та Укрпошта",
        paymentHeading: "Оплата",
        cardTitle: "Оплата карткою при отриманні",
        cardText:
            "Visa або Mastercard — на терміналі у відділенні Нової Пошти при отриманні замовлення.",
        codTitle: "Накладений платіж",
        codText: "Оплата при отриманні у відділенні Нової Пошти",
        returnsHeading: "Обмін та повернення",
        returnsLead1: "Ви можете обміняти або повернути товар протягом",
        returnsLeadStrong: "14 днів",
        returnsLead2: "з моменту отримання.",
        returnsList: [
            "Товар повинен бути у первісному вигляді з бірками",
            "Для обміну зв'яжіться з нами за телефоном або email",
            "Повернення коштів протягом 3-5 робочих днів",
        ],
    },
    en: {
        breadcrumbHome: "Home",
        title: "Delivery & Payment",
        deliveryHeading: "Delivery",
        paidBanner: "Nova Poshta rates: ≈UAH 70–120 by weight and route, paid on receipt.",
        carriers: [
            {
                name: "Nova Poshta",
                items: [
                    "Delivery to a branch — 1-3 days",
                    "Courier delivery to your address",
                    "Nova Poshta parcel locker",
                ],
            },
            {
                name: "Ukrposhta",
                items: ["Delivery to a branch — 3-7 days"],
            },
        ],
        coverage: "We deliver all over Ukraine — Nova Poshta and Ukrposhta",
        paymentHeading: "Payment",
        cardTitle: "Pay by card on delivery",
        cardText:
            "Visa or Mastercard — at the terminal of the Nova Poshta branch when you receive your order.",
        codTitle: "Cash on delivery",
        codText: "Payment upon receipt at the Nova Poshta branch",
        returnsHeading: "Exchanges & Returns",
        returnsLead1: "You can exchange or return an item within",
        returnsLeadStrong: "14 days",
        returnsLead2: "of receiving it.",
        returnsList: [
            "The item must be in its original condition with tags attached",
            "To arrange an exchange, contact us by phone or email",
            "Refunds are processed within 3-5 business days",
        ],
    },
    ru: {
        breadcrumbHome: "Главная",
        title: "Доставка и оплата",
        deliveryHeading: "Доставка",
        paidBanner:
            "По тарифам Новой Почты: ≈70–120 ₴ в зависимости от веса и маршрута, оплата при получении.",
        carriers: [
            {
                name: "Новая Почта",
                items: [
                    "Доставка в отделение — 1-3 дня",
                    "Курьерская доставка по адресу",
                    "Почтомат Новой Почты",
                ],
            },
            {
                name: "Укрпочта",
                items: ["Доставка в отделение — 3-7 дней"],
            },
        ],
        coverage: "Мы доставляем по всей Украине — Новая Почта и Укрпочта",
        paymentHeading: "Оплата",
        cardTitle: "Оплата картой при получении",
        cardText:
            "Visa или Mastercard — на терминале в отделении Новой Почты при получении заказа.",
        codTitle: "Наложенный платёж",
        codText: "Оплата при получении в отделении Новой Почты",
        returnsHeading: "Обмен и возврат",
        returnsLead1: "Вы можете обменять или вернуть товар в течение",
        returnsLeadStrong: "14 дней",
        returnsLead2: "с момента получения.",
        returnsList: [
            "Товар должен быть в первоначальном виде с бирками",
            "Для обмена свяжитесь с нами по телефону или email",
            "Возврат средств в течение 3-5 рабочих дней",
        ],
    },
} as const;

export default function Delivery() {
    const { locale } = useI18n();
    const c = CONTENT[locale];

    return (
        <main className="delivery-page">
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
                    <nav className="breadcrumb" style={{ marginBottom: "20px" }}>
                        <LLink to="/">{c.breadcrumbHome}</LLink>
                        <span> / </span>
                        <span>{c.title}</span>
                    </nav>
                    <h1>{c.title}</h1>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "900px" }}>
                    <div style={{ marginBottom: "60px" }}>
                        <h2 style={{ marginBottom: "30px", color: "var(--color-primary)" }}>
                            {c.deliveryHeading}
                        </h2>

                        {/* Honest shipping line: there is no free-shipping threshold —
                            delivery is always paid to the carrier on receipt (Nova Poshta
                            tariff), with a typical price range so the buyer can plan. */}
                        <div
                            style={{
                                marginBottom: "30px",
                                padding: "24px 30px",
                                background:
                                    "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                                borderRadius: "16px",
                                color: "#fff",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                            }}
                        >
                            <span style={{ opacity: 0.92 }}>{c.paidBanner}</span>
                        </div>

                        {c.carriers.map((carrier) => (
                            <div
                                key={carrier.name}
                                style={{
                                    marginBottom: "30px",
                                    padding: "30px",
                                    background: "var(--color-bg-cream)",
                                    borderRadius: "16px",
                                }}
                            >
                                <h3 style={{ marginBottom: "15px" }}>{carrier.name}</h3>
                                <ul style={{ listStyle: "none", padding: 0 }}>
                                    {carrier.items.map((item) => (
                                        <li
                                            key={item}
                                            style={{
                                                marginBottom: "10px",
                                                paddingLeft: "25px",
                                                position: "relative",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    left: 0,
                                                    color: "var(--color-primary)",
                                                }}
                                            >
                                                ✓
                                            </span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}

                        <div
                            style={{
                                padding: "20px",
                                background:
                                    "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                                borderRadius: "16px",
                                color: "#fff",
                                textAlign: "center",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                            <strong>{c.coverage}</strong>
                        </div>
                    </div>

                    <div id="payment">
                        <h2 style={{ marginBottom: "30px", color: "var(--color-primary)" }}>
                            {c.paymentHeading}
                        </h2>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "20px",
                            }}
                        >
                            <div
                                style={{
                                    padding: "30px",
                                    background: "var(--color-bg-cream)",
                                    borderRadius: "16px",
                                }}
                            >
                                <h3 style={{ marginBottom: "15px" }}>{c.cardTitle}</h3>
                                <p
                                    style={{
                                        color: "var(--color-text-secondary)",
                                        marginBottom: "15px",
                                    }}
                                >
                                    {c.cardText}
                                </p>
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    <span
                                        className="payment-badge"
                                        style={{
                                            background: "var(--color-primary)",
                                            color: "#fff",
                                        }}
                                    >
                                        Visa
                                    </span>
                                    <span
                                        className="payment-badge"
                                        style={{
                                            background: "var(--color-primary)",
                                            color: "#fff",
                                        }}
                                    >
                                        Mastercard
                                    </span>
                                </div>
                            </div>
                            <div
                                style={{
                                    padding: "30px",
                                    background: "var(--color-bg-cream)",
                                    borderRadius: "16px",
                                }}
                            >
                                <h3 style={{ marginBottom: "15px" }}>{c.codTitle}</h3>
                                <p style={{ color: "var(--color-text-secondary)" }}>{c.codText}</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: "60px" }}>
                        <h2 style={{ marginBottom: "30px", color: "var(--color-primary)" }}>
                            {c.returnsHeading}
                        </h2>
                        <div
                            style={{
                                padding: "30px",
                                background: "var(--color-bg-cream)",
                                borderRadius: "16px",
                            }}
                        >
                            <p style={{ marginBottom: "15px" }}>
                                {c.returnsLead1} <strong>{c.returnsLeadStrong}</strong>{" "}
                                {c.returnsLead2}
                            </p>
                            <ul
                                style={{
                                    listStyle: "none",
                                    padding: 0,
                                    color: "var(--color-text-secondary)",
                                }}
                            >
                                {c.returnsList.map((item, i) => (
                                    <li
                                        key={item}
                                        style={{
                                            marginBottom:
                                                i < c.returnsList.length - 1 ? "10px" : undefined,
                                            paddingLeft: "25px",
                                            position: "relative",
                                        }}
                                    >
                                        <span style={{ position: "absolute", left: 0 }}>•</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
