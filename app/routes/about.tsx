import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/about";
import { buildWebpSrcset, buildAvifSrcset } from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { useI18n, LLink } from "../i18n";
import { localeFromParamSafe, OG_LOCALE } from "../i18n/config";
import { useSiteSettings, viberChatUrl, whatsappUrl } from "../utils/site-settings";
import { prisma } from "../db.server";
import { cachedFetch } from "../utils/cache.server";
import { localizeEntities } from "../utils/translations.server";
import "../styles/about-page.css";

// /about — v39 "СОНЦЕ ВЕДЕ — directed cut". In-place cinematic upgrade of the v34
// "Друга шкіра" spine, same two files, same identity (cream paper ladder, Onest 800
// + a single Spectral-italic em, the laced-back-+-sun thesis, real-logo architecture,
// the live Prisma rail). The page is now a DIRECTED FILM: forte hero → andante
// material → 3-frame motion run → forte THE BACK (new mid-page full-bleed 2-up) →
// serif climax origin → forte KIDS (rebuilt, one full-bleed + restrained 2-up) →
// lookbook valley → catalogue → resolve. TWO motion layers, both ending on the SAME
// visible state: Layer A = data-reveal + IO `.in` transitions (SSR/no-JS floor,
// restated in the scoped reduce-motion block); Layer B = CSS scroll-driven cinema via
// @supports(animation-timeline:view()) — IMMUNE to the site reduce-motion reset
// (app.css zeroes only animation-/transition-DURATION, never animation-timeline), so
// the owner (reduce-motion ON) sees every scrubbed beat natively. NO GSAP/Lenis/
// sticky/pin/morph/blend/WebGL. Colour ONLY from the garments; ambiance from grain +
// hero teal bloom + one page-wide warm vignette only. Real catalogue via the loader.

export const links: Route.LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Spectral:ital,wght@1,400;1,500&display=swap",
    },
    // LCP: preload the hero back-shot (AVIF responsive set), sized to match the
    // hero <Pic> (full-width on mobile, half on desktop).
    {
        rel: "preload",
        as: "image",
        imageSrcSet: buildAvifSrcset("/generalpics/347_131123.webp"),
        imageSizes: "(max-width:860px) 100vw, 50vw",
        type: "image/avif",
    },
];

const META = {
    uk: {
        title: "Про бренд | MIND BODY",
        description:
            "MIND BODY — український бренд одягу для руху: м’яка тканина, що тягнеться, плетена спина і вишите сонце. Жіноча та дитяча лінії. Зшито в Україні.",
        ogTitle: "MIND BODY — м’який одяг для руху",
        ogDescription: "Український бренд одягу для жінок і дітей, які рухаються. Зшито в Україні.",
    },
    en: {
        title: "About the Brand | MIND BODY",
        description:
            "MIND BODY is a Ukrainian clothing brand made for movement: soft fabric that stretches, a laced back and an embroidered sun. Women’s and kids’ lines. Sewn in Ukraine.",
        ogTitle: "MIND BODY — soft clothing made for movement",
        ogDescription: "A Ukrainian brand for women and kids who move. Sewn in Ukraine.",
    },
    ru: {
        title: "О бренде | MIND BODY",
        description:
            "MIND BODY — украинский бренд одежды для движения: мягкая тянущаяся ткань, плетёная спина и вышитое солнце. Женская и детская линии. Сшито в Украине.",
        ogTitle: "MIND BODY — мягкая одежда для движения",
        ogDescription: "Украинский бренд для женщин и детей, которые двигаются. Сшито в Украине.",
    },
} as const;

export function meta({ params }: Route.MetaArgs) {
    const locale = localeFromParamSafe(params.lang);
    const m = META[locale];
    return [
        { title: m.title },
        { name: "description", content: m.description },
        { property: "og:title", content: m.ogTitle },
        { property: "og:description", content: m.ogDescription },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "/generalpics/347_131123.webp" },
        { property: "og:locale", content: OG_LOCALE[locale] },
    ];
}

export function headers() {
    return { "Cache-Control": "no-cache" };
}

// curated, real, active products spanning colour + category (filler keeps the
// gallery full if a slug is renamed/archived).
const GALLERY_SLUGS = [
    "kombinezon-dance",
    "komplekt-pilon",
    "velo-aera",
    "kombinezon-solar",
    "komplekt-mesh",
    "kombinezon-mini",
    "longsliv-calm",
    "hudi-ease",
];

export async function loader({ params }: Route.LoaderArgs) {
    const locale = localeFromParamSafe(params.lang);
    const rows = await cachedFetch("about:secondskin:v2", 120_000, () =>
        prisma.product.findMany({
            where: { status: "active" },
            orderBy: { createdAt: "desc" },
            take: 60,
            select: { id: true, slug: true, name: true, colors: true, images: true },
        }),
    );
    const firstImg = (r: (typeof rows)[number]) => {
        try {
            const a = JSON.parse(r.images || "[]");
            return Array.isArray(a) && a[0] ? (a[0] as string) : "";
        } catch {
            return "";
        }
    };
    const parse = (r: (typeof rows)[number]) => {
        let cols: string[] = [];
        try {
            cols = JSON.parse(r.colors || "[]");
        } catch {
            /* noop */
        }
        return {
            id: r.id,
            slug: r.slug || "",
            name: r.name,
            colors: cols.slice(0, 4),
            image: firstImg(r),
        };
    };
    const usable = rows.filter((r) => r.slug && firstImg(r));
    const bySlug = new Map(usable.map((r) => [r.slug as string, r]));

    const curated = GALLERY_SLUGS.map((s) => bySlug.get(s)).filter(Boolean) as typeof rows;
    const seen = new Set(curated.map((r) => r.slug));
    const filler = usable.filter((r) => !seen.has(r.slug));
    const gallery = [...curated, ...filler].slice(0, 8).map(parse);

    const localized = await localizeEntities("Product", gallery, locale, ["name"]);
    return { gallery: localized };
}

type Tok = { w: string; em?: boolean };

