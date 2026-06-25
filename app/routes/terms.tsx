import type { Route } from "./+types/terms";
import { Fragment } from "react";
import { LLink, useI18n } from "../i18n";
import { localeFromParamSafe, localizePath, OG_LOCALE, type Locale } from "../i18n/config";
import { DEFAULT_SITE_URL } from "../utils/site-url";

// Extensionless SSR routes ship no Cache-Control unless the route opts in
// (Caddy's @html matcher only covers / and *.html). Match / and /about.
export function headers() {
    return { "Cache-Control": "no-cache" };
}

type Inline = string | { to: string; label: string } | { email: string };

interface Section {
    title: string;
    paragraphs?: Inline[][];
    list?: string[];
}

interface PageContent {
    breadcrumbAria: string;
    home: string;
    pageName: string;
    subtitle: string;
    intro: string;
    sections: Section[];
    contacts: { title: string; parts: Inline[] };
    note: { label: string; text: string };
}

const META: Record<Locale, { title: string; description: string }> = {
    uk: {
        title: "Умови користування | MIND BODY",
        description:
            "Правила та умови користування інтернет-магазином MIND BODY. Договір публічної оферти.",
    },
    en: {
        title: "Terms of Service | MIND BODY",
        description:
            "Terms and conditions for using the MIND BODY online store. Public offer agreement.",
    },
    ru: {
        title: "Условия использования | MIND BODY",
        description:
            "Правила и условия пользования интернет-магазином MIND BODY. Договор публичной оферты.",
    },
};

export function meta({ params }: Route.MetaArgs) {
    const locale = localeFromParamSafe(params.lang);
    const m = META[locale];
    const siteUrl = DEFAULT_SITE_URL;
    const url = `${siteUrl}${localizePath("/terms", locale)}`;
    return [
        { title: m.title },
        { name: "description", content: m.description },
        { tagName: "link", rel: "canonical", href: url },
        { property: "og:title", content: m.title },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "og:locale", content: OG_LOCALE[locale] },
        { name: "robots", content: "index, follow" },
    ];
}

