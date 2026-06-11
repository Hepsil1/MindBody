import { LLink, useI18n } from "../i18n";
import { localeFromParamSafe, localizePath, OG_LOCALE } from "../i18n/config";
import { DEFAULT_SITE_URL } from "../utils/site-url";

const CONTENT = {
    uk: {
        metaTitle: "Повернення та обмін | MIND BODY",
        metaDescription:
            "Як повернути або обміняти товар MIND BODY: 14 днів, прості умови, повне повернення коштів.",
        breadcrumbLabel: "Хлібні крихти",
        breadcrumbHome: "Головна",
        breadcrumbHere: "Повернення",
        title: "Повернення та обмін",
        heroSub: "14 днів на роздуми. Без зайвих питань.",
        bannerTitle: "14 днів — щоб переконатись",
        bannerText:
            "Якщо щось не підійшло — поверніть або обміняйте без пояснень. Ми хочемо, щоб ви носили те, що по-справжньому подобається.",
        conditionsTitle: "Умови повернення",
        conditions: [
            { label: "Термін:", text: "14 календарних днів з моменту отримання." },
            {
                label: "Стан товару:",
                text: "новий, не носився, з усіма бірками та оригінальною упаковкою.",
            },
            {
                label: "Чек/підтвердження:",
                text: "номер замовлення або email на який оформлювали.",
            },
        ],
        stepsTitle: "Як повернути — 3 кроки",
        steps: [
            {
                title: "Напишіть нам",
                text: "В Telegram, Viber або на пошту з номером замовлення.",
            },
            { title: "Відправте товар", text: "Новою Поштою на адресу, яку ми надамо." },
            { title: "Отримайте кошти", text: "Повернення на картку — 3-5 робочих днів." },
        ],
        nonReturnableTitle: "Що неможливо повернути",
        nonReturnable: [
            "Білизну та купальники — з міркувань гігієни.",
            "Товари зі слідами носіння, прання, без бірок.",
            "Товари, придбані за спеціальною акцією «без повернення» (зазначається на сторінці товару).",
        ],
        exchangeTitle: "Обмін",
        exchangeText:
            "Можна обміняти на інший розмір, колір або модель тієї ж ціни. Якщо ціна нової моделі вища — доплачуєте різницю, якщо нижча — повернемо різницю.",
        contactTitle: "Зв'язатись",
        contactBefore: "Найшвидше —",
        contactLink: "через сторінку контактів",
        contactAfter: "або у Telegram/Viber. Ми відповідаємо протягом дня.",
    },
    en: {
        metaTitle: "Returns & Exchanges | MIND BODY",
        metaDescription:
            "How to return or exchange a MIND BODY item: 14 days, simple terms, full refund.",
        breadcrumbLabel: "Breadcrumbs",
        breadcrumbHome: "Home",
        breadcrumbHere: "Returns",
        title: "Returns & Exchanges",
        heroSub: "14 days to decide. No questions asked.",
        bannerTitle: "14 days — to be sure",
        bannerText:
            "If something doesn't fit — return or exchange it, no explanations needed. We want you to wear what you truly love.",
        conditionsTitle: "Return conditions",
        conditions: [
            { label: "Time frame:", text: "14 calendar days from the moment of receipt." },
            {
                label: "Item condition:",
                text: "new, unworn, with all tags and the original packaging.",
            },
            {
                label: "Receipt/confirmation:",
                text: "your order number or the email used to place the order.",
            },
        ],
        stepsTitle: "How to return — 3 steps",
        steps: [
            {
                title: "Message us",
                text: "On Telegram, Viber or by email with your order number.",
            },
            { title: "Send the item", text: "By Nova Poshta to the address we provide." },
            { title: "Get your refund", text: "Refund to your card — 3-5 business days." },
        ],
        nonReturnableTitle: "What can't be returned",
        nonReturnable: [
            "Underwear and swimwear — for hygiene reasons.",
            "Items with signs of wear or washing, or without tags.",
            "Items bought under a special “no returns” promotion (indicated on the product page).",
        ],
        exchangeTitle: "Exchange",
        exchangeText:
            "You can exchange for another size, color or a model of the same price. If the new model costs more, you pay the difference; if less, we refund the difference.",
        contactTitle: "Get in touch",
        contactBefore: "Fastest —",
        contactLink: "via the contacts page",
        contactAfter: "or on Telegram/Viber. We reply within a day.",
    },
    ru: {
        metaTitle: "Возврат и обмен | MIND BODY",
        metaDescription:
            "Как вернуть или обменять товар MIND BODY: 14 дней, простые условия, полный возврат средств.",
        breadcrumbLabel: "Хлебные крошки",
        breadcrumbHome: "Главная",
        breadcrumbHere: "Возврат",
        title: "Возврат и обмен",
        heroSub: "14 дней на раздумья. Без лишних вопросов.",
        bannerTitle: "14 дней — чтобы убедиться",
        bannerText:
            "Если что-то не подошло — верните или обменяйте без объяснений. Мы хотим, чтобы вы носили то, что по-настоящему нравится.",
        conditionsTitle: "Условия возврата",
        conditions: [
            { label: "Срок:", text: "14 календарных дней с момента получения." },
            {
                label: "Состояние товара:",
                text: "новый, не носился, со всеми бирками и оригинальной упаковкой.",
            },
            {
                label: "Чек/подтверждение:",
                text: "номер заказа или email, на который оформляли.",
            },
        ],
        stepsTitle: "Как вернуть — 3 шага",
        steps: [
            {
                title: "Напишите нам",
                text: "В Telegram, Viber или на почту с номером заказа.",
            },
            { title: "Отправьте товар", text: "Новой Почтой по адресу, который мы предоставим." },
            { title: "Получите деньги", text: "Возврат на карту — 3-5 рабочих дней." },
        ],
        nonReturnableTitle: "Что нельзя вернуть",
        nonReturnable: [
            "Бельё и купальники — из соображений гигиены.",
            "Товары со следами носки, стирки, без бирок.",
            "Товары, купленные по специальной акции «без возврата» (указывается на странице товара).",
        ],
        exchangeTitle: "Обмен",
        exchangeText:
            "Можно обменять на другой размер, цвет или модель той же цены. Если цена новой модели выше — доплачиваете разницу, если ниже — вернём разницу.",
        contactTitle: "Связаться",
        contactBefore: "Быстрее всего —",
        contactLink: "через страницу контактов",
        contactAfter: "или в Telegram/Viber. Мы отвечаем в течение дня.",
    },
} as const;