const CONTENT = {
    uk: {
        made: "ЗШИТО В УКРАЇНІ",
        heroKicker: "MIND BODY · УКРАЇНА",
        heroLines: [
            [{ w: "М’який" }, { w: "одяг" }],
            [{ w: "для" }, { w: "руху" }, { w: "—" }],
            [{ w: "щодня", em: true }],
        ] as Tok[][],
        heroSub: "М’яка тканина, що тягнеться. Жіноча та дитяча лінії.",
        heroCta: "Дивитися колекції",
        proofA: "Плетена спина",
        proofB: "Дорослі + діти",
        matKicker: "МАТЕРІАЛ",
        matTitle: [
            [{ w: "Плетена" }, { w: "спина" }],
            [{ w: "і" }, { w: "вишите" }, { w: "сонце" }],
        ] as Tok[][],
        matLead:
            "Шість пасем сходяться у вузол між лопатками, поряд — вишите сонце. Дрібниця, яку видно зблизька.",
        mat: [
            { n: "Плетена спина", d: "акцент, що відкриває лінію тіла" },
            { n: "Вишите сонце", d: "фірмовий знак MIND BODY на тканині" },
            { n: "М’яка посадка", d: "тягнеться й рухається з тобою" },
        ],
        flowKicker: "У РУСІ",
        flowTitle: [[{ w: "Створено" }], [{ w: "для" }, { w: "руху" }]] as Tok[][],
        flowSub: "Тканина тягнеться у чотирьох напрямках, дихає й повертає форму.",
        flow: [
            { n: "Поворот", d: "посадка не зраджує" },
            { n: "Розтяжка", d: "спина відкрита, лінія чиста" },
            { n: "Нахил", d: "тканина йде за тілом" },
        ],
        backKicker: "СПИНА",
        backTitle: [
            [{ w: "Один" }, { w: "крій," }],
            [{ w: "кілька" }, { w: "кольорів" }],
        ] as Tok[][],
        backLead:
            "Та сама плетена спина — у бірюзі, у сливі, у пудрі. Обирай колір під свій настрій.",
        kidsKicker: "ДІТИ",
        kidsTitle: [
            [{ w: "Той" }, { w: "самий" }, { w: "крій" }, { w: "—" }],
            [{ w: "менший" }, { w: "розмір" }],
        ] as Tok[][],
        kidsLead:
            "Та сама плетена спина і вишите сонце — у дитячих розмірах. М’яко, тягнеться, не сковує рух.",
        kidsFacts: ["Та сама спина", "Зшито в Україні", "Створено для руху"],
        kidsCta: "Дитяча лінія",
        lookKicker: "КОЛЕКЦІЯ",
        lookTitle: [[{ w: "Колір" }, { w: "—" }, { w: "це" }, { w: "настрій" }]] as Tok[][],
        lookSub: "Слива, шоколад, червоний — той самий крій у різних кольорах.",
        originKicker: "ВИТОКИ",
        originQuote: [
            [{ w: "Зшито" }, { w: "в" }, { w: "Україні," }],
            [{ w: "нашими" }, { w: "руками", em: true }],
        ] as Tok[][],
        madeText:
            "М’яка до шкіри тканина, що тягнеться й тримає форму. Кожен шов — в Україні. Жіноча та дитяча лінії, 14 днів на повернення.",
        fab: [
            "м’яка до шкіри",
            "тримає форму",
            "рухається з тобою",
            "14 днів на повернення",
            "доросла + дитяча лінія",
        ],
        galKicker: "КАТАЛОГ",
        galTitle: [[{ w: "Кольори" }], [{ w: "в" }, { w: "русі" }]] as Tok[][],
        galSub: "Колір, крій і деталь — кожна річ звучить інакше в русі.",
        cardCta: "Дивитися",
        railNext: "Наступні",
        finKicker: "КОЛЕКЦІЇ",
        finTitle: [[{ w: "Знайди" }, { w: "свій" }], [{ w: "рух", em: true }]] as Tok[][],
        finCta: "Дивитися каталог",
        finLine: "Зшито в Україні. Створено для руху.",
        contactsLabel: "Напишіть нам",
        footL: "Зшито в Україні",
        footC: "14 днів на повернення",
        altHero: "Комбінезон MIND BODY зі шнурівкою на спині та вишитим сонцем на рукаві",
        altMat: "Плетена спина MIND BODY: бірюзовий вузол і вишите сонце зблизька",
        altMatFull: "Модель MIND BODY у комбінезоні кольору сливи: плетена спина на повний зріст",
        altFlow: "Модель MIND BODY у русі",
        altBackTeal: "Комбінезон MIND BODY бірюзового кольору ззаду: плетена спина і вишите сонце",
        altBackPlum: "Комбінезон MIND BODY кольору сливи ззаду: плетена спина і вишите сонце",
        altOrigin: "Модель у комбінезоні MIND BODY кольору сливи, вишите сонце на рукаві",
        altLook: [
            "Комбінезон MIND BODY кольору сливи",
            "Комбінезон MIND BODY кольору шоколаду",
            "Комбінезон MIND BODY червоного кольору",
        ],
        altKidsShow:
            "Дитина MIND BODY KIDS у бірюзовому комбінезоні з піднятою рукою: плетена спина і вишите сонце",
        altKidsMacro: "Плетена спина MIND BODY KIDS зблизька: шнурівка-хрест і вишите сонце",
        altKidsPair: "Дві дівчинки MIND BODY KIDS тримаються за руки",
    },
    en: {
        made: "SEWN IN UKRAINE",
        heroKicker: "MIND BODY · UKRAINE",
        heroLines: [
            [{ w: "Soft" }, { w: "clothing" }],
            [{ w: "for" }, { w: "movement" }, { w: "—" }],
            [{ w: "every" }, { w: "day", em: true }],
        ] as Tok[][],
        heroSub: "Soft fabric that stretches. Women’s and kids’ lines.",
        heroCta: "View the collections",
        proofA: "Laced back",
        proofB: "Women + kids",
        matKicker: "MATERIAL",
        matTitle: [
            [{ w: "A" }, { w: "laced" }, { w: "back" }],
            [{ w: "and" }, { w: "an" }, { w: "embroidered" }, { w: "sun" }],
        ] as Tok[][],
        matLead:
            "Six strands meet in a knot between the shoulder blades, an embroidered sun beside it. A detail you notice up close.",
        mat: [
            { n: "Laced back", d: "an accent that opens the line of the body" },
            { n: "Embroidered sun", d: "the MIND BODY mark, in the cloth" },
            { n: "Soft fit", d: "stretches and moves with you" },
        ],
        flowKicker: "IN MOTION",
        flowTitle: [[{ w: "Made" }], [{ w: "for" }, { w: "movement" }]] as Tok[][],
        flowSub: "Four-way stretch — it breathes and springs back.",
        flow: [
            { n: "Twist", d: "the fit never betrays you" },
            { n: "Stretch", d: "back open, line clean" },
            { n: "Bend", d: "the fabric follows the body" },
        ],
        backKicker: "THE BACK",
        backTitle: [
            [{ w: "One" }, { w: "cut," }],
            [{ w: "several" }, { w: "colours" }],
        ] as Tok[][],
        backLead:
            "The same laced back — in turquoise, plum and powder. Choose the colour for your mood.",
        kidsKicker: "KIDS",
        kidsTitle: [
            [{ w: "The" }, { w: "same" }, { w: "cut" }, { w: "—" }],
            [{ w: "a" }, { w: "smaller" }, { w: "size" }],
        ] as Tok[][],
        kidsLead:
            "The same laced back and embroidered sun — in kids’ sizes. Soft, stretchy, never restricts movement.",
        kidsFacts: ["The same back", "Sewn in Ukraine", "Made for movement"],
        kidsCta: "Kids line",
        lookKicker: "THE RANGE",
        lookTitle: [[{ w: "Colour" }, { w: "is" }, { w: "mood" }]] as Tok[][],
        lookSub: "Plum, chocolate, red — the same cut in different colours.",
        originKicker: "ORIGIN",
        originQuote: [
            [{ w: "Sewn" }, { w: "in" }, { w: "Ukraine," }],
            [{ w: "by" }, { w: "our" }, { w: "hands", em: true }],
        ] as Tok[][],
        madeText:
            "Soft-to-skin fabric that stretches and holds its shape. Every seam sewn in Ukraine. Women’s and kids’ lines, 14-day returns.",
        fab: [
            "soft on the skin",
            "holds its shape",
            "moves with you",
            "14-day returns",
            "women + kids line",
        ],
        galKicker: "CATALOGUE",
        galTitle: [[{ w: "Colours" }], [{ w: "in" }, { w: "motion" }]] as Tok[][],
        galSub: "Colour, cut and detail — each piece reads differently in motion.",
        cardCta: "View",
        railNext: "Next",
        finKicker: "COLLECTIONS",
        finTitle: [[{ w: "Find" }, { w: "your" }], [{ w: "movement", em: true }]] as Tok[][],
        finCta: "Browse the catalogue",
        finLine: "Sewn in Ukraine. Made for movement.",
        contactsLabel: "Write to us",
        footL: "Sewn in Ukraine",
        footC: "14 days to return",
        altHero: "MIND BODY jumpsuit with a laced back and an embroidered sun on the sleeve",
        altMat: "MIND BODY laced back: turquoise knot and embroidered sun, close up",
        altMatFull: "MIND BODY model in a plum jumpsuit: the laced back, full length",
        altFlow: "A MIND BODY model in motion",
        altBackTeal: "MIND BODY turquoise jumpsuit from behind: laced back and embroidered sun",
        altBackPlum: "MIND BODY plum jumpsuit from behind: laced back and embroidered sun",
        altOrigin: "Model in a plum MIND BODY jumpsuit, embroidered sun on the sleeve",
        altLook: [
            "MIND BODY plum jumpsuit",
            "MIND BODY chocolate jumpsuit",
            "MIND BODY red jumpsuit",
        ],
        altKidsShow:
            "MIND BODY KIDS child in a turquoise unitard, arm raised: laced back and embroidered sun",
        altKidsMacro: "MIND BODY KIDS laced back, close up: criss-cross lacing and embroidered sun",
        altKidsPair: "Two MIND BODY KIDS girls holding hands",
    },
    ru: {
        made: "СШИТО В УКРАИНЕ",
        heroKicker: "MIND BODY · УКРАИНА",
        heroLines: [
            [{ w: "Мягкая" }, { w: "одежда" }],
            [{ w: "для" }, { w: "движения" }, { w: "—" }],
            [{ w: "каждый" }, { w: "день", em: true }],
        ] as Tok[][],
        heroSub: "Мягкая тянущаяся ткань. Женская и детская линии.",
        heroCta: "Смотреть коллекции",
        proofA: "Плетёная спина",
        proofB: "Взрослые + дети",
        matKicker: "МАТЕРИАЛ",
        matTitle: [
            [{ w: "Плетёная" }, { w: "спина" }],
            [{ w: "и" }, { w: "вышитое" }, { w: "солнце" }],
        ] as Tok[][],
        matLead:
            "Шесть прядей сходятся в узел между лопатками, рядом — вышитое солнце. Деталь, которую видно вблизи.",
        mat: [
            { n: "Плетёная спина", d: "акцент, который открывает линию тела" },
            { n: "Вышитое солнце", d: "фирменный знак MIND BODY на ткани" },
            { n: "Мягкая посадка", d: "тянется и движется с тобой" },
        ],
        flowKicker: "В ДВИЖЕНИИ",
        flowTitle: [[{ w: "Создано" }], [{ w: "для" }, { w: "движения" }]] as Tok[][],
        flowSub: "Ткань тянется в четырёх направлениях, дышит и держит форму.",
        flow: [
            { n: "Поворот", d: "посадка не подводит" },
            { n: "Растяжка", d: "спина открыта, линия чистая" },
            { n: "Наклон", d: "ткань идёт за телом" },
        ],
        backKicker: "СПИНА",
        backTitle: [
            [{ w: "Один" }, { w: "крой," }],
            [{ w: "несколько" }, { w: "цветов" }],
        ] as Tok[][],
        backLead: "Та же плетёная спина — в бирюзе, сливе и пудре. Выбирай цвет под настроение.",
        kidsKicker: "ДЕТИ",
        kidsTitle: [
            [{ w: "Тот" }, { w: "же" }, { w: "крой" }, { w: "—" }],
            [{ w: "меньший" }, { w: "размер" }],
        ] as Tok[][],
        kidsLead:
            "Та же плетёная спина и вышитое солнце — в детских размерах. Мягко, тянется, не сковывает движение.",
        kidsFacts: ["Та же спина", "Сшито в Украине", "Создано для движения"],
        kidsCta: "Детская линия",
        lookKicker: "КОЛЛЕКЦИЯ",
        lookTitle: [[{ w: "Цвет" }, { w: "—" }, { w: "это" }, { w: "настроение" }]] as Tok[][],
        lookSub: "Слива, шоколад, красный — тот же крой в разных цветах.",
        originKicker: "ИСТОКИ",
        originQuote: [
            [{ w: "Сшито" }, { w: "в" }, { w: "Украине," }],
            [{ w: "нашими" }, { w: "руками", em: true }],
        ] as Tok[][],
        madeText:
            "Мягкая к коже ткань, которая тянется и держит форму. Каждый шов — в Украине. Женская и детская линии, возврат 14 дней.",
        fab: [
            "мягкая к коже",
            "держит форму",
            "движется с тобой",
            "14 дней на возврат",
            "взрослая + детская линия",
        ],
        galKicker: "КАТАЛОГ",
        galTitle: [[{ w: "Цвета" }], [{ w: "в" }, { w: "движении" }]] as Tok[][],
        galSub: "Цвет, крой и деталь — каждая вещь звучит иначе в движении.",
        cardCta: "Смотреть",
        railNext: "Следующие",
        finKicker: "КОЛЛЕКЦИИ",
        finTitle: [[{ w: "Найди" }, { w: "своё" }], [{ w: "движение", em: true }]] as Tok[][],
        finCta: "Смотреть каталог",
        finLine: "Сшито в Украине. Создано для движения.",
        contactsLabel: "Напишите нам",
        footL: "Сшито в Украине",
        footC: "14 дней на возврат",
        altHero: "Комбинезон MIND BODY со шнуровкой на спине и вышитым солнцем на рукаве",
        altMat: "Плетёная спина MIND BODY: бирюзовый узел и вышитое солнце вблизи",
        altMatFull: "Модель MIND BODY в комбинезоне цвета сливы: плетёная спина в полный рост",
        altFlow: "Модель MIND BODY в движении",
        altBackTeal: "Комбинезон MIND BODY бирюзового цвета сзади: плетёная спина и вышитое солнце",
        altBackPlum: "Комбинезон MIND BODY цвета сливы сзади: плетёная спина и вышитое солнце",
        altOrigin: "Модель в комбинезоне MIND BODY цвета сливы, вышитое солнце на рукаве",
        altLook: [
            "Комбинезон MIND BODY цвета сливы",
            "Комбинезон MIND BODY цвета шоколада",
            "Комбинезон MIND BODY красного цвета",
        ],
        altKidsShow:
            "Ребёнок MIND BODY KIDS в бирюзовом комбинезоне с поднятой рукой: плетёная спина и вышитое солнце",
        altKidsMacro: "Плетёная спина MIND BODY KIDS вблизи: шнуровка-крест и вышитое солнце",
        altKidsPair: "Две девочки MIND BODY KIDS держатся за руки",
    },
} as const;

