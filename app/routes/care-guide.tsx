import { Link } from "react-router";

export function meta() {
    const siteUrl = "https://mindbody.com.ua";
    return [
        { title: "Догляд за виробами | MIND BODY" },
        {
            name: "description",
            content:
                "Як правильно прати, сушити та зберігати спортивний одяг MIND BODY, щоб він зберігав форму, колір і технологічні властивості тканини.",
        },
        { tagName: "link", rel: "canonical", href: `${siteUrl}/care-guide` },
        { property: "og:title", content: "Догляд за виробами | MIND BODY" },
        { property: "og:url", content: `${siteUrl}/care-guide` },
        { property: "og:type", content: "article" },
        { name: "robots", content: "index, follow" },
    ];
}

interface CareTip {
    title: string;
    text: string;
    icon: string;
}

const TIPS: CareTip[] = [
    {
        icon: "💧",
        title: "Прання при 30°C",
        text: "М'який цикл, делікатний режим. Гаряча вода руйнує еластан і фарбу — холодне прання продовжує життя виробу втричі.",
    },
    {
        icon: "🚫",
        title: "Без відбілювача",
        text: "Хлор та оптичні відбілювачі агресивні до синтетичних волокон. Використовуйте звичайний рідкий гель для делікатних тканин.",
    },
    {
        icon: "🌬️",
        title: "Сушіння на повітрі",
        text: "Не використовуйте сушильну машину — гаряче повітря деформує тканину. Розкладіть виріб на рівній поверхні в тіні.",
    },
    {
        icon: "🧺",
        title: 'Окремо від "жорстких" речей',
        text: "Не пріть разом з джинсами, рушниками, одягом з блискавками. Це утворює задири на тонких волокнах.",
    },
    {
        icon: "🔄",
        title: "Вивертайте навиворіт",
        text: "Перед пранням — обов'язково. Це захищає лицьовий бік від тертя та зберігає колір яскравим.",
    },
    {
        icon: "📦",
        title: "Зберігання",
        text: "Складайте акуратно, не на плечиках (особливо лосини — розтягуються). У сухому місці, подалі від прямого сонця.",
    },
];

export default function CareGuide() {
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
                        <span>Догляд за виробами</span>
                    </nav>
                    <h1>Догляд за виробами</h1>
                    <p
                        style={{
                            marginTop: "12px",
                            color: "var(--color-text-secondary)",
                            maxWidth: "620px",
                            margin: "12px auto 0",
                        }}
                    >
                        Преміум-тканини живуть довго — якщо знати, як з ними поводитись.
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "980px" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: "24px",
                            marginBottom: "64px",
                        }}
                    >
                        {TIPS.map((tip, i) => (
                            <article
                                key={i}
                                style={{
                                    padding: "28px",
                                    background: "var(--color-bg-cream)",
                                    borderRadius: "20px",
                                    border: "1px solid rgba(42, 90, 90, 0.06)",
                                }}
                            >
                                <div
                                    style={{ fontSize: "36px", marginBottom: "14px" }}
                                    aria-hidden="true"
                                >
                                    {tip.icon}
                                </div>
                                <h3 style={{ marginBottom: "10px", color: "var(--color-primary)" }}>
                                    {tip.title}
                                </h3>
                                <p
                                    style={{
                                        color: "var(--color-text-secondary)",
                                        lineHeight: 1.65,
                                        fontSize: "15px",
                                    }}
                                >
                                    {tip.text}
                                </p>
                            </article>
                        ))}
                    </div>

                    <div
                        style={{
                            padding: "40px",
                            background:
                                "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                            borderRadius: "24px",
                            color: "#fff",
                            marginBottom: "48px",
                        }}
                    >
                        <h2
                            style={{
                                color: "#fff",
                                marginBottom: "16px",
                                fontFamily: "'Cormorant Garamond', serif",
                            }}
                        >
                            Чому це важливо
                        </h2>
                        <p style={{ opacity: 0.95, lineHeight: 1.7, fontSize: "16px" }}>
                            Premium Supplex та інші технологічні тканини, з яких ми шиємо, мають
                            мікроскопічну структуру, що дихає й відводить вологу. Правильний догляд
                            зберігає ці властивості на роки. Неправильний — псує їх за кілька прань.
                        </p>
                    </div>

                    <h2 style={{ marginBottom: "20px", color: "var(--color-primary)" }}>
                        Якщо все ж зіпсували
                    </h2>
                    <p
                        style={{
                            marginBottom: "24px",
                            color: "var(--color-text-secondary)",
                            lineHeight: 1.65,
                        }}
                    >
                        Не панікуйте. Напишіть нам — порадимо, що можна зробити. У деяких випадках
                        виріб реально відновити. У будь-якому разі — поверніться до нас за порадою,
                        перш ніж списувати річ.
                    </p>

                    <Link
                        to="/contacts"
                        className="btn btn--primary"
                        style={{ display: "inline-block", padding: "14px 32px" }}
                    >
                        Зв'язатись з нами
                    </Link>
                </div>
            </section>
        </main>
    );
}