const CONTENT: Record<Locale, PageContent> = {
    uk: {
        breadcrumbAria: "Хлібні крихти",
        home: "Головна",
        pageName: "Умови користування",
        subtitle: "Договір публічної оферти · Останнє оновлення: травень 2026",
        intro: "Користуючись сайтом mindbody.com.ua, ви приймаєте умови цього договору публічної оферти. Якщо ви не згодні з якимось пунктом — будь ласка, не оформлюйте замовлення.",
        sections: [
            {
                title: "1. Загальні положення",
                paragraphs: [
                    [
                        "MIND BODY — український бренд преміум-одягу для йоги, гімнастики та активного повсякдення. Власник торгової марки веде діяльність як суб'єкт господарювання на території України.",
                    ],
                ],
            },
            {
                title: "2. Замовлення",
                list: [
                    "Замовлення оформлюються через корзину на сайті або через месенджери.",
                    "Після оформлення ви отримуєте підтвердження на email або у месенджері.",
                    "Ми залишаємо за собою право відмовити в замовленні у разі відсутності товару або підозрілої активності.",
                ],
            },
            {
                title: "3. Ціни та оплата",
                paragraphs: [
                    [
                        "Усі ціни вказані в гривнях (₴) з урахуванням податків. Оплата приймається онлайн (картка Visa/Mastercard, Apple Pay, Google Pay — за наявності) або накладеним платежем при отриманні.",
                    ],
                ],
            },
            {
                title: "4. Доставка",
                paragraphs: [
                    [
                        "Доставка здійснюється Новою Поштою та Укрпоштою по всій Україні. Деталі — на сторінці ",
                        { to: "/delivery", label: "«Доставка та оплата»" },
                        ". Доставка — за тарифами перевізника, оплата при отриманні.",
                    ],
                ],
            },
            {
                title: "5. Повернення та обмін",
                paragraphs: [
                    [
                        "Ви маєте право на обмін або повернення товару протягом 14 днів з моменту отримання, за умови збереження товарного вигляду, бірок та фірмової упаковки. Деталі — у ",
                        { to: "/return-policy", label: "політиці повернення" },
                        ".",
                    ],
                ],
            },
            {
                title: "6. Інтелектуальна власність",
                paragraphs: [
                    [
                        "Усі тексти, фото, дизайн, лого MIND BODY захищені авторським правом. Використання матеріалів сайту без письмової згоди заборонене.",
                    ],
                ],
            },
            {
                title: "7. Обмеження відповідальності",
                paragraphs: [
                    [
                        "MIND BODY не несе відповідальності за збитки, спричинені неправильним використанням товару, недотриманням інструкцій з догляду (див. ",
                        { to: "/care-guide", label: "«Догляд за виробами»" },
                        ") або форс-мажорними обставинами.",
                    ],
                ],
            },
            {
                title: "8. Зміни умов",
                paragraphs: [
                    [
                        "Ми можемо змінювати ці умови. Актуальна версія завжди доступна на цій сторінці. Продовжуючи користуватись сайтом після змін, ви приймаєте нову редакцію.",
                    ],
                ],
            },
        ],
        contacts: {
            title: "9. Контакти",
            parts: [
                { email: "connect@mindbody.com.ua" },
                " · Через сторінку ",
                { to: "/contacts", label: "контактів" },
                ".",
            ],
        },
        note: {
            label: "Примітка:",
            text: "базовий шаблон. Рекомендуємо узгодити з юристом, додати реквізити ФОП та конкретні гарантії, що відповідають вашій діяльності.",
        },
    },
    en: {
        breadcrumbAria: "Breadcrumbs",
        home: "Home",
        pageName: "Terms of Service",
        subtitle: "Public offer agreement · Last updated: May 2026",
        intro: "By using the mindbody.com.ua website, you accept the terms of this public offer agreement. If you disagree with any of its provisions, please do not place an order.",
        sections: [
            {
                title: "1. General Provisions",
                paragraphs: [
                    [
                        "MIND BODY is a Ukrainian premium apparel brand for yoga, gymnastics and active everyday life. The trademark owner operates as a registered business entity under the laws of Ukraine.",
                    ],
                ],
            },
            {
                title: "2. Orders",
                list: [
                    "Orders are placed through the cart on the website or via messengers.",
                    "After placing an order, you receive a confirmation by email or in a messenger.",
                    "We reserve the right to refuse an order if an item is out of stock or in case of suspicious activity.",
                ],
            },
            {
                title: "3. Prices and Payment",
                paragraphs: [
                    [
                        "All prices are listed in Ukrainian hryvnia (₴) and include taxes. Payment is accepted online (Visa/Mastercard card, Apple Pay, Google Pay — where available) or by cash on delivery upon receipt.",
                    ],
                ],
            },
            {
                title: "4. Delivery",
                paragraphs: [
                    [
                        "Delivery across Ukraine is provided by Nova Poshta and Ukrposhta. For details, see the ",
                        { to: "/delivery", label: "Delivery and Payment" },
                        " page. Delivery is charged at the carrier's rates, paid on receipt.",
                    ],
                ],
            },
            {
                title: "5. Returns and Exchanges",
                paragraphs: [
                    [
                        "You have the right to exchange or return an item within 14 days of receipt, provided that its merchantable condition, tags and branded packaging are preserved. For details, see the ",
                        { to: "/return-policy", label: "return policy" },
                        ".",
                    ],
                ],
            },
            {
                title: "6. Intellectual Property",
                paragraphs: [
                    [
                        "All texts, photos, designs and the MIND BODY logo are protected by copyright. Use of the website materials without written consent is prohibited.",
                    ],
                ],
            },
            {
                title: "7. Limitation of Liability",
                paragraphs: [
                    [
                        "MIND BODY is not liable for damages caused by improper use of the product, failure to follow the care instructions (see ",
                        { to: "/care-guide", label: "Product Care" },
                        ") or force majeure circumstances.",
                    ],
                ],
            },
            {
                title: "8. Changes to These Terms",
                paragraphs: [
                    [
                        "We may change these terms. The current version is always available on this page. By continuing to use the website after changes take effect, you accept the new version.",
                    ],
                ],
            },
        ],
        contacts: {
            title: "9. Contacts",
            parts: [
                { email: "connect@mindbody.com.ua" },
                " · Or via the ",
                { to: "/contacts", label: "contact page" },
                ".",
            ],
        },
        note: {
            label: "Note:",
            text: "this is a basic template. We recommend agreeing it with a lawyer and adding the seller's registration details (FOP) and specific warranties that match your business.",
        },
    },
    ru: {
        breadcrumbAria: "Хлебные крошки",
        home: "Главная",
        pageName: "Условия использования",
        subtitle: "Договор публичной оферты · Последнее обновление: май 2026",
        intro: "Пользуясь сайтом mindbody.com.ua, вы принимаете условия этого договора публичной оферты. Если вы не согласны с каким-либо пунктом — пожалуйста, не оформляйте заказ.",
        sections: [
            {
                title: "1. Общие положения",
                paragraphs: [
                    [
                        "MIND BODY — украинский бренд премиальной одежды для йоги, гимнастики и активной повседневности. Владелец торговой марки ведёт деятельность как субъект хозяйствования в соответствии с законодательством Украины.",
                    ],
                ],
            },
            {
                title: "2. Заказы",
                list: [
                    "Заказы оформляются через корзину на сайте или через мессенджеры.",
                    "После оформления вы получаете подтверждение на email или в мессенджере.",
                    "Мы оставляем за собой право отказать в заказе при отсутствии товара или подозрительной активности.",
                ],
            },
            {
                title: "3. Цены и оплата",
                paragraphs: [
                    [
                        "Все цены указаны в гривнах (₴) с учётом налогов. Оплата принимается онлайн (карта Visa/Mastercard, Apple Pay, Google Pay — при наличии) или наложенным платежом при получении.",
                    ],
                ],
            },
            {
                title: "4. Доставка",
                paragraphs: [
                    [
                        "Доставка осуществляется Новой Почтой и Укрпочтой по всей Украине. Подробности — на странице ",
                        { to: "/delivery", label: "«Доставка и оплата»" },
                        ". Доставка — по тарифам перевозчика, оплата при получении.",
                    ],
                ],
            },
            {
                title: "5. Возврат и обмен",
                paragraphs: [
                    [
                        "Вы имеете право на обмен или возврат товара в течение 14 дней с момента получения при условии сохранения товарного вида, бирок и фирменной упаковки. Подробности — в ",
                        { to: "/return-policy", label: "политике возврата" },
                        ".",
                    ],
                ],
            },
            {
                title: "6. Интеллектуальная собственность",
                paragraphs: [
                    [
                        "Все тексты, фото, дизайн, логотип MIND BODY защищены авторским правом. Использование материалов сайта без письменного согласия запрещено.",
                    ],
                ],
            },
            {
                title: "7. Ограничение ответственности",
                paragraphs: [
                    [
                        "MIND BODY не несёт ответственности за убытки, вызванные неправильным использованием товара, несоблюдением инструкций по уходу (см. ",
                        { to: "/care-guide", label: "«Уход за изделиями»" },
                        ") или форс-мажорными обстоятельствами.",
                    ],
                ],
            },
            {
                title: "8. Изменение условий",
                paragraphs: [
                    [
                        "Мы можем изменять эти условия. Актуальная версия всегда доступна на этой странице. Продолжая пользоваться сайтом после изменений, вы принимаете новую редакцию.",
                    ],
                ],
            },
        ],
        contacts: {
            title: "9. Контакты",
            parts: [
                { email: "connect@mindbody.com.ua" },
                " · Или через страницу ",
                { to: "/contacts", label: "контактов" },
                ".",
            ],
        },
        note: {
            label: "Примечание:",
            text: "это базовый шаблон. Рекомендуем согласовать его с юристом, добавить реквизиты ФОП и конкретные гарантии, соответствующие вашей деятельности.",
        },
    },
};

