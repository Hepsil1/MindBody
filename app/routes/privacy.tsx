import type { Route } from "./+types/privacy";
import { Fragment } from "react";
import { LLink, useI18n } from "../i18n";
import { localeFromParamSafe, localizePath, OG_LOCALE, type Locale } from "../i18n/config";
import { DEFAULT_SITE_URL } from "../utils/site-url";

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
        title: "Політика конфіденційності | MIND BODY",
        description:
            'Як ми збираємо, зберігаємо й захищаємо ваші персональні дані. Політика конфіденційності MIND BODY відповідно до Закону України "Про захист персональних даних".',
    },
    en: {
        title: "Privacy Policy | MIND BODY",
        description:
            'How we collect, store and protect your personal data. The MIND BODY privacy policy under the Law of Ukraine "On Personal Data Protection".',
    },
    ru: {
        title: "Политика конфиденциальности | MIND BODY",
        description:
            'Как мы собираем, храним и защищаем ваши персональные данные. Политика конфиденциальности MIND BODY в соответствии с Законом Украины "О защите персональных данных".',
    },
};

export function meta({ params }: Route.MetaArgs) {
    const locale = localeFromParamSafe(params.lang);
    const m = META[locale];
    const siteUrl = DEFAULT_SITE_URL;
    const url = `${siteUrl}${localizePath("/privacy", locale)}`;
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
        pageName: "Політика конфіденційності",
        subtitle: "Останнє оновлення: травень 2026",
        intro: "MIND BODY поважає вашу приватність. Ця політика пояснює, які дані ми збираємо, як використовуємо та захищаємо їх відповідно до Закону України «Про захист персональних даних» та принципів GDPR.",
        sections: [
            {
                title: "1. Які дані ми збираємо",
                list: [
                    "Контактні дані: ім'я, прізвище, телефон, email — необхідні для оформлення та доставки замовлення.",
                    "Адресу доставки: місто, відділення Нової Пошти або Укрпошти.",
                    "Технічні дані: IP-адреса, тип браузера, час відвідування, cookies — для аналітики та безпеки.",
                    "Історію замовлень — для якісного обслуговування та повернень.",
                ],
            },
            {
                title: "2. Мета обробки даних",
                list: [
                    "Оформлення та виконання замовлення.",
                    "Комунікація щодо статусу замовлення.",
                    "Покращення сервісу та продуктів (анонімізована аналітика).",
                    "Маркетингові розсилки — лише за вашою згодою (можна відписатись у будь-який момент).",
                ],
            },
            {
                title: "3. Зберігання та захист",
                paragraphs: [
                    [
                        "Дані зберігаються на захищених серверах в Україні. Доступ мають лише уповноважені співробітники. Ми використовуємо HTTPS, шифрування паролів (bcrypt) та регулярний аудит безпеки.",
                    ],
                ],
            },
            {
                title: "4. Передача третім особам",
                paragraphs: [
                    [
                        "Ми не продаємо ваші дані. Передаємо лише партнерам, необхідним для виконання замовлення: Новій Пошті, Укрпошті, платіжним системам (LiqPay, monobank — за наявності).",
                    ],
                ],
            },
            {
                title: "5. Ваші права",
                list: [
                    "Отримати копію ваших даних, які ми зберігаємо.",
                    "Виправити неточну інформацію.",
                    "Видалити обліковий запис та персональні дані (право бути забутим).",
                    "Відписатись від розсилок одним кліком.",
                ],
            },
            {
                title: "6. Cookies",
                paragraphs: [
                    [
                        "Ми використовуємо технічні cookies (необхідні для роботи сайту) та аналітичні (для розуміння поведінки користувачів). Ви можете керувати cookies через налаштування браузера.",
                    ],
                ],
            },
        ],
        contacts: {
            title: "7. Контакти",
            parts: [
                "З питань обробки персональних даних: ",
                { email: "connect@mindbody.com.ua" },
                " або через сторінку ",
                { to: "/contacts", label: "контактів" },
                ".",
            ],
        },
        note: {
            label: "Примітка:",
            text: "цей документ — базовий шаблон. Перед публічним запуском рекомендуємо перевірити з юристом, що відповідає вашій фактичній обробці даних та реєстрації ФОП.",
        },
    },
    en: {
        breadcrumbAria: "Breadcrumbs",
        home: "Home",
        pageName: "Privacy Policy",
        subtitle: "Last updated: May 2026",
        intro: "MIND BODY respects your privacy. This policy explains what data we collect and how we use and protect it in accordance with the Law of Ukraine “On Personal Data Protection” and GDPR principles.",
        sections: [
            {
                title: "1. What Data We Collect",
                list: [
                    "Contact details: first name, last name, phone number, email — required to place and deliver your order.",
                    "Delivery address: city, Nova Poshta or Ukrposhta branch.",
                    "Technical data: IP address, browser type, time of visit, cookies — for analytics and security.",
                    "Order history — for quality service and returns.",
                ],
            },
            {
                title: "2. Purposes of Data Processing",
                list: [
                    "Placing and fulfilling your order.",
                    "Communication about your order status.",
                    "Improving our service and products (anonymised analytics).",
                    "Marketing mailings — only with your consent (you can unsubscribe at any time).",
                ],
            },
            {
                title: "3. Storage and Protection",
                paragraphs: [
                    [
                        "Data is stored on secure servers in Ukraine. Only authorised employees have access. We use HTTPS, password encryption (bcrypt) and regular security audits.",
                    ],
                ],
            },
            {
                title: "4. Sharing with Third Parties",
                paragraphs: [
                    [
                        "We do not sell your data. We share it only with the partners required to fulfil your order: Nova Poshta, Ukrposhta and payment systems (LiqPay, monobank — where available).",
                    ],
                ],
            },
            {
                title: "5. Your Rights",
                list: [
                    "Receive a copy of the data we store about you.",
                    "Correct inaccurate information.",
                    "Delete your account and personal data (the right to be forgotten).",
                    "Unsubscribe from mailings in one click.",
                ],
            },
            {
                title: "6. Cookies",
                paragraphs: [
                    [
                        "We use technical cookies (required for the website to work) and analytical cookies (to understand user behaviour). You can manage cookies in your browser settings.",
                    ],
                ],
            },
        ],
        contacts: {
            title: "7. Contacts",
            parts: [
                "For questions about personal data processing: ",
                { email: "connect@mindbody.com.ua" },
                " or via the ",
                { to: "/contacts", label: "contact page" },
                ".",
            ],
        },
        note: {
            label: "Note:",
            text: "this document is a basic template. Before a public launch, we recommend checking with a lawyer that it matches your actual data processing and business (FOP) registration.",
        },
    },
    ru: {
        breadcrumbAria: "Хлебные крошки",
        home: "Главная",
        pageName: "Политика конфиденциальности",
        subtitle: "Последнее обновление: май 2026",
        intro: "MIND BODY уважает вашу приватность. Эта политика объясняет, какие данные мы собираем, как используем и защищаем их в соответствии с Законом Украины «О защите персональных данных» и принципами GDPR.",
        sections: [
            {
                title: "1. Какие данные мы собираем",
                list: [
                    "Контактные данные: имя, фамилия, телефон, email — необходимы для оформления и доставки заказа.",
                    "Адрес доставки: город, отделение Новой Почты или Укрпочты.",
                    "Технические данные: IP-адрес, тип браузера, время посещения, cookies — для аналитики и безопасности.",
                    "Историю заказов — для качественного обслуживания и возвратов.",
                ],
            },
            {
                title: "2. Цель обработки данных",
                list: [
                    "Оформление и выполнение заказа.",
                    "Коммуникация о статусе заказа.",
                    "Улучшение сервиса и продуктов (анонимизированная аналитика).",
                    "Маркетинговые рассылки — только с вашего согласия (отписаться можно в любой момент).",
                ],
            },
            {
                title: "3. Хранение и защита",
                paragraphs: [
                    [
                        "Данные хранятся на защищённых серверах в Украине. Доступ имеют только уполномоченные сотрудники. Мы используем HTTPS, шифрование паролей (bcrypt) и регулярный аудит безопасности.",
                    ],
                ],
            },
            {
                title: "4. Передача третьим лицам",
                paragraphs: [
                    [
                        "Мы не продаём ваши данные. Передаём только партнёрам, необходимым для выполнения заказа: Новой Почте, Укрпочте, платёжным системам (LiqPay, monobank — при наличии).",
                    ],
                ],
            },
            {
                title: "5. Ваши права",
                list: [
                    "Получить копию ваших данных, которые мы храним.",
                    "Исправить неточную информацию.",
                    "Удалить учётную запись и персональные данные (право быть забытым).",
                    "Отписаться от рассылок одним кликом.",
                ],
            },
            {
                title: "6. Cookies",
                paragraphs: [
                    [
                        "Мы используем технические cookies (необходимые для работы сайта) и аналитические (для понимания поведения пользователей). Вы можете управлять cookies через настройки браузера.",
                    ],
                ],
            },
        ],
        contacts: {
            title: "7. Контакты",
            parts: [
                "По вопросам обработки персональных данных: ",
                { email: "connect@mindbody.com.ua" },
                " или через страницу ",
                { to: "/contacts", label: "контактов" },
                ".",
            ],
        },
        note: {
            label: "Примечание:",
            text: "этот документ — базовый шаблон. Перед публичным запуском рекомендуем проверить с юристом, что он соответствует вашей фактической обработке данных и регистрации ФОП.",
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

export default function Privacy() {
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
