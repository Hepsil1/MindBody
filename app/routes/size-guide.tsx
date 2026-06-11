import { LLink, useI18n } from "../i18n";
import { localeFromParamSafe, localizePath, OG_LOCALE, type Locale } from "../i18n/config";
import { DEFAULT_SITE_URL } from "../utils/site-url";
import "../styles/size-guide.css";

interface SizeGuideContent {
    metaTitle: string;
    metaDescription: string;
    breadcrumbHome: string;
    title: string;
    subtitle: string;
    womenTitle: string;
    kidsTitle: string;
    sizeHeader: string;
    bustRow: string;
    waistRow: string;
    hipsRow: string;
    ageRow: string;
    heightRow: string;
    tipsTitle: string;
    tipBustTitle: string;
    tipBustText: string;
    tipWaistTitle: string;
    tipWaistText: string;
    tipHipsTitle: string;
    tipHipsText: string;
    ctaText: string;
    ctaButton: string;
}

const CONTENT: Record<Locale, SizeGuideContent> = {
    uk: {
        metaTitle: "Розмірна сітка | MIND BODY",
        metaDescription:
            "Таблиці жіночих та дитячих розмірів MIND BODY і поради, як правильно зняти мірки, щоб обрати ідеальну посадку.",
        breadcrumbHome: "Головна",
        title: "Розмірна сітка",
        subtitle: "Як обрати правильний розмір",
        womenTitle: "Жіночі розміри",
        kidsTitle: "Дитячі розміри",
        sizeHeader: "Розмір",
        bustRow: "Обхват грудей (см)",
        waistRow: "Обхват талії (см)",
        hipsRow: "Обхват стегон (см)",
        ageRow: "Вік (років)",
        heightRow: "Зріст (см)",
        tipsTitle: "Як правильно зняти мірки",
        tipBustTitle: "Обхват грудей",
        tipBustText: "Виміряйте стрічкою по найширшій частині грудей, тримаючи її горизонтально.",
        tipWaistTitle: "Обхват талії",
        tipWaistText: "Виміряйте по найвужчій частині талії, зазвичай трохи вище пупка.",
        tipHipsTitle: "Обхват стегон",
        tipHipsText: "Виміряйте по найширшій частині стегон і сідниць.",
        ctaText: "Потрібна допомога з вибором розміру?",
        ctaButton: "Зв'язатися з нами",
    },
    en: {
        metaTitle: "Size Guide | MIND BODY",
        metaDescription:
            "MIND BODY women's and kids' size charts, plus tips on how to take your measurements for the perfect fit.",
        breadcrumbHome: "Home",
        title: "Size Guide",
        subtitle: "How to choose the right size",
        womenTitle: "Women's sizes",
        kidsTitle: "Kids' sizes",
        sizeHeader: "Size",
        bustRow: "Bust (cm)",
        waistRow: "Waist (cm)",
        hipsRow: "Hips (cm)",
        ageRow: "Age (years)",
        heightRow: "Height (cm)",
        tipsTitle: "How to take your measurements",
        tipBustTitle: "Bust",
        tipBustText: "Measure around the fullest part of your bust, keeping the tape horizontal.",
        tipWaistTitle: "Waist",
        tipWaistText:
            "Measure around the narrowest part of your waist, usually just above the navel.",
        tipHipsTitle: "Hips",
        tipHipsText: "Measure around the widest part of your hips and glutes.",
        ctaText: "Need help choosing your size?",
        ctaButton: "Contact us",
    },
    ru: {
        metaTitle: "Размерная сетка | MIND BODY",
        metaDescription:
            "Таблицы женских и детских размеров MIND BODY и советы, как правильно снять мерки, чтобы выбрать идеальную посадку.",
        breadcrumbHome: "Главная",
        title: "Размерная сетка",
        subtitle: "Как выбрать правильный размер",
        womenTitle: "Женские размеры",
        kidsTitle: "Детские размеры",
        sizeHeader: "Размер",
        bustRow: "Обхват груди (см)",
        waistRow: "Обхват талии (см)",
        hipsRow: "Обхват бёдер (см)",
        ageRow: "Возраст (лет)",
        heightRow: "Рост (см)",
        tipsTitle: "Как правильно снять мерки",
        tipBustTitle: "Обхват груди",
        tipBustText: "Измерьте лентой по самой широкой части груди, держа её горизонтально.",
        tipWaistTitle: "Обхват талии",
        tipWaistText: "Измерьте по самой узкой части талии, обычно чуть выше пупка.",
        tipHipsTitle: "Обхват бёдер",
        tipHipsText: "Измерьте по самой широкой части бёдер и ягодиц.",
        ctaText: "Нужна помощь с выбором размера?",
        ctaButton: "Связаться с нами",
    },
};

