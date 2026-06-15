import type { Route } from "./+types/about";
import { prisma } from "../db.server";
import { useLoaderData } from "react-router";
import { useEffect } from "react";
import { type SlideData } from "../components/HeroSlider";
import { EditorAffordance } from "../components/EditorAffordance";
import { buildWebpSrcset, buildAvifSrcset } from "../utils/responsive-image";
import { getLqipStyle } from "../utils/lqip";
import { useI18n, LLink } from "../i18n";
import { localeFromParamSafe, OG_LOCALE } from "../i18n/config";
import "../styles/about-page.css";

const META = {
    uk: {
        title: "Про бренд | MIND BODY",
        description:
            "MIND BODY — український бренд спортивного одягу для йоги, танців, гімнастики. Premium якість, ручна робота, еко-матеріали.",
        ogTitle: "Про бренд MIND BODY",
        ogDescription:
            "Український бренд спортивного одягу. Premium якість, ручна робота, еко-матеріали.",
    },
    en: {
        title: "About the Brand | MIND BODY",
        description:
            "MIND BODY is a Ukrainian sportswear brand for yoga, dance and gymnastics. Premium quality, handmade, eco-friendly materials.",
        ogTitle: "About the MIND BODY brand",
        ogDescription:
            "Ukrainian sportswear brand. Premium quality, handmade, eco-friendly materials.",
    },
    ru: {
        title: "О бренде | MIND BODY",
        description:
            "MIND BODY — украинский бренд спортивной одежды для йоги, танцев, гимнастики. Premium качество, ручная работа, эко-материалы.",
        ogTitle: "О бренде MIND BODY",
        ogDescription:
            "Украинский бренд спортивной одежды. Premium качество, ручная работа, эко-материалы.",
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
        { property: "og:image", content: "/brand-sun.png" },
        { property: "og:image:width", content: "504" },
        { property: "og:image:height", content: "503" },
        { property: "og:locale", content: OG_LOCALE[locale] },
    ];
}

export function headers() {
    return { "Cache-Control": "no-cache" };
}

const HERO_VIDEO = "/uploads/brand-hero.mp4";
const HERO_POSTER = "/pics1cloths/IMG_6201.webp";
const STORY_IMG = "/lifestyle/0Y4A5932.webp";

const PROCESS_STEPS = [
    { number: "01", image: "/pics1cloths/IMG_6203.webp", alt: "Idea" },
    { number: "02", image: "/pics1cloths/IMG_6209.webp", alt: "Materials" },
    { number: "03", image: "/pics1cloths/IMG_6212.webp", alt: "Sewing" },
    { number: "04", image: "/pics1cloths/IMG_6201.webp", alt: "Result" },
] as const;

// Lookbook — the bright lifestyle shoot, in an aligned editorial grid.
const LOOKBOOK = [
    "/lifestyle/0Y4A5929.webp",
    "/lifestyle/0Y4A5969.webp",
    "/lifestyle/0Y4A5940.webp",
    "/lifestyle/0Y4A5975.webp",
    "/lifestyle/0Y4A6005.webp",
    "/lifestyle/0Y4A5994.webp",
];

const PHONES = [
    { tel: "+380966650855", display: "+380 (96) 665-08-55" },
    { tel: "+380509656737", display: "+380 (50) 965-67-37" },
    { tel: "+380973542848", display: "+380 (97) 354-28-48" },
] as const;

const VALUES = [
    {
        title: "Premium Quality",
        path: "M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z M8 12L11 15L16 9",
    },
    {
        title: "Handmade with Love",
        path: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    },
    {
        title: "Eco Materials",
        path: "M12 2L2 7L12 12L22 7L12 2Z M2 17L12 22L22 17 M2 12L12 17L22 12",
    },
] as const;