const PHONES = [
    { tel: "+380966650855", display: "+380 (96) 665-08-55" },
    { tel: "+380509656737", display: "+380 (50) 965-67-37" },
    { tel: "+380973542848", display: "+380 (97) 354-28-48" },
] as const;

const CLR: Record<string, string> = {
    black: "#1a1a1a",
    white: "#f1eee9",
    cream: "#e9e2d6",
    grey: "#9a948c",
    gray: "#9a948c",
    beige: "#d4c4a4",
    nude: "#e4d2c0",
    navy: "#2a3550",
    blue: "#3a4a7a",
    teal: "#2a5a5a",
    sliva: "#4b3b6b",
    plum: "#4b3b6b",
    purple: "#4b3b6b",
    marsala: "#722f37",
    red: "#9d2f33",
    pink: "#c98aa0",
    green: "#5d7a63",
    brown: "#5a4636",
    graphite: "#3a3a3c",
    olive: "#6b6a45",
};

// ── helpers ──────────────────────────────────────────────────────────────
function Pic({
    src,
    alt = "MIND BODY",
    sizes,
    eager,
    priority,
    position,
}: {
    src: string;
    alt?: string;
    sizes: string;
    eager?: boolean;
    priority?: boolean;
    position?: string;
}) {
    return (
        <picture>
            <source srcSet={buildAvifSrcset(src)} sizes={sizes} type="image/avif" />
            <source srcSet={buildWebpSrcset(src)} sizes={sizes} type="image/webp" />
            <img
                src={src}
                alt={alt}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                {...(priority ? { fetchPriority: "high" as const } : null)}
                style={{
                    ...getLqipStyle(src),
                    ...(position ? { objectPosition: position } : null),
                }}
            />
        </picture>
    );
}

