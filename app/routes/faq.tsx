import { Link } from "react-router";
import { useState } from "react";

const FAQS = [
    {
        q: "Як підібрати правильний розмір?",
        a: "Ми створили детальну розмірну сітку з порадами щодо вимірювань. Якщо сумніваєтесь — напишіть нам, ми допоможемо знайти ідеальну посадку.",
    },
    {
        q: "Як довго триває доставка?",
        a: "Нова Пошта — 1-3 дні по Україні, Укрпошта — 3-7 днів. Безкоштовна доставка від 2000₴.",
    },
    {
        q: "Чи можна повернути товар?",
        a: "Так, у вас є 14 днів на повернення або обмін за умови збереження товарного вигляду, бірок та упаковки. Повне повернення коштів на картку протягом 3-5 робочих днів.",
    },
    {
        q: "Які способи оплати ви приймаєте?",
        a: "Онлайн картою Visa/Mastercard, Apple Pay, Google Pay (за наявності) та накладений платіж при отриманні.",
    },
    {
        q: "Чим унікальний матеріал Premium Supplex?",
        a: "Supplex — це преміум-тканина італійського стандарту якості: технологічна, дихаюча, не сковує рух. Тримає форму після десятків прань і зберігає колір.",
    },
    {
        q: "Як доглядати за виробами MIND BODY?",
        a: "Прання при 30°C, без відбілювачів, не сушити в машинці. Деталі — на сторінці «Догляд за виробами».",
    },
    {
        q: "Ви шиєте на замовлення?",
        a: "Так, у деяких випадках ми можемо взяти індивідуальне замовлення. Напишіть нам у Telegram або Viber з деталями — обговоримо.",
    },
    {
        q: "Чи є знижки для постійних клієнтів?",
        a: "Підпишіться на нашу розсилку — отримуйте промокоди, ранній доступ до нових колекцій та персональні пропозиції.",
    },
    {
        q: "Звідки ваші тканини?",
        a: "Європейські сертифіковані постачальники. Контроль якості — на нашому виробництві в Україні.",
    },
    {
        q: "Я не отримав/-ла підтвердження замовлення",
        a: "Перевірте папку «Спам». Якщо нічого немає — напишіть нам з вашим іменем та телефоном, ми перевіримо статус замовлення.",
    },
];

export function meta() {
    const siteUrl = "https://saleid.icu";
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
    };
    return [
        { title: "Часті запитання | MIND BODY" },
        {
            name: "description",
            content:
                "Відповіді на найпоширеніші питання щодо розмірів, доставки, повернення, оплати та догляду за виробами MIND BODY.",
        },
        { tagName: "link", rel: "canonical", href: `${siteUrl}/faq` },
        { property: "og:title", content: "Часті запитання | MIND BODY" },
        { property: "og:url", content: `${siteUrl}/faq` },
        { property: "og:type", content: "website" },
        { name: "robots", content: "index, follow" },
        { "script:ld+json": faqSchema },
    ];
}

export default function FAQ() {
    // Atom K: start all closed — first-open wasted viewport on mobile
    // and hid the scope of FAQ scope from the visitor.
    const [open, setOpen] = useState<number | null>(null);

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
                        <span>Часті запитання</span>
                    </nav>
                    <h1>Часті запитання</h1>
                    <p
                        style={{
                            marginTop: "12px",
                            color: "var(--color-text-secondary)",
                            maxWidth: "560px",
                            margin: "12px auto 0",
                        }}
                    >
                        Все, що варто знати, перш ніж зробити замовлення.
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "820px" }}>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {FAQS.map((item, i) => {
                            const isOpen = open === i;
                            const panelId = `faq-panel-${i}`;
                            const buttonId = `faq-btn-${i}`;
                            return (
                                <li
                                    key={i}
                                    style={{
                                        borderBottom: "1px solid var(--color-border)",
                                        padding: "4px 0",
                                    }}
                                >
                                    <button
                                        type="button"
                                        id={buttonId}
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        onClick={() => setOpen(isOpen ? null : i)}
                                        style={{
                                            width: "100%",
                                            background: "transparent",
                                            border: "none",
                                            padding: "22px 4px",
                                            textAlign: "left",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: "16px",
                                            cursor: "pointer",
                                            fontFamily: "'DM Sans', sans-serif",
                                            /* Atom K: was 17px/500 — read same weight as body
                                               paragraph.  18px/600 establishes question-as-heading. */
                                            fontSize: "18px",
                                            fontWeight: 600,
                                            color: "var(--color-text-primary)",
                                        }}
                                    >
                                        <span>{item.q}</span>
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                fontSize: "22px",
                                                color: "var(--color-primary)",
                                                transition: "transform 0.3s ease",
                                                transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                                                lineHeight: 1,
                                            }}
                                        >
                                            +
                                        </span>
                                    </button>
                                    <div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={buttonId}
                                        hidden={!isOpen}
                                        style={{
                                            paddingBottom: isOpen ? "22px" : "0",
                                            color: "var(--color-text-secondary)",
                                            lineHeight: 1.65,
                                            fontSize: "15.5px",
                                            maxWidth: "680px",
                                        }}
                                    >
                                        {item.a}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <div
                        style={{
                            marginTop: "64px",
                            padding: "32px",
                            background: "var(--color-bg-cream)",
                            borderRadius: "20px",
                            textAlign: "center",
                        }}
                    >
                        <h2 style={{ marginBottom: "12px" }}>Не знайшли відповідь?</h2>
                        <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px" }}>
                            Напишіть нам — відповімо протягом дня.
                        </p>
                        <Link
                            to="/contacts"
                            className="btn btn--primary"
                            style={{ display: "inline-block", padding: "14px 32px" }}
                        >
                            Зв'язатись
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
