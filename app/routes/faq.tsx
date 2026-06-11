import { useState } from "react";
import { LLink, useI18n } from "../i18n";
import { localeFromParamSafe, localizePath, OG_LOCALE, type Locale } from "../i18n/config";
import { DEFAULT_SITE_URL } from "../utils/site-url";

interface FaqItem {
    q: string;
    a: string;
}

interface FaqContent {
    metaTitle: string;
    metaDescription: string;
    breadcrumbAria: string;
    breadcrumbHome: string;
    title: string;
    subtitle: string;
    ctaTitle: string;
    ctaText: string;
    ctaButton: string;
    faqs: FaqItem[];
}

const CONTENT: Record<Locale, FaqContent> = {
    uk: {
        metaTitle: "Часті запитання | MIND BODY",
        metaDescription:
            "Відповіді на найпоширеніші питання щодо розмірів, доставки, повернення, оплати та догляду за виробами MIND BODY.",
        breadcrumbAria: "Хлібні крихти",
        breadcrumbHome: "Головна",
        title: "Часті запитання",
        subtitle: "Все, що варто знати, перш ніж зробити замовлення.",
        ctaTitle: "Не знайшли відповідь?",
        ctaText: "Напишіть нам — відповімо протягом дня.",
        ctaButton: "Зв'язатись",
        faqs: [
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
        ],
    },
    en: {
        metaTitle: "FAQ | MIND BODY",
        metaDescription:
            "Answers to the most common questions about sizing, delivery, returns, payment and caring for MIND BODY pieces.",
        breadcrumbAria: "Breadcrumbs",
        breadcrumbHome: "Home",
        title: "FAQ",
        subtitle: "Everything worth knowing before you place an order.",
        ctaTitle: "Didn't find your answer?",
        ctaText: "Write to us — we reply within a day.",
        ctaButton: "Contact us",
        faqs: [
            {
                q: "How do I choose the right size?",
                a: "We've put together a detailed size chart with measuring tips. If you're unsure, just message us — we'll help you find the perfect fit.",
            },
            {
                q: "How long does delivery take?",
                a: "Nova Poshta — 1-3 days across Ukraine, Ukrposhta — 3-7 days. Free delivery on orders from 2000₴.",
            },
            {
                q: "Can I return an item?",
                a: "Yes — you have 14 days to return or exchange, provided the item is unworn, with tags and packaging intact. Full refunds go back to your card within 3-5 business days.",
            },
            {
                q: "What payment methods do you accept?",
                a: "Online by Visa/Mastercard, Apple Pay, Google Pay (where available), and cash on delivery.",
            },
            {
                q: "What makes Premium Supplex unique?",
                a: "Supplex is a premium fabric made to Italian quality standards: technical, breathable and never restricting movement. It holds its shape through dozens of washes and keeps its colour.",
            },
            {
                q: "How do I care for MIND BODY pieces?",
                a: "Wash at 30°C, no bleach, no tumble drying. Full details are on our Care Guide page.",
            },
            {
                q: "Do you sew to order?",
                a: "Yes, in some cases we can take a custom order. Message us on Telegram or Viber with the details — let's discuss it.",
            },
            {
                q: "Are there discounts for loyal customers?",
                a: "Subscribe to our newsletter — get promo codes, early access to new collections and personal offers.",
            },
            {
                q: "Where do your fabrics come from?",
                a: "Certified European suppliers. Quality control happens at our own production in Ukraine.",
            },
            {
                q: "I haven't received my order confirmation",
                a: "Check your Spam folder. If there's nothing there, message us with your name and phone number — we'll check your order status.",
            },
        ],
    },
    ru: {
        metaTitle: "Частые вопросы | MIND BODY",
        metaDescription:
            "Ответы на самые частые вопросы о размерах, доставке, возврате, оплате и уходе за изделиями MIND BODY.",
        breadcrumbAria: "Хлебные крошки",
        breadcrumbHome: "Главная",
        title: "Частые вопросы",
        subtitle: "Всё, что стоит знать, прежде чем сделать заказ.",
        ctaTitle: "Не нашли ответ?",
        ctaText: "Напишите нам — ответим в течение дня.",
        ctaButton: "Связаться",
        faqs: [
            {
                q: "Как подобрать правильный размер?",
                a: "Мы создали подробную размерную сетку с советами по измерениям. Если сомневаетесь — напишите нам, мы поможем найти идеальную посадку.",
            },
            {
                q: "Как долго длится доставка?",
                a: "Новая Почта — 1-3 дня по Украине, Укрпочта — 3-7 дней. Бесплатная доставка от 2000₴.",
            },
            {
                q: "Можно ли вернуть товар?",
                a: "Да, у вас есть 14 дней на возврат или обмен при условии сохранения товарного вида, бирок и упаковки. Полный возврат средств на карту в течение 3-5 рабочих дней.",
            },
            {
                q: "Какие способы оплаты вы принимаете?",
                a: "Онлайн картой Visa/Mastercard, Apple Pay, Google Pay (при наличии) и наложенный платёж при получении.",
            },
            {
                q: "Чем уникален материал Premium Supplex?",
                a: "Supplex — это премиум-ткань итальянского стандарта качества: технологичная, дышащая, не сковывает движения. Держит форму после десятков стирок и сохраняет цвет.",
            },
            {
                q: "Как ухаживать за изделиями MIND BODY?",
                a: "Стирка при 30°C, без отбеливателей, не сушить в машинке. Подробности — на странице «Уход за изделиями».",
            },
            {
                q: "Вы шьёте на заказ?",
                a: "Да, в некоторых случаях мы можем взять индивидуальный заказ. Напишите нам в Telegram или Viber с деталями — обсудим.",
            },
            {
                q: "Есть ли скидки для постоянных клиентов?",
                a: "Подпишитесь на нашу рассылку — получайте промокоды, ранний доступ к новым коллекциям и персональные предложения.",
            },
            {
                q: "Откуда ваши ткани?",
                a: "Европейские сертифицированные поставщики. Контроль качества — на нашем производстве в Украине.",
            },
            {
                q: "Я не получил/-ла подтверждение заказа",
                a: "Проверьте папку «Спам». Если ничего нет — напишите нам с вашим именем и телефоном, мы проверим статус заказа.",
            },
        ],
    },
};