const ICON_PATHS: Record<string, string> = {
    telegram:
        "M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
    viber: "M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.696 6.7.633 9.817.57 12.933.488 18.776 6.12 20.36h.003l-.004 2.416s-.037.977.61 1.177c.777.242 1.234-.5 1.98-1.302.407-.44.972-1.084 1.397-1.58 3.85.326 6.812-.416 7.15-.525.776-.252 5.176-.816 5.892-6.657.74-6.02-.36-9.83-2.34-11.546-.596-.55-3.006-2.3-8.375-2.323 0 0-.395-.025-1.037-.017zm.058 1.693c.545-.004.88.017.88.017 4.542.02 6.717 1.388 7.222 1.846 1.675 1.435 2.53 4.868 1.906 9.897v.002c-.604 4.878-4.174 5.184-4.832 5.395-.28.09-2.882.737-6.153.524 0 0-2.436 2.94-3.197 3.704-.12.12-.26.167-.352.144-.13-.033-.166-.188-.165-.414l.02-4.018c-4.762-1.32-4.485-6.292-4.43-8.895.054-2.604.543-4.738 1.996-6.173 1.96-1.773 5.474-2.018 7.11-2.03zm.38 2.602c-.167 0-.303.135-.304.302 0 .167.133.303.3.305 1.624.01 2.946.537 4.028 1.592 1.073 1.046 1.62 2.468 1.633 4.334.002.167.14.3.307.3.166-.002.3-.138.3-.304-.014-1.984-.618-3.596-1.816-4.764-1.19-1.16-2.692-1.753-4.447-1.765zm-3.96.695c-.19-.032-.4.005-.616.117l-.01.002c-.43.247-.816.562-1.146.932-.002.004-.006.004-.008.008-.267.323-.42.638-.46.948-.008.046-.01.093-.007.14 0 .136.022.27.065.4l.013.01c.135.48.473 1.276 1.205 2.604.42.768.903 1.5 1.446 2.186.27.344.56.673.87.984l.132.132c.31.308.64.6.984.87.686.543 1.418 1.027 2.186 1.447 1.328.733 2.126 1.07 2.604 1.206l.01.014c.13.042.265.064.402.063.046.002.092 0 .138-.008.31-.036.627-.19.948-.46.004 0 .003-.002.008-.005.37-.33.683-.72.93-1.148l.003-.01c.225-.432.15-.842-.18-1.12-.004 0-.698-.58-1.037-.83-.36-.255-.73-.492-1.113-.71-.51-.285-1.032-.106-1.248.174l-.447.564c-.23.283-.657.246-.657.246-3.12-.796-3.955-3.955-3.955-3.955s-.037-.426.248-.656l.563-.448c.277-.215.456-.737.17-1.248-.217-.383-.454-.756-.71-1.115-.25-.34-.826-1.033-.83-1.035-.137-.165-.31-.265-.502-.297z",
    whatsapp:
        "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    instagram:
        "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
};
function Glyph({ name }: { name: keyof typeof ICON_PATHS }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={ICON_PATHS[name]} />
        </svg>
    );
}
function Arrow() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
        >
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    );
}

