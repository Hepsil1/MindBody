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

// /about — "ДРУГА ШКІРА" (Second Skin) v34. Big idea: the logo is a DRAWING of the
// stitch on the back of every garment — the laced-open criss-cross back + the
// embroidered sun. The page recognises the brand FROM BEHIND, and carries the same
// signature forward to the kids line (the next generation). Light warm-milk world,
// colour ONLY from the garments. ONE typographic peak (Onest 800 hero) + ONE serif
// climax in the hero accent and the ORIGIN pull-quote (Spectral italic) — the rest
// is a calm grotesque valley (the per-heading italic "tic" is gone). ONE WOW peak:
// the back laces open into the light (clip-path wipe) while the headline rises from
// behind a mask and the sun blooms between the shoulder blades. The mark is
// architecture: named lockup (hero) → faint sun rhythm (every kicker) → debossed
// peak beside the real stitch → tonal watermark → teal sign-off. PERFORMANCE FIRST:
// native scroll + IntersectionObserver + CSS only — NO GSAP/Lenis/sticky/morph. Every
// animated beat is restated in the scoped reduce-motion block (owner browses with
// reduce-motion ON) so the STILL page is the product. Real catalogue via the loader.

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
            "MIND BODY — український бренд одягу як друга шкіра: плетена спина, вишите сонце, м’яка посадка для йоги, спорту, танцю і щодня. Жінки та діти. Зшито в Україні.",
        ogTitle: "MIND BODY — друга шкіра, яку впізнають зі спини",
        ogDescription: "Український бренд одягу для жінок і дітей, які рухаються. Зшито в Україні.",
    },
    en: {
        title: "About the Brand | MIND BODY",
        description:
            "MIND BODY is a Ukrainian clothing brand built like a second skin: a laced back, an embroidered sun, a soft fit for yoga, sport, dance and every day. Women and kids. Sewn in Ukraine.",
        ogTitle: "MIND BODY — a second skin, recognised from behind",
        ogDescription: "A Ukrainian brand for women and kids who move. Sewn in Ukraine.",
    },
    ru: {
        title: "О бренде | MIND BODY",
        description:
            "MIND BODY — украинский бренд одежды как вторая кожа: плетёная спина, вышитое солнце, мягкая посадка для йоги, спорта, танца и каждый день. Женщины и дети. Сшито в Украине.",
        ogTitle: "MIND BODY — вторая кожа, которую узнают со спины",
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
        heroKicker: "ДРУГА ШКІРА",
        heroLines: [
            [{ w: "Нас" }, { w: "впізнають" }],
            [{ w: "зі" }, { w: "спини", em: true }],
        ] as Tok[][],
        heroSub:
            "Преміум-одяг для руху — йога, спорт, танець, щодня. Жінки та діти. Плетена спина, вишите сонце. Зшито в Україні.",
        heroCta: "Дивитися колекції",
        proofA: "Плетена спина",
        proofB: "Дорослі + діти",
        matKicker: "МАТЕРІАЛ",
        matTitle: [
            [{ w: "Плетена" }, { w: "спина" }, { w: "—" }],
            [{ w: "наш" }, { w: "підпис", em: true }],
        ] as Tok[][],
        matLead: "Шість пасем сходяться у вузол, сонце — між лопатками. Це впізнають без бирки.",
        mat: [
            { n: "Плетена спина", d: "акцент, що відкриває лінію тіла" },
            { n: "Вишите сонце", d: "фірмовий знак MIND BODY на тканині" },
            { n: "Друга шкіра", d: "м’яка посадка, що рухається з тобою" },
        ],
        flowKicker: "У РУСІ",
        flowTitle: [
            [{ w: "Рух" }, { w: "—" }],
            [{ w: "це" }, { w: "мова", em: true }],
        ] as Tok[][],
        flowSub:
            "Тіло говорить тим, як рухається. Ми шиємо одяг, який не перебиває — а підсилює кожен рух.",
        flow: [
            { n: "Зігнутись", d: "посадка не зраджує" },
            { n: "Розкритись", d: "спина відкрита, лінія чиста" },
        ],
        kidsKicker: "НАСТУПНЕ",
        kidsTitle: [
            [{ w: "Той" }, { w: "самий" }, { w: "підпис" }, { w: "—" }],
            [{ w: "нове" }, { w: "покоління", em: true }],
        ] as Tok[][],
        kidsLead:
            "Та сама плетена спина, те саме вишите сонце — тепер і в дитячій лінії. Та сама друга шкіра, той самий рух, лиш менший розмір.",
        kidsFacts: ["Та сама спина", "Зшито в Україні", "Створено для руху"],
        kidsCta: "Дивитися дитячі",
        originKicker: "ВИТОКИ",
        originQuote: [
            [{ w: "Друга" }, { w: "шкіра." }],
            [{ w: "Зшита" }, { w: "в" }, { w: "Україні", em: true }],
        ] as Tok[][],
        madeText:
            "М’яка до шкіри. Тягнеться, дихає й повертає форму. Кожен шов — в Україні, нашими руками.",
        fab: [
            "м’яка до шкіри",
            "тримає форму",
            "рухається з тобою",
            "14 днів на повернення",
            "доросла + дитяча лінія",
        ],
        galKicker: "КАТАЛОГ",
        galTitle: [
            [{ w: "Кожен" }, { w: "виріб" }, { w: "має" }],
            [{ w: "свій" }, { w: "характер", em: true }],
        ] as Tok[][],
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
        altFlow: "Модель MIND BODY у русі",
        altOrigin: "Модель у комбінезоні MIND BODY кольору сливи, вишите сонце на рукаві",
        altKidsPair: "Дві дівчинки MIND BODY KIDS у вертикальних шпагатах, тримаються за руки",
        altKidsBackTeal: "Дитячий комбінезон MIND BODY смарагдового кольору: спина і вишите сонце",
        altKidsBackBlue: "Дитячий комбінезон MIND BODY кольору пудри: плетена спина і вишите сонце",
        altKidsMacro: "Плетена спина MIND BODY KIDS зблизька: шнурівка-хрест і вишите сонце",
    },
    en: {
        made: "SEWN IN UKRAINE",
        heroKicker: "SECOND SKIN",
        heroLines: [[{ w: "Recognised" }], [{ w: "from" }, { w: "behind", em: true }]] as Tok[][],
        heroSub:
            "Premium activewear for movement — yoga, sport, dance, every day. Women and kids. A laced back, an embroidered sun. Sewn in Ukraine.",
        heroCta: "View the collections",
        proofA: "Laced back",
        proofB: "Women + kids",
        matKicker: "MATERIAL",
        matTitle: [
            [{ w: "A" }, { w: "laced" }, { w: "back" }, { w: "—" }],
            [{ w: "our" }, { w: "signature", em: true }],
        ] as Tok[][],
        matLead:
            "Six strands meet in one knot, the sun between the shoulder blades. Known without a label.",
        mat: [
            { n: "Laced back", d: "an accent that opens the line of the body" },
            { n: "Embroidered sun", d: "the MIND BODY mark, in the cloth" },
            { n: "Second skin", d: "a soft fit that moves with you" },
        ],
        flowKicker: "IN MOTION",
        flowTitle: [
            [{ w: "Movement" }, { w: "is" }],
            [{ w: "a" }, { w: "language", em: true }],
        ] as Tok[][],
        flowSub:
            "The body speaks in how it moves. We make clothing that never interrupts it — only amplifies it.",
        flow: [
            { n: "Bend", d: "the fit never betrays you" },
            { n: "Open up", d: "back open, line clean" },
        ],
        kidsKicker: "NEXT",
        kidsTitle: [
            [{ w: "The" }, { w: "same" }, { w: "signature" }, { w: "—" }],
            [{ w: "a" }, { w: "new" }, { w: "generation", em: true }],
        ] as Tok[][],
        kidsLead:
            "The same laced back, the same embroidered sun — now on the kids line too. The same second skin, the same movement, in a smaller size.",
        kidsFacts: ["The same back", "Sewn in Ukraine", "Made for movement"],
        kidsCta: "Shop kids",
        originKicker: "ORIGIN",
        originQuote: [
            [{ w: "A" }, { w: "second" }, { w: "skin." }],
            [{ w: "Sewn" }, { w: "in" }, { w: "Ukraine", em: true }],
        ] as Tok[][],
        madeText:
            "Soft on the skin. It stretches, breathes and springs back. Every seam — in Ukraine, by our hands.",
        fab: [
            "soft on the skin",
            "holds its shape",
            "moves with you",
            "14-day returns",
            "women + kids line",
        ],
        galKicker: "CATALOGUE",
        galTitle: [
            [{ w: "Every" }, { w: "piece" }, { w: "has" }],
            [{ w: "its" }, { w: "own" }, { w: "character", em: true }],
        ] as Tok[][],
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
        altFlow: "A MIND BODY model in motion",
        altOrigin: "Model in a plum MIND BODY jumpsuit, embroidered sun on the sleeve",
        altKidsPair: "Two MIND BODY KIDS girls in vertical splits, holding hands",
        altKidsBackTeal: "MIND BODY kids emerald unitard: the back and embroidered sun",
        altKidsBackBlue: "MIND BODY kids powder-blue unitard: laced back and embroidered sun",
        altKidsMacro: "MIND BODY KIDS laced back, close up: criss-cross lacing and embroidered sun",
    },
    ru: {
        made: "СШИТО В УКРАИНЕ",
        heroKicker: "ВТОРАЯ КОЖА",
        heroLines: [
            [{ w: "Нас" }, { w: "узнают" }],
            [{ w: "со" }, { w: "спины", em: true }],
        ] as Tok[][],
        heroSub:
            "Премиум-одежда для движения — йога, спорт, танец, каждый день. Женщины и дети. Плетёная спина, вышитое солнце. Сшито в Украине.",
        heroCta: "Смотреть коллекции",
        proofA: "Плетёная спина",
        proofB: "Взрослые + дети",
        matKicker: "МАТЕРИАЛ",
        matTitle: [
            [{ w: "Плетёная" }, { w: "спина" }, { w: "—" }],
            [{ w: "наш" }, { w: "почерк", em: true }],
        ] as Tok[][],
        matLead: "Шесть прядей сходятся в узел, солнце — между лопатками. Узнают без бирки.",
        mat: [
            { n: "Плетёная спина", d: "акцент, который открывает линию тела" },
            { n: "Вышитое солнце", d: "фирменный знак MIND BODY на ткани" },
            { n: "Вторая кожа", d: "мягкая посадка, что движется с тобой" },
        ],
        flowKicker: "В ДВИЖЕНИИ",
        flowTitle: [
            [{ w: "Движение" }, { w: "—" }],
            [{ w: "это" }, { w: "язык", em: true }],
        ] as Tok[][],
        flowSub:
            "Тело говорит тем, как движется. Мы шьём одежду, которая не перебивает — а усиливает каждое движение.",
        flow: [
            { n: "Согнуться", d: "посадка не подводит" },
            { n: "Раскрыться", d: "спина открыта, линия чистая" },
        ],
        kidsKicker: "СЛЕДУЮЩЕЕ",
        kidsTitle: [
            [{ w: "Тот" }, { w: "же" }, { w: "почерк" }, { w: "—" }],
            [{ w: "новое" }, { w: "поколение", em: true }],
        ] as Tok[][],
        kidsLead:
            "Та же плетёная спина, то же вышитое солнце — теперь и в детской линии. Та же вторая кожа, то же движение, лишь меньший размер.",
        kidsFacts: ["Та же спина", "Сшито в Украине", "Создано для движения"],
        kidsCta: "Смотреть детские",
        originKicker: "ИСТОКИ",
        originQuote: [
            [{ w: "Вторая" }, { w: "кожа." }],
            [{ w: "Сшита" }, { w: "в" }, { w: "Украине", em: true }],
        ] as Tok[][],
        madeText:
            "Мягкая к коже. Тянется, дышит и возвращает форму. Каждый шов — в Украине, нашими руками.",
        fab: [
            "мягкая к коже",
            "держит форму",
            "движется с тобой",
            "14 дней на возврат",
            "взрослая + детская линия",
        ],
        galKicker: "КАТАЛОГ",
        galTitle: [
            [{ w: "У" }, { w: "каждого" }, { w: "изделия" }],
            [{ w: "свой" }, { w: "характер", em: true }],
        ] as Tok[][],
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
        altFlow: "Модель MIND BODY в движении",
        altOrigin: "Модель в комбинезоне MIND BODY цвета сливы, вышитое солнце на рукаве",
        altKidsPair: "Две девочки MIND BODY KIDS в вертикальных шпагатах, держатся за руки",
        altKidsBackTeal: "Детский комбинезон MIND BODY изумрудного цвета: спина и вышитое солнце",
        altKidsBackBlue:
            "Детский комбинезон MIND BODY цвета пудры: плетёная спина и вышитое солнце",
        altKidsMacro: "Плетёная спина MIND BODY KIDS вблизи: шнуровка-крест и вышитое солнце",
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

const HERO_IMG = "/generalpics/347_131123.webp"; // teal jumpsuit, back, laced spine + sun on sleeve
const MAT_IMG = "/brand/detail-strap.webp"; // macro: turquoise woven knot + embroidered sun
const ORIGIN_IMG = "/generalpics/588_131123.webp"; // plum long-sleeve, hand to face, sun on sleeve
// "Рух — це мова" — two contained frames: bend → open back
const FLOW_IMG = [
    { src: "/brand/move-bend.webp", pos: "50% 42%" },
    { src: "/brand/move-twist.webp", pos: "50% 18%" },
];
// KIDS — the same signature (laced back + sun), the next generation, dynamic poses
const KIDS_BAND = "/brand/kids/kids-pair-splits.webp"; // two girls, mirrored vertical splits, holding hands
const KIDS_BACK_TEAL = "/brand/kids/kids-back-teal.webp"; // emerald back, mesh + sun
const KIDS_BACK_BLUE = "/brand/kids/kids-back-blue.webp"; // powder-blue back, laced + sun
const KIDS_MACRO = "/brand/kids/kids-back-macro.webp"; // macro: laced cross + embroidered sun

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
                <style>{`.ab--enter [data-hero-rise]{opacity:1!important;transform:none!important}.ab .ab-line>.l{transform:none!important}.ab-mark__img{opacity:1!important;filter:none!important;transform:none!important;clip-path:none!important}.ab-lockup__rule{opacity:1!important}.ab-hero__media img,.ab-mat__media img,.ab-flow__media img,.ab-origin__media img,.ab-kids__band img,.ab-kids__frame img{transform:none!important;clip-path:none!important}.ab-kids__band{clip-path:none!important}.ab-kids__frame{opacity:1!important;transform:none!important}.ab [data-reveal]{opacity:1!important;transform:none!important;filter:none!important}`}</style>
            </noscript>

            {/* 01 — HERO · ЗІ СПИНИ — the back laces open into the light */}
            <section className="ab-hero" data-act="hero">
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
                            style={{ "--rd": "1.65s" } as CSSProperties}
                        >
                            {c.heroSub}
                        </p>
                        <LLink
                            to="/shop/yoga"
                            className="ab-cta ab-hero__cta"
                            data-hero-rise
                            style={{ "--rd": "1.85s" } as CSSProperties}
                        >
                            <span>{c.heroCta}</span>
                            <Arrow />
                        </LLink>
                    </div>
                    <span
                        className="ab-hero__corner"
                        data-hero-rise
                        style={{ "--rd": "1.95s" } as CSSProperties}
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

            {/* 02 — MATERIAL · the laced back, large */}
            <section className="ab-sec ab-mat" data-act="material">
                <div className="ab-grid ab-mat__grid">
                    <figure className="ab-mat__media" data-reveal>
                        <Pic
                            src={MAT_IMG}
                            alt={c.altMat}
                            sizes="(max-width:860px) 100vw, 64vw"
                            position="50% 38%"
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
                                    <span
                                        className="ab-mat__n"
                                        aria-hidden="true"
                                    >{`0${i + 1}`}</span>
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

            {/* 03 — IN MOTION · the body draws a line (2 frames) */}
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
                            className="ab-flow__frame"
                            data-reveal
                            style={{ "--d": `${i * 0.08}s` } as CSSProperties}
                            key={f.n}
                        >
                            <span className="ab-flow__media">
                                <Pic
                                    src={FLOW_IMG[i].src}
                                    alt={`${c.altFlow} — ${f.n}`}
                                    sizes="(max-width:860px) 92vw, 46vw"
                                    position={FLOW_IMG[i].pos}
                                />
                            </span>
                            <figcaption className="ab-flow__cap">
                                <span className="ab-flow__n" aria-hidden="true">{`0${i + 1}`}</span>
                                <span className="ab-flow__name">{f.n}</span>
                                <span className="ab-flow__line">{f.d}</span>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            {/* 04 — KIDS · the same signature, the next generation */}
            <section className="ab-sec ab-kids" data-act="kids">
                <div className="ab-grid ab-kids__head">
                    <span className="ab-kicker" data-reveal>
                        {c.kidsKicker}
                    </span>
                </div>
                <figure className="ab-kids__band" data-reveal>
                    <Pic src={KIDS_BAND} alt={c.altKidsPair} sizes="100vw" position="50% 28%" />
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
                    <ul className="ab-kids__trip" data-reveal>
                        {[
                            { src: KIDS_BACK_TEAL, alt: c.altKidsBackTeal },
                            { src: KIDS_BACK_BLUE, alt: c.altKidsBackBlue },
                            { src: KIDS_MACRO, alt: c.altKidsMacro },
                        ].map((k, i) => (
                            <li
                                className="ab-kids__frame"
                                key={k.src}
                                style={{ "--d": `${i * 0.12}s` } as CSSProperties}
                            >
                                <Pic
                                    src={k.src}
                                    alt={k.alt}
                                    sizes="(max-width:860px) 92vw, 30vw"
                                    position="50% 24%"
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* 05 — ORIGIN · second skin, sewn in Ukraine */}
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

            {/* 06 — CATALOGUE · character (live Prisma rail) */}
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

            {/* 07 — FINAL · find your movement + contacts */}
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