export function meta({ params }: { params: { lang?: string } }) {
    const locale = localeFromParamSafe(params.lang);
    const c = CONTENT[locale];
    const siteUrl = DEFAULT_SITE_URL;
    const url = `${siteUrl}${localizePath("/return-policy", locale)}`;
    return [
        { title: c.metaTitle },
        {
            name: "description",
            content: c.metaDescription,
        },
        { tagName: "link", rel: "canonical", href: url },
        { property: "og:title", content: c.metaTitle },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "og:locale", content: OG_LOCALE[locale] },
        { name: "robots", content: "index, follow" },
    ];
}

export default function ReturnPolicy() {
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
                        aria-label={c.breadcrumbLabel}
                        style={{ marginBottom: "20px" }}
                    >
                        <LLink to="/">{c.breadcrumbHome}</LLink>
                        <span aria-hidden="true"> / </span>
                        <span>{c.breadcrumbHere}</span>
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
                        {c.heroSub}
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
                        <h2 style={{ marginBottom: "12px", color: "#fff" }}>{c.bannerTitle}</h2>
                        <p style={{ opacity: 0.92, fontSize: "17px", lineHeight: 1.6 }}>
                            {c.bannerText}
                        </p>
                    </div>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        {c.conditionsTitle}
                    </h2>
                    <ul>
                        {c.conditions.map((item) => (
                            <li key={item.label}>
                                <strong>{item.label}</strong> {item.text}
                            </li>
                        ))}
                    </ul>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        {c.stepsTitle}
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "20px",
                            marginBottom: "32px",
                        }}
                    >
                        {c.steps.map((step, i) => (
                            <div
                                key={step.title}
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
                                    {i + 1}
                                </div>
                                <strong>{step.title}</strong>
                                <p
                                    style={{
                                        marginTop: "8px",
                                        color: "var(--color-text-secondary)",
                                        fontSize: "14px",
                                    }}
                                >
                                    {step.text}
                                </p>
                            </div>
                        ))}
                    </div>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        {c.nonReturnableTitle}
                    </h2>
                    <ul>
                        {c.nonReturnable.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        {c.exchangeTitle}
                    </h2>
                    <p>{c.exchangeText}</p>

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        {c.contactTitle}
                    </h2>
                    <p style={{ marginBottom: "40px" }}>
                        {c.contactBefore} <LLink to="/contacts">{c.contactLink}</LLink>{" "}
                        {c.contactAfter}
                    </p>
                </div>
            </section>
        </main>
    );
}