// renders a title as controlled editorial lines (each line a block). The inner
// `.l` span is the mask-slide target (hero + origin rise from behind their line).
// The em word carries the accent — serif italic in hero/origin, an Onest 800
// weight-beat elsewhere (the per-heading italic "tic" is gone).
function Lines({ lines, period }: { lines: Tok[][]; period?: boolean }) {
    return (
        <>
            {lines.map((line, li) => (
                <span className="ab-line" key={li}>
                    <span className="l">
                        {line.map((t, wi) => (
                            <span key={wi} className={t.em ? "ab-em" : undefined}>
                                {t.w}
                                {wi < line.length - 1 ? " " : null}
                            </span>
                        ))}
                        {period && li === lines.length - 1 ? "." : null}
                    </span>
                </span>
            ))}
        </>
    );
}

const HERO_IMG = "/generalpics/347_131123.webp"; // teal jumpsuit, back, laced spine + sun on sleeve — LCP, never clip/opacity-gate
const MAT_IMG = "/brand/detail-strap.webp"; // macro: turquoise woven knot + embroidered sun
const MAT_FULL = "/generalpics/595_131123.webp"; // full-body plum BACK, laced spine, white floor
const ORIGIN_IMG = "/generalpics/588_131123.webp"; // plum portrait, hand to face, sun on sleeve
// "Створено для руху" — three contained frames: twist · stretch · bend
const FLOW_IMG = [
    { src: "/brand/move-twist.webp", pos: "50% 18%" },
    { src: "/brand/move-stretch.webp", pos: "50% 30%" },
    { src: "/brand/move-bend.webp", pos: "50% 42%" },
];
// §04 THE BACK — the signature detail across colourways (near-full-bleed 2-up)
const BACK_TEAL = "/generalpics/338_131123.webp"; // teal BACK, laced, sun on sleeve
const BACK_PLUM = "/generalpics/602_131123.webp"; // plum BACK, laced, sun on sleeve
// §07 LOOKBOOK — colour range, contained 3-up on reflective floor
const LOOK = [
    "/brand/material-plum.webp",
    "/brand/material-brown.webp",
    "/brand/lookbook-red.webp",
];
// §06 KIDS — the same signature, smaller size (one full-bleed showpiece + restrained 2-up)
const KIDS_SHOW = "/brand/kids/kids-teal-arabesque.webp"; // child teal, arm-raised arabesque, laced back + sun
const KIDS_MACRO = "/brand/kids/kids-back-macro.webp"; // macro: child laced cross + embroidered sun
const KIDS_PAIR = "/brand/kids/kids-pair-reach.webp"; // two girls holding hands