const CONTENT = {
    uk: {
        h1: "Про бренд MIND BODY — преміум одяг для йоги, спорту та активного життя",
        aboutEyebrow: "Про бренд",
        heroSubtitle: "Одяг, який надихає тебе рухатись",
        heroIntro:
            "MIND BODY — український бренд преміального спортивного одягу. Ми створюємо речі, у яких йога, танець і фітнес перетворюються на задоволення.",
        storyLead: " — бренд одягу для йоги, танців, фітнесу та інших видів спорту, який ",
        storyLeadEm: "чудово зарекомендував себе",
        storyLeadEnd: " серед відомих тренерів по всьому світу.",
        storyHighlight:
            "Одяг, стимулюючий до практики, в ньому всі твої улюблені заняття перетворюються на справжнє задоволення.",
        valuesEyebrow: "Наші цінності",
        processTag: "Наш процес",
        processTitle: "Шлях до ",
        processTitleEm: "досконалості",
        steps: [
            {
                name: "Ідея",
                text: "Натхнення з практики йоги та активного руху. Ми створюємо образи, що відповідають духу свободи.",
            },
            {
                name: "Матеріали",
                text: "Тканини найвищої якості з усього світу. Дихаючі, еластичні та довговічні.",
            },
            {
                name: "Пошив",
                text: "Ручна робота досвідчених майстрів. Кожен шов — це прояв любові до справи.",
            },
            {
                name: "Результат",
                text: "Одяг, що надихає на нові звершення. Стиль, комфорт та впевненість у кожному русі.",
            },
        ],
        lookbookEyebrow: "Лукбук",
        lookbookTitle: "Життя у русі",
        contactLabel: "Ми на зв'язку",
        contactTitle: "Давай",
        contactTitleEm: "поговоримо",
        contactDesc:
            "Готові відповісти на будь-які питання та допомогти з вибором ідеального образу для вас.",
        phoneHints: ["Основний", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Слідкуй за нами в Instagram",
        collectionCta: "Переглянути колекцію",
    },
    en: {
        h1: "About the MIND BODY brand — premium apparel for yoga, sport and active living",
        aboutEyebrow: "About the brand",
        heroSubtitle: "Clothing that inspires you to move",
        heroIntro:
            "MIND BODY is a Ukrainian premium sportswear brand. We make pieces in which yoga, dance and fitness turn into pure pleasure.",
        storyLead: " — a brand of apparel for yoga, dance, fitness and other sports that has ",
        storyLeadEm: "proven itself",
        storyLeadEnd: " among renowned coaches all over the world.",
        storyHighlight:
            "Clothing that inspires your practice — in it, all your favourite activities turn into pure delight.",
        valuesEyebrow: "Our values",
        processTag: "Our process",
        processTitle: "The path to ",
        processTitleEm: "perfection",
        steps: [
            {
                name: "Idea",
                text: "Inspiration drawn from yoga practice and active movement. We create looks that match the spirit of freedom.",
            },
            {
                name: "Materials",
                text: "The finest fabrics from around the world. Breathable, stretchy and built to last.",
            },
            {
                name: "Sewing",
                text: "Handcrafted by experienced makers. Every seam is an expression of love for the craft.",
            },
            {
                name: "Result",
                text: "Clothing that inspires new achievements. Style, comfort and confidence in every move.",
            },
        ],
        lookbookEyebrow: "Lookbook",
        lookbookTitle: "Life in motion",
        contactLabel: "We're in touch",
        contactTitle: "Let's",
        contactTitleEm: "talk",
        contactDesc: "Ready to answer any question and help you find your perfect look.",
        phoneHints: ["Main", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Follow us on Instagram",
        collectionCta: "Shop the collection",
    },
    ru: {
        h1: "О бренде MIND BODY — премиум одежда для йоги, спорта и активной жизни",
        aboutEyebrow: "О бренде",
        heroSubtitle: "Одежда, которая вдохновляет тебя двигаться",
        heroIntro:
            "MIND BODY — украинский бренд премиальной спортивной одежды. Мы создаём вещи, в которых йога, танец и фитнес превращаются в удовольствие.",
        storyLead: " — бренд одежды для йоги, танцев, фитнеса и других видов спорта, который ",
        storyLeadEm: "отлично зарекомендовал себя",
        storyLeadEnd: " среди известных тренеров по всему миру.",
        storyHighlight:
            "Одежда, стимулирующая к практике, — в ней все твои любимые занятия превращаются в настоящее удовольствие.",
        valuesEyebrow: "Наши ценности",
        processTag: "Наш процесс",
        processTitle: "Путь к ",
        processTitleEm: "совершенству",
        steps: [
            {
                name: "Идея",
                text: "Вдохновение из практики йоги и активного движения. Мы создаём образы, отвечающие духу свободы.",
            },
            {
                name: "Материалы",
                text: "Ткани высочайшего качества со всего мира. Дышащие, эластичные и долговечные.",
            },
            {
                name: "Пошив",
                text: "Ручная работа опытных мастеров. Каждый шов — проявление любви к делу.",
            },
            {
                name: "Результат",
                text: "Одежда, вдохновляющая на новые свершения. Стиль, комфорт и уверенность в каждом движении.",
            },
        ],
        lookbookEyebrow: "Лукбук",
        lookbookTitle: "Жизнь в движении",
        contactLabel: "Мы на связи",
        contactTitle: "Давай",
        contactTitleEm: "поговорим",
        contactDesc:
            "Готовы ответить на любые вопросы и помочь с выбором идеального образа для вас.",
        phoneHints: ["Основной", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Следи за нами в Instagram",
        collectionCta: "Смотреть коллекцию",
    },
} as const;

export async function loader() {
    try {
        const aboutSlidesRaw = await prisma.slide.findMany({
            where: { page: "about" },
            orderBy: { order: "asc" },
            select: {
                id: true,
                name: true,
                type: true,
                link: true,
                image1: true,
                image2: true,
                image3: true,
            },
        });
        const aboutSlides: SlideData[] = aboutSlidesRaw.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type as "triptych" | "single",
            link: s.link,
            image1: s.image1,
            image2: s.image2,
            image3: s.image3,
        }));
        return { slides: aboutSlides };
    } catch (error) {
        console.error("About loader error:", error);
        return { slides: [] };
    }
}