function InlineParts({ parts }: { parts: Inline[] }) {
    return (
        <>
            {parts.map((part, i) => {
                if (typeof part === "string") {
                    return <Fragment key={i}>{part}</Fragment>;
                }
                if ("email" in part) {
                    return (
                        <a key={i} href={`mailto:${part.email}`}>
                            {part.email}
                        </a>
                    );
                }
                return (
                    <LLink key={i} to={part.to}>
                        {part.label}
                    </LLink>
                );
            })}
        </>
    );
}

export default function Terms() {
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
                        <LLink to="/">{c.home}</LLink>
                        <span aria-hidden="true"> / </span>
                        <span>{c.pageName}</span>
                    </nav>
                    <h1>{c.pageName}</h1>
                    <p style={{ marginTop: "12px", color: "var(--color-text-secondary)" }}>
                        {c.subtitle}
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: "#fff" }}>
                <div className="container" style={{ maxWidth: "820px" }}>
                    <p style={{ marginBottom: "24px" }}>{c.intro}</p>

                    {c.sections.map((s) => (
                        <Fragment key={s.title}>
                            <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                                {s.title}
                            </h2>
                            {s.list ? (
                                <ul>
                                    {s.list.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {s.paragraphs?.map((parts, i) => (
                                <p key={i}>
                                    <InlineParts parts={parts} />
                                </p>
                            ))}
                        </Fragment>
                    ))}

                    <h2 style={{ marginTop: "40px", color: "var(--color-primary)" }}>
                        {c.contacts.title}
                    </h2>
                    <p style={{ marginBottom: "40px" }}>
                        <InlineParts parts={c.contacts.parts} />
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
                        <strong>{c.note.label}</strong> {c.note.text}
                    </div>
                </div>
            </section>
        </main>
    );
}