export function meta({ params }: { params: { lang?: string } }) {
    const locale = localeFromParamSafe(params.lang);
    const c = CONTENT[locale];
    const siteUrl = DEFAULT_SITE_URL;
    const url = `${siteUrl}${localizePath("/faq", locale)}`;
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: OG_LOCALE[locale].replace("_", "-"),
        mainEntity: c.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
    };
    return [
        { title: c.metaTitle },
        {
            name: "description",
            content: c.metaDescription,
        },
        { tagName: "link", rel: "canonical", href: url },
        { property: "og:title", content: c.metaTitle },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: OG_LOCALE[locale] },
        { name: "robots", content: "index, follow" },
        { "script:ld+json": faqSchema },
    ];
}

export default function FAQ() {
    // Atom K: start all closed — first-open wasted viewport on mobile
    // and hid the scope of FAQ scope from the visitor.
    const [open, setOpen] = useState<number | null>(null);
    const { locale } = useI18n();
    const c = CONTENT[locale];

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
                        aria-label={c.breadcrumbAria}
                        style={{ marginBottom: "20px" }}
                    >
                        <LLink to="/">{c.breadcrumbHome}</LLink>
                        <span aria-hidden="true"> / </span>
                        <span>{c.title}</span>
                    </nav>
                    <h1>{c.title}</h1>
                    <p
                        style={{
                            marginTop: "12px",
                            color: "var(--color-text-secondary)",
                            maxWidth: "560px",
                            margin: "12px auto 0",
                        }}
                    >
                        {c.subtitle}
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "820px" }}>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {c.faqs.map((item, i) => {
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
                        <h2 style={{ marginBottom: "12px" }}>{c.ctaTitle}</h2>
                        <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px" }}>
                            {c.ctaText}
                        </p>
                        <LLink
                            to="/contacts"
                            className="btn btn--primary"
                            style={{ display: "inline-block", padding: "14px 32px" }}
                        >
                            {c.ctaButton}
                        </LLink>
                    </div>
                </div>
            </section>
        </main>
    );
}