function Pic({
    src,
    alt = "MIND BODY",
    sizes = "100vw",
}: {
    src: string;
    alt?: string;
    sizes?: string;
}) {
    return (
        <picture>
            <source srcSet={buildAvifSrcset(src)} sizes={sizes} type="image/avif" />
            <source srcSet={buildWebpSrcset(src)} sizes={sizes} type="image/webp" />
            <img src={src} alt={alt} loading="lazy" decoding="async" style={getLqipStyle(src)} />
        </picture>
    );
}

export default function About() {
    const { slides } = useLoaderData<typeof loader>();
    const { locale } = useI18n();
    const c = CONTENT[locale];

    // Tasteful scroll-reveal + offscreen-pause the one brand video.
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
        const video = document.querySelector<HTMLVideoElement>(".ab video");

        let vio: IntersectionObserver | null = null;
        if (video && "IntersectionObserver" in window) {
            const obs = new IntersectionObserver(
                ([e]) => {
                    if (e.isIntersecting) video.play().catch(() => {});
                    else video.pause();
                },
                { threshold: 0.25 },
            );
            obs.observe(video);
            vio = obs;
        } else {
            video?.play().catch(() => {});
        }

        if (reduce || !("IntersectionObserver" in window)) {
            reveals.forEach((el) => el.classList.add("in"));
            return () => vio?.disconnect();
        }
        document.querySelector(".ab")?.classList.add("ab--anim");
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("in");
                        io.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.16, rootMargin: "0px 0px -10% 0px" },
        );
        reveals.forEach((el) => io.observe(el));
        return () => {
            io.disconnect();
            vio?.disconnect();
        };
    }, [locale]);

    const lookbook = slides
        .flatMap((s) => [s.image1, s.image2, s.image3])
        .filter((src): src is string => Boolean(src))
        .slice(0, 6);
    const gallery = lookbook.length >= 4 ? lookbook : LOOKBOOK;

    return (
        <main className="ab">
            <h1 className="visually-hidden">{c.h1}</h1>

            {/* HERO — intro + brand film */}
            <section className="ab-hero">
                <div className="ab-hero__text" data-reveal>
                    <span className="ab-eyebrow">{c.aboutEyebrow}</span>
                    <p className="ab-hero__title">{c.heroSubtitle}</p>
                    <p className="ab-hero__lead">{c.heroIntro}</p>
                    <span className="ab-hero__est">Est. 2020 · Ukraine</span>
                </div>
                <div className="ab-hero__media" data-reveal>
                    <video
                        poster={HERO_POSTER}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        aria-hidden="true"
                    >
                        <source src={HERO_VIDEO} type="video/mp4" />
                    </video>
                </div>
            </section>

            {/* STORY — the brand, in words */}
            <section className="ab-story">
                <div className="ab-story__media" data-reveal>
                    <Pic src={STORY_IMG} sizes="(max-width: 900px) 90vw, 46vw" />
                </div>
                <div className="ab-story__body" data-reveal>
                    <h2 className="ab-h2">
                        <strong>MIND&nbsp;BODY</strong>
                        {c.storyLead}
                        <em>{c.storyLeadEm}</em>
                        {c.storyLeadEnd}
                    </h2>
                    <p className="ab-story__highlight">{c.storyHighlight}</p>
                </div>
            </section>

            {/* VALUES */}
            <section className="ab-values">
                <span className="ab-eyebrow ab-eyebrow--center" data-reveal>
                    {c.valuesEyebrow}
                </span>
                <ul className="ab-values__grid">
                    {VALUES.map((v, i) => (
                        <li
                            className="ab-value"
                            data-reveal
                            style={{ transitionDelay: `${i * 0.08}s` }}
                            key={v.title}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1"
                                aria-hidden="true"
                            >
                                <path d={v.path} />
                            </svg>
                            <span>{v.title}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* PROCESS — the making, with descriptions */}
            <section className="ab-process">
                <header className="ab-process__head" data-reveal>
                    <span className="ab-eyebrow">{c.processTag}</span>
                    <h2 className="ab-h2 ab-process__title">
                        {c.processTitle}
                        <em>{c.processTitleEm}</em>
                    </h2>
                </header>
                <div className="ab-process__grid">
                    {PROCESS_STEPS.map((step, i) => (
                        <article
                            className="ab-step"
                            data-reveal
                            style={{ transitionDelay: `${(i % 2) * 0.08}s` }}
                            key={step.number}
                        >
                            <div className="ab-step__media">
                                <Pic
                                    src={step.image}
                                    alt={step.alt}
                                    sizes="(max-width: 900px) 90vw, 44vw"
                                />
                                <span className="ab-step__num">{step.number}</span>
                            </div>
                            <div className="ab-step__text">
                                <h3 className="ab-step__name">{c.steps[i].name}</h3>
                                <p>{c.steps[i].text}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* LOOKBOOK — aligned gallery */}
            <EditorAffordance
                label="Редагувати слайди"
                message={{ type: "OPEN_ABOUT_SLIDES_EDITOR" }}
            >
                <section className="ab-lookbook">
                    <header className="ab-lookbook__head" data-reveal>
                        <span className="ab-eyebrow">{c.lookbookEyebrow}</span>
                        <h2 className="ab-h2">{c.lookbookTitle}</h2>
                    </header>
                    <div className="ab-lookbook__grid">
                        {gallery.map((src, i) => (
                            <figure
                                className={`ab-cell ab-cell--${i % 6}`}
                                data-reveal
                                style={{ transitionDelay: `${(i % 3) * 0.07}s` }}
                                key={src + i}
                            >
                                <Pic src={src} sizes="(max-width: 900px) 50vw, 32vw" />
                            </figure>
                        ))}
                    </div>
                </section>
            </EditorAffordance>

            {/* CONTACT — dark teal close (keeps #contact-premium) */}
            <section id="contact-premium" className="ab-contact">
                <div className="ab-contact__inner">
                    <div className="ab-contact__head" data-reveal>
                        <span className="ab-eyebrow ab-eyebrow--light">{c.contactLabel}</span>
                        <h2 className="ab-h2 ab-h2--light">
                            {c.contactTitle} <em>{c.contactTitleEm}</em>
                        </h2>
                        <p className="ab-contact__desc">{c.contactDesc}</p>
                    </div>
                    <div className="ab-contact__cols" data-reveal>
                        <div className="ab-contact__phones">
                            {PHONES.map((phone, i) => (
                                <a href={`tel:${phone.tel}`} className="ab-phone" key={phone.tel}>
                                    <span className="ab-phone__num">{phone.display}</span>
                                    <span className="ab-phone__hint">{c.phoneHints[i]}</span>
                                </a>
                            ))}
                        </div>
                        <div className="ab-contact__cta">
                            <a
                                href="https://www.instagram.com/mind_body_sportwear/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ab-btn ab-btn--solid"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                                <span>{c.instagramCta}</span>
                            </a>
                            <LLink to="/shop/yoga" className="ab-btn ab-btn--ghost">
                                <span>{c.collectionCta}</span>
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                >
                                    <path d="M5 12h14M13 6l6 6-6 6" />
                                </svg>
                            </LLink>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