export default function About() {
    const { locale } = useI18n();
    const c = CONTENT[locale];
    const { contacts } = useSiteSettings();
    const { gallery } = useLoaderData<typeof loader>();
    const [played, setPlayed] = useState(false);
    const railRef = useRef<HTMLUListElement>(null);
    const nudgeRail = () =>
        railRef.current?.scrollBy({ left: railRef.current.clientWidth * 0.8, behavior: "smooth" });

    useEffect(() => {
        const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setPlayed(true)));
        const failsafe = window.setTimeout(() => setPlayed(true), 800);

        // light IntersectionObserver reveals (CSS does the motion; scoped override
        // re-enables it under reduce-motion). No GSAP, no smooth-scroll, no infinite loops.
        const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
        let io: IntersectionObserver | null = null;
        if ("IntersectionObserver" in window) {
            io = new IntersectionObserver(
                (entries) => {
                    for (const e of entries) {
                        if (e.isIntersecting) {
                            e.target.classList.add("in");
                            io!.unobserve(e.target);
                        }
                    }
                },
                { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
            );
            reveals.forEach((el) => io!.observe(el));
        } else {
            reveals.forEach((el) => el.classList.add("in"));
        }

        return () => {
            cancelAnimationFrame(r1);
            clearTimeout(failsafe);
            io?.disconnect();
        };
    }, [locale]);

    return (
        <main className={"ab ab--enter" + (played ? " ab--play" : "")}>
            <noscript>
                <style>{`.ab--enter [data-hero-rise]{opacity:1!important;transform:none!important}.ab .ab-line>.l{transform:none!important}.ab-mark__img{opacity:1!important;filter:none!important;transform:none!important;clip-path:none!important}.ab-lockup__rule{opacity:1!important}.ab-hero__bloom{opacity:1!important}.ab-hero__media img,.ab-mat__media img,.ab-flow__media img,.ab-back__frame img,.ab-origin__media img,.ab-look__frame img,.ab-kids__show img,.ab-kids__duo img{transform:none!important;clip-path:none!important}.ab-kids__show,.ab-kids__duo .ab-look__frame,.ab-back__frame{opacity:1!important;transform:none!important}.ab [data-reveal]{opacity:1!important;transform:none!important;filter:none!important}`}</style>
            </noscript>

            {/* 01 — HERO · СОНЦЕ СХОДИТЬ ЗІ СПИНИ — camera settles on an already-painted
                frame, sun blooms between the shoulder blades, masked headline rises */}
            <section className="ab-hero" data-act="hero">
                <span className="ab-hero__bloom" aria-hidden="true" />
                <div className="ab-hero__media">
                    <Pic
                        src={HERO_IMG}
                        alt={c.altHero}
                        sizes="(max-width:860px) 100vw, 50vw"
                        eager
                        priority
                        position="50% 22%"
                    />
                </div>
                <div className="ab-hero__panel">
                    <div
                        className="ab-hero__head"
                        data-hero-rise
                        style={{ "--rd": "0.05s" } as CSSProperties}
                    >
                        <span className="ab-lockup" role="img" aria-label="MIND BODY">
                            <span className="ab-mark ab-lockup__sun" aria-hidden="true">
                                <span className="ab-mark__img" />
                            </span>
                            <span className="ab-lockup__rule" aria-hidden="true" />
                            <span className="ab-mark ab-lockup__word" aria-hidden="true">
                                <span className="ab-mark__img ab-mark__img--word" />
                            </span>
                        </span>
                        <span className="ab-kicker">{c.heroKicker}</span>
                    </div>
                    <div className="ab-hero__main">
                        <h1 className="ab-hero__title">
                            <Lines lines={c.heroLines} period />
                        </h1>
                        <p
                            className="ab-hero__sub"
                            data-hero-rise
                            style={{ "--rd": "1.55s" } as CSSProperties}
                        >
                            {c.heroSub}
                        </p>
                        <LLink
                            to="/shop/yoga"
                            className="ab-cta ab-hero__cta"
                            data-hero-rise
                            style={{ "--rd": "1.75s" } as CSSProperties}
                        >
                            <span>{c.heroCta}</span>
                            <Arrow />
                        </LLink>
                    </div>
                    <span
                        className="ab-hero__corner"
                        data-hero-rise
                        style={{ "--rd": "1.9s" } as CSSProperties}
                    >
                        {c.made}
                    </span>
                </div>
            </section>

            {/* proof strap — provenance + breadth, fills the post-hero void */}
            <div className="ab-strap" data-reveal>
                <span>{c.footL}</span>
                <span>{c.proofA}</span>
                <span>{c.proofB}</span>
                <span>{c.footC}</span>
            </div>

            {/* 02 — MATERIAL · the laced back explained: macro knot ↔ same knot worn full-length */}
            <section className="ab-sec ab-mat" data-act="material">
                <div className="ab-grid ab-mat__grid">
                    <figure className="ab-mat__media" data-reveal>
                        <Pic
                            src={MAT_IMG}
                            alt={c.altMat}
                            sizes="(max-width:860px) 100vw, 46vw"
                            position="50% 38%"
                        />
                    </figure>
                    <figure
                        className="ab-mat__full"
                        data-reveal
                        style={{ "--d": "0.08s" } as CSSProperties}
                    >
                        <Pic
                            src={MAT_FULL}
                            alt={c.altMatFull}
                            sizes="(max-width:860px) 100vw, 28vw"
                            position="50% 42%"
                        />
                    </figure>
                    <div className="ab-mat__aside">
                        <span className="ab-kicker" data-reveal>
                            {c.matKicker}
                        </span>
                        <h2 className="ab-display ab-mat__title" data-reveal>
                            <Lines lines={c.matTitle} period />
                        </h2>
                        <p
                            className="ab-mat__lead"
                            data-reveal
                            style={{ "--d": "0.06s" } as CSSProperties}
                        >
                            {c.matLead}
                        </p>
                        <ul className="ab-mat__index">
                            {c.mat.map((d, i) => (
                                <li
                                    className="ab-mat__item"
                                    data-reveal
                                    style={{ "--d": `${0.06 + i * 0.07}s` } as CSSProperties}
                                    key={d.n}
                                >
                                    <span className="ab-mat__n" aria-hidden="true" />
                                    <span>
                                        <span className="ab-mat__name">{d.n}</span>
                                        <span className="ab-mat__desc">{d.d}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <span className="ab-mark ab-mat__sun" data-reveal aria-hidden="true">
                            <span className="ab-mark__img" />
                        </span>
                    </div>
                </div>
            </section>

            {/* 03 — IN MOTION · created for movement (3 contained frames) */}
            <section className="ab-sec ab-flow" data-act="motion">
                <div className="ab-grid ab-flow__head">
                    <span className="ab-kicker" data-reveal>
                        {c.flowKicker}
                    </span>
                    <h2 className="ab-display ab-h2" data-reveal>
                        <Lines lines={c.flowTitle} period />
                    </h2>
                    <p
                        className="ab-flow__sub"
                        data-reveal
                        style={{ "--d": "0.06s" } as CSSProperties}
                    >
                        {c.flowSub}
                    </p>
                </div>
                <div className="ab-flow__pair">
                    {c.flow.map((f, i) => (
                        <figure
                            className={
                                "ab-flow__frame" + (i % 2 === 1 ? " ab-flow__frame--alt" : "")
                            }
                            data-reveal
                            style={{ "--d": `${i * 0.08}s` } as CSSProperties}
                            key={f.n}
                        >
                            <span className="ab-flow__media">
                                <Pic
                                    src={FLOW_IMG[i].src}
                                    alt={`${c.altFlow} — ${f.n}`}
                                    sizes="(max-width:860px) 92vw, 31vw"
                                    position={FLOW_IMG[i].pos}
                                />
                            </span>
                            <figcaption className="ab-flow__cap">
                                <span className="ab-flow__n" aria-hidden="true" />
                                <span className="ab-flow__name">{f.n}</span>
                                <span className="ab-flow__line">{f.d}</span>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            {/* 04 — THE BACK · СПИНА В КОЛЬОРІ — the signature detail across colourways
                (near-full-bleed 2-up, each laced spine drifts within its frame) */}
            <section className="ab-sec ab-back" data-act="back">
                <div className="ab-grid ab-back__head">
                    <span className="ab-kicker" data-reveal>
                        {c.backKicker}
                    </span>
                    <h2 className="ab-display ab-h2 ab-back__title" data-reveal>
                        <Lines lines={c.backTitle} />
                    </h2>
                    <p
                        className="ab-back__lead"
                        data-reveal
                        style={{ "--d": "0.06s" } as CSSProperties}
                    >
                        {c.backLead}
                    </p>
                </div>
                <div className="ab-back__pair">
                    <figure className="ab-back__frame" data-reveal>
                        <Pic src={BACK_TEAL} alt={c.altBackTeal} sizes="50vw" position="50% 32%" />
                    </figure>
                    <figure
                        className="ab-back__frame ab-back__frame--b"
                        data-reveal
                        style={{ "--d": "0.08s" } as CSSProperties}
                    >
                        <Pic src={BACK_PLUM} alt={c.altBackPlum} sizes="50vw" position="50% 30%" />
                    </figure>
                </div>
            </section>

            {/* 05 — ORIGIN · sewn in Ukraine, by our hands (serif climax) */}
            <section className="ab-sec ab-origin" data-act="origin">
                <span className="ab-origin__sun" aria-hidden="true">
                    <span className="ab-mark__img" />
                </span>
                <div className="ab-grid ab-origin__grid">
                    <div className="ab-origin__copy">
                        <span
                            className="ab-kicker"
                            data-reveal
                            style={{ "--d": "0.04s" } as CSSProperties}
                        >
                            {c.originKicker}
                        </span>
                        <h2 className="ab-origin__quote ab-display" data-reveal>
                            <Lines lines={c.originQuote} period />
                        </h2>
                        <p
                            className="ab-body ab-origin__text"
                            data-reveal
                            style={{ "--d": "0.08s" } as CSSProperties}
                        >
                            {c.madeText}
                        </p>
                        <ul className="ab-origin__chips">
                            {c.fab.map((t, i) => (
                                <li
                                    className="ab-origin__chip"
                                    data-reveal
                                    style={{ "--d": `${0.06 + i * 0.05}s` } as CSSProperties}
                                    key={t}
                                >
                                    <span className="ab-tick" aria-hidden="true" />
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <figure className="ab-origin__media" data-reveal>
                        <Pic
                            src={ORIGIN_IMG}
                            alt={c.altOrigin}
                            sizes="(max-width:860px) 86vw, 40vw"
                            position="50% 20%"
                        />
                    </figure>
                </div>
            </section>

            {/* 06 — KIDS · ТОЙ САМИЙ КРІЙ — one bold full-bleed showpiece + restrained 2-up */}
            <section className="ab-sec ab-kids" data-act="kids">
                <div className="ab-grid ab-kids__head">
                    <span className="ab-kicker" data-reveal>
                        {c.kidsKicker}
                    </span>
                </div>
                <figure className="ab-kids__show" data-reveal>
                    <Pic src={KIDS_SHOW} alt={c.altKidsShow} sizes="100vw" position="50% 28%" />
                </figure>
                <div className="ab-grid ab-kids__body">
                    <div className="ab-kids__copy" data-reveal>
                        <h2 className="ab-display ab-kids__title">
                            <Lines lines={c.kidsTitle} />
                        </h2>
                        <p
                            className="ab-kids__lead"
                            data-reveal
                            style={{ "--d": "0.06s" } as CSSProperties}
                        >
                            {c.kidsLead}
                        </p>
                        <ul className="ab-kids__facts">
                            {c.kidsFacts.map((t, i) => (
                                <li
                                    className="ab-kids__fact"
                                    data-reveal
                                    style={{ "--d": `${0.06 + i * 0.06}s` } as CSSProperties}
                                    key={t}
                                >
                                    <span className="ab-tick" aria-hidden="true" />
                                    {t}
                                </li>
                            ))}
                        </ul>
                        <LLink to="/shop/kids" className="ab-cta ab-kids__cta">
                            <span>{c.kidsCta}</span>
                            <Arrow />
                        </LLink>
                    </div>
                    <div className="ab-kids__duo">
                        {[
                            { src: KIDS_MACRO, alt: c.altKidsMacro, pos: "50% 30%" },
                            { src: KIDS_PAIR, alt: c.altKidsPair, pos: "50% 22%" },
                        ].map((k, i) => (
                            <figure
                                className="ab-kids__duoframe"
                                data-reveal
                                key={k.src}
                                style={{ "--d": `${i * 0.1}s` } as CSSProperties}
                            >
                                <Pic
                                    src={k.src}
                                    alt={k.alt}
                                    sizes="(max-width:860px) 92vw, 30vw"
                                    position={k.pos}
                                />
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* 07 — LOOKBOOK · КОЛІР — ЦЕ НАСТРІЙ — the colour-range valley (contained 3-up) */}
            <section className="ab-sec ab-look" data-act="look">
                <div className="ab-grid ab-look__head">
                    <span className="ab-kicker" data-reveal>
                        {c.lookKicker}
                    </span>
                    <h2 className="ab-display ab-h2 ab-look__title" data-reveal>
                        <Lines lines={c.lookTitle} period />
                    </h2>
                    <p
                        className="ab-look__sub"
                        data-reveal
                        style={{ "--d": "0.06s" } as CSSProperties}
                    >
                        {c.lookSub}
                    </p>
                </div>
                <div className="ab-look__row">
                    {LOOK.map((src, i) => (
                        <figure
                            className="ab-look__frame"
                            data-reveal
                            key={src}
                            style={{ "--d": `${i * 0.1}s` } as CSSProperties}
                        >
                            <Pic
                                src={src}
                                alt={c.altLook[i]}
                                sizes="(max-width:860px) 92vw, 31vw"
                                position="50% 28%"
                            />
                        </figure>
                    ))}
                </div>
            </section>

            {/* 08 — CATALOGUE · colours in motion (live Prisma rail) */}
            <section className="ab-sec ab-gal" data-act="catalogue">
                <div className="ab-grid ab-gal__head">
                    <span className="ab-kicker" data-reveal>
                        {c.galKicker}
                    </span>
                    <h2 className="ab-display ab-h2" data-reveal>
                        <Lines lines={c.galTitle} period />
                    </h2>
                    <p
                        className="ab-gal__sub"
                        data-reveal
                        style={{ "--d": "0.06s" } as CSSProperties}
                    >
                        {c.galSub}
                    </p>
                </div>
                <div className="ab-gal__railwrap">
                    <ul className="ab-gal__rail" data-reveal ref={railRef}>
                        {gallery.map((p) => (
                            <li className="ab-gal__item" key={p.id}>
                                <LLink to={`/p/${p.slug}`} className="ab-gal__card">
                                    <span className="ab-gal__shot">
                                        <Pic
                                            src={p.image}
                                            alt={p.name}
                                            sizes="(max-width:768px) 72vw, 300px"
                                        />
                                    </span>
                                    <span className="ab-gal__meta">
                                        <span className="ab-gal__name">{p.name}</span>
                                        <span className="ab-gal__bars" aria-hidden="true">
                                            {p.colors.map((col, i) => (
                                                <span
                                                    className="ab-gal__bar"
                                                    key={col + i}
                                                    style={{ background: CLR[col] || "#cfc7ba" }}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span className="ab-gal__go">
                                        {c.cardCta} <Arrow />
                                    </span>
                                </LLink>
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        className="ab-gal__nav"
                        aria-label={c.railNext}
                        onClick={nudgeRail}
                    >
                        <Arrow />
                    </button>
                </div>
            </section>

            {/* 09 — FINAL · find your movement + contacts + teal sign-off bookend */}
            <section id="contact-premium" className="ab-sec ab-final" data-act="final">
                <div className="ab-grid">
                    <div className="ab-final__lead" data-reveal>
                        <span className="ab-mark ab-final__mark" aria-hidden="true">
                            <span className="ab-mark__img" />
                        </span>
                        <h2 className="ab-display ab-final__title">
                            <Lines lines={c.finTitle} period />
                        </h2>
                    </div>
                    <ul
                        className="ab-final__cats"
                        data-reveal
                        style={{ "--d": "0.06s" } as CSSProperties}
                    >
                        {(["yoga", "sport", "dance", "kids"] as const).map((k) => (
                            <li key={k}>
                                <LLink to={`/shop/${k}`} className="ab-final__cat">
                                    <span>{k.toUpperCase()}</span>
                                    <Arrow />
                                </LLink>
                            </li>
                        ))}
                    </ul>
                    <div
                        className="ab-final__foot"
                        data-reveal
                        style={{ "--d": "0.12s" } as CSSProperties}
                    >
                        <LLink to="/shop/yoga" className="ab-cta ab-final__cta">
                            <span>{c.finCta}</span>
                            <Arrow />
                        </LLink>
                        <p className="ab-final__line">{c.finLine}</p>
                    </div>
                    <div
                        className="ab-final__contact"
                        data-reveal
                        style={{ "--d": "0.16s" } as CSSProperties}
                    >
                        <span className="ab-final__clabel">{c.contactsLabel}</span>
                        <div className="ab-final__phones">
                            {PHONES.map((p) => (
                                <a href={`tel:${p.tel}`} className="ab-final__phone" key={p.tel}>
                                    {p.display}
                                </a>
                            ))}
                        </div>
                        <div className="ab-final__channels">
                            <a
                                href={contacts.telegramUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ab-final__ch"
                                aria-label="Telegram"
                            >
                                <Glyph name="telegram" />
                            </a>
                            <a
                                href={viberChatUrl(contacts.viberPhone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ab-final__ch"
                                aria-label="Viber"
                            >
                                <Glyph name="viber" />
                            </a>
                            <a
                                href={whatsappUrl(contacts.whatsappPhone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ab-final__ch"
                                aria-label="WhatsApp"
                            >
                                <Glyph name="whatsapp" />
                            </a>
                            <a
                                href={contacts.instagramUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ab-final__ch"
                                aria-label="Instagram"
                            >
                                <Glyph name="instagram" />
                            </a>
                        </div>
                    </div>
                    <span className="ab-mark ab-final__sign" data-reveal aria-hidden="true">
                        <span className="ab-mark__img" />
                    </span>
                    <span className="ab-mark ab-final__word" data-reveal aria-hidden="true">
                        <span className="ab-mark__img ab-mark__img--word" />
                    </span>
                    <div className="ab-final__mark-row">
                        <span>{c.footL}</span>
                        <span>{c.footC}</span>
                    </div>
                </div>
            </section>
        </main>
    );
}