export function meta({ params }: { params: { lang?: string } }) {
    const locale = localeFromParamSafe(params.lang);
    const c = CONTENT[locale];
    const siteUrl = DEFAULT_SITE_URL;
    const url = `${siteUrl}${localizePath("/size-guide", locale)}`;
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
    ];
}

export default function SizeGuide() {
    const { locale } = useI18n();
    const c = CONTENT[locale];

    return (
        <main className="size-guide-page">
            <section className="page-hero">
                <div className="container">
                    <nav className="breadcrumb">
                        <LLink to="/">{c.breadcrumbHome}</LLink>
                        <span> / </span>
                        <span>{c.title}</span>
                    </nav>
                    <h1>{c.title}</h1>
                    <p>{c.subtitle}</p>
                </div>
            </section>

            <section className="section sg-section">
                <div className="container sg-container">
                    <div className="sg-table-group">
                        <h2>{c.womenTitle}</h2>
                        <div className="sg-table-wrap">
                            <table className="sg-table sg-table--women">
                                <thead>
                                    <tr>
                                        <th>{c.sizeHeader}</th>
                                        <th>XS</th>
                                        <th>S</th>
                                        <th>M</th>
                                        <th>L</th>
                                        <th>XL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="sg-label">{c.bustRow}</td>
                                        <td>80-84</td>
                                        <td>84-88</td>
                                        <td>88-92</td>
                                        <td>92-96</td>
                                        <td>96-100</td>
                                    </tr>
                                    <tr>
                                        <td className="sg-label">{c.waistRow}</td>
                                        <td>60-64</td>
                                        <td>64-68</td>
                                        <td>68-72</td>
                                        <td>72-76</td>
                                        <td>76-80</td>
                                    </tr>
                                    <tr>
                                        <td className="sg-label">{c.hipsRow}</td>
                                        <td>88-92</td>
                                        <td>92-96</td>
                                        <td>96-100</td>
                                        <td>100-104</td>
                                        <td>104-108</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sg-table-group">
                        <h2>{c.kidsTitle}</h2>
                        <div className="sg-table-wrap">
                            <table className="sg-table sg-table--kids">
                                <thead>
                                    <tr>
                                        <th>{c.sizeHeader}</th>
                                        <th>104</th>
                                        <th>110</th>
                                        <th>116</th>
                                        <th>122</th>
                                        <th>128</th>
                                        <th>134</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="sg-label">{c.ageRow}</td>
                                        <td>3-4</td>
                                        <td>4-5</td>
                                        <td>5-6</td>
                                        <td>6-7</td>
                                        <td>7-8</td>
                                        <td>8-9</td>
                                    </tr>
                                    <tr>
                                        <td className="sg-label">{c.heightRow}</td>
                                        <td>99-104</td>
                                        <td>105-110</td>
                                        <td>111-116</td>
                                        <td>117-122</td>
                                        <td>123-128</td>
                                        <td>129-134</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="sg-tips">
                        <h3>{c.tipsTitle}</h3>
                        <div className="sg-tips-grid">
                            <div>
                                <h4>{c.tipBustTitle}</h4>
                                <p>{c.tipBustText}</p>
                            </div>
                            <div>
                                <h4>{c.tipWaistTitle}</h4>
                                <p>{c.tipWaistText}</p>
                            </div>
                            <div>
                                <h4>{c.tipHipsTitle}</h4>
                                <p>{c.tipHipsText}</p>
                            </div>
                        </div>
                    </div>

                    <div className="sg-cta">
                        <p>{c.ctaText}</p>
                        <LLink to="/contacts" className="btn btn--primary">
                            {c.ctaButton}
                        </LLink>
                    </div>
                </div>
            </section>
        </main>
    );
}
