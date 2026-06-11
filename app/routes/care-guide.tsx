import { LLink, useI18n } from "../i18n";
import { localeFromParamSafe, localizePath, OG_LOCALE, type Locale } from "../i18n/config";
import { DEFAULT_SITE_URL } from "../utils/site-url";

interface CareTip {
    title: string;
    text: string;
    icon: string;
}

interface CareContent {
    metaTitle: string;
    metaDescription: string;
    breadcrumbAria: string;
    breadcrumbHome: string;
    title: string;
    subtitle: string;
    tips: CareTip[];
    whyTitle: string;
    whyText: string;
    rescueTitle: string;
    rescueText: string;
    contactButton: string;
}

const CONTENT: Record<Locale, CareContent> = {
    uk: {
        metaTitle: "Догляд за виробами | MIND BODY",
        metaDescription:
            "Як правильно прати, сушити та зберігати спортивний одяг MIND BODY, щоб він зберігав форму, колір і технологічні властивості тканини.",
        breadcrumbAria: "Хлібні крихти",
        breadcrumbHome: "Головна",
        title: "Догляд за виробами",
        subtitle: "Преміум-тканини живуть довго — якщо знати, як з ними поводитись.",
        tips: [
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
        ],
        whyTitle: "Чому це важливо",
        whyText:
            "Premium Supplex та інші технологічні тканини, з яких ми шиємо, мають мікроскопічну структуру, що дихає й відводить вологу. Правильний догляд зберігає ці властивості на роки. Неправильний — псує їх за кілька прань.",
        rescueTitle: "Якщо все ж зіпсували",
        rescueText:
            "Не панікуйте. Напишіть нам — порадимо, що можна зробити. У деяких випадках виріб реально відновити. У будь-якому разі — поверніться до нас за порадою, перш ніж списувати річ.",
        contactButton: "Зв'язатись з нами",
    },
    en: {
        metaTitle: "Care Guide | MIND BODY",
        metaDescription:
            "How to wash, dry and store your MIND BODY activewear so it keeps its shape, colour and the technical properties of the fabric.",
        breadcrumbAria: "Breadcrumbs",
        breadcrumbHome: "Home",
        title: "Care Guide",
        subtitle: "Premium fabrics live a long life — if you know how to treat them.",
        tips: [
            {
                icon: "💧",
                title: "Wash at 30°C",
                text: "Gentle cycle, delicate setting. Hot water breaks down elastane and dye — cold washing triples the life of a garment.",
            },
            {
                icon: "🚫",
                title: "No bleach",
                text: "Chlorine and optical brighteners are aggressive to synthetic fibres. Use a regular liquid gel for delicates.",
            },
            {
                icon: "🌬️",
                title: "Air drying",
                text: "Skip the tumble dryer — hot air deforms the fabric. Lay the garment flat on an even surface, in the shade.",
            },
            {
                icon: "🧺",
                title: 'Apart from "rough" items',
                text: "Don't wash together with jeans, towels or anything with zippers. They create snags on fine fibres.",
            },
            {
                icon: "🔄",
                title: "Turn inside out",
                text: "Always, before every wash. It protects the outer side from friction and keeps the colour vivid.",
            },
            {
                icon: "📦",
                title: "Storage",
                text: "Fold neatly — no hangers (leggings especially will stretch out). Keep in a dry place, away from direct sun.",
            },
        ],
        whyTitle: "Why it matters",
        whyText:
            "Premium Supplex and the other technical fabrics we sew with have a microscopic structure that breathes and wicks moisture away. Proper care preserves these properties for years. Improper care ruins them within a few washes.",
        rescueTitle: "If something did go wrong",
        rescueText:
            "Don't panic. Write to us — we'll advise what can be done. In some cases a garment can genuinely be restored. Either way, come to us for advice before you write the piece off.",
        contactButton: "Contact us",
    },
    ru: {
        metaTitle: "Уход за изделиями | MIND BODY",
        metaDescription:
            "Как правильно стирать, сушить и хранить спортивную одежду MIND BODY, чтобы она сохраняла форму, цвет и технологические свойства ткани.",
        breadcrumbAria: "Хлебные крошки",
        breadcrumbHome: "Главная",
        title: "Уход за изделиями",
        subtitle: "Премиум-ткани живут долго — если знать, как с ними обращаться.",
        tips: [
            {
                icon: "💧",
                title: "Стирка при 30°C",
                text: "Мягкий цикл, деликатный режим. Горячая вода разрушает эластан и краску — холодная стирка втрое продлевает жизнь изделия.",
            },
            {
                icon: "🚫",
                title: "Без отбеливателя",
                text: "Хлор и оптические отбеливатели агрессивны к синтетическим волокнам. Используйте обычный жидкий гель для деликатных тканей.",
            },
            {
                icon: "🌬️",
                title: "Сушка на воздухе",
                text: "Не используйте сушильную машину — горячий воздух деформирует ткань. Разложите изделие на ровной поверхности в тени.",
            },
            {
                icon: "🧺",
                title: 'Отдельно от "жёстких" вещей',
                text: "Не стирайте вместе с джинсами, полотенцами, одеждой с молниями. Это образует задиры на тонких волокнах.",
            },
            {
                icon: "🔄",
                title: "Выворачивайте наизнанку",
                text: "Перед стиркой — обязательно. Это защищает лицевую сторону от трения и сохраняет цвет ярким.",
            },
            {
                icon: "📦",
                title: "Хранение",
                text: "Складывайте аккуратно, не на плечиках (особенно лосины — растягиваются). В сухом месте, подальше от прямого солнца.",
            },
        ],
        whyTitle: "Почему это важно",
        whyText:
            "Premium Supplex и другие технологичные ткани, из которых мы шьём, имеют микроскопическую структуру, которая дышит и отводит влагу. Правильный уход сохраняет эти свойства на годы. Неправильный — портит их за несколько стирок.",
        rescueTitle: "Если всё же испортили",
        rescueText:
            "Не паникуйте. Напишите нам — посоветуем, что можно сделать. В некоторых случаях изделие реально восстановить. В любом случае — обратитесь к нам за советом, прежде чем списывать вещь.",
        contactButton: "Связаться с нами",
    },
};

export function meta({ params }: { params: { lang?: string } }) {
    const locale = localeFromParamSafe(params.lang);
    const c = CONTENT[locale];
    const siteUrl = DEFAULT_SITE_URL;
    const url = `${siteUrl}${localizePath("/care-guide", locale)}`;
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

export default function CareGuide() {
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
                            maxWidth: "620px",
                            margin: "12px auto 0",
                        }}
                    >
                        {c.subtitle}
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
                        {c.tips.map((tip, i) => (
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
                            {c.whyTitle}
                        </h2>
                        <p style={{ opacity: 0.95, lineHeight: 1.7, fontSize: "16px" }}>
                            {c.whyText}
                        </p>
                    </div>

                    <h2 style={{ marginBottom: "20px", color: "var(--color-primary)" }}>
                        {c.rescueTitle}
                    </h2>
                    <p
                        style={{
                            marginBottom: "24px",
                            color: "var(--color-text-secondary)",
                            lineHeight: 1.65,
                        }}
                    >
                        {c.rescueText}
                    </p>

                    <LLink
                        to="/contacts"
                        className="btn btn--primary"
                        style={{ display: "inline-block", padding: "14px 32px" }}
                    >
                        {c.contactButton}
                    </LLink>
                </div>
            </section>
        </main>
    );
}
