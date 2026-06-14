import type { Route } from "./+types/about";
import { prisma } from "../db.server";
import { useLoaderData } from "react-router";
import { useEffect } from "react";
import { type SlideData } from "../components/HeroSlider";
import { EditorAffordance } from "../components/EditorAffordance";
import { buildWebpSrcset } from "../utils/responsive-image";
import { useI18n, LLink } from "../i18n";
import { localeFromParamSafe, OG_LOCALE } from "../i18n/config";
import "../styles/about-page.css";
import "../styles/home.css";
import "../styles/contacts.css";

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
        {
            name: "description",
            content: m.description,
        },
        { property: "og:title", content: m.ogTitle },
        {
            property: "og:description",
            content: m.ogDescription,
        },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "/brand-sun.png" },
        // brand-sun.png is 504x503. Declaring up front avoids the social
        // preview "fetching..." placeholder on first share.
        { property: "og:image:width", content: "504" },
        { property: "og:image:height", content: "503" },
        { property: "og:locale", content: OG_LOCALE[locale] },
    ];
}

// Static per-card data for the process section — images and numbers don't
// change with the locale; names/texts come from CONTENT[locale].steps.
const PROCESS_STEPS = [
    { number: "01", image: "/pics1cloths/IMG_6203.webp", alt: "Idea" },
    { number: "02", image: "/pics1cloths/IMG_6209.webp", alt: "Materials" },
    { number: "03", image: "/pics1cloths/IMG_6212.webp", alt: "Sewing" },
    { number: "04", image: "/pics1cloths/IMG_6201.webp", alt: "Result" },
] as const;

// Phone list of the contact section — numbers are locale-independent;
// the hint under each number comes from CONTENT[locale].phoneHints.
const PHONES = [
    { tel: "+380966650855", display: "+380 (96) 665-08-55" },
    { tel: "+380509656737", display: "+380 (50) 965-67-37" },
    { tel: "+380973542848", display: "+380 (97) 354-28-48" },
] as const;

// Campaign-film acts: one full-screen photo each (Ken Burns + parallax).
const HERO_IMG = "/pics1cloths/IMG_6204.webp";
const STATEMENT_IMG = "/pics1cloths/IMG_6202.webp";
const CRAFT_IMG = "/pics1cloths/IMG_6212.webp";
const VALUES_IMG = "/pics1cloths/IMG_6206.webp";
const CONTACT_IMG = "/pics1cloths/IMG_6207.webp";
// The auto-scrolling reel between acts — pure visual rhythm, no text.
const REEL = [
    "/pics1cloths/IMG_6210.webp",
    "/pics1cloths/IMG_6205.webp",
    "/pics1cloths/IMG_6201.webp",
    "/pics1cloths/IMG_6203.webp",
    "/pics1cloths/IMG_6209.webp",
    "/pics1cloths/IMG_6215.webp",
];
// Latin value tags (kept as short editorial labels, as in the brand copy).
const VALUES = ["Premium Quality", "Handmade with Love", "Eco Materials"] as const;

// Long-form brand prose lives inline per locale (not in the t() dictionary).
// The `uk` variant is the canonical text — keep it byte-identical.
const CONTENT = {
    uk: {
        h1: "Про бренд MIND BODY — преміум одяг для йоги, спорту та активного життя",
        heroSubtitle: "Одяг, який надихає тебе рухатись",
        storyLead: " — бренд одягу для йоги, танців, фітнесу та інших видів спорту, який ",
        storyLeadEm: "чудово зарекомендував себе",
        storyLeadEnd: " серед відомих тренерів по всьому світу.",
        storyHighlight:
            "Одяг, стимулюючий до практики, в ньому всі твої улюблені заняття перетворюються на справжнє задоволення!",
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
        contactLabel: "Ми на зв'язку",
        contactTitle: "Давай",
        contactTitleEm: "поговоримо",
        contactDescEm: "Готові відповісти",
        contactDescEnd: " на будь-які питання та допомогти з вибором ідеального образу для вас",
        phoneHints: ["Основний", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Слідкуй за нами в Instagram",
        collectionCta: "Переглянути колекцію",
    },
    en: {
        h1: "About the MIND BODY brand — premium apparel for yoga, sport and active living",
        heroSubtitle: "Clothing that inspires you to move",
        storyLead: " — a brand of apparel for yoga, dance, fitness and other sports that has ",
        storyLeadEm: "proven itself",
        storyLeadEnd: " among renowned coaches all over the world.",
        storyHighlight:
            "Clothing that inspires your practice — in it, all your favourite activities turn into pure delight!",
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
        contactLabel: "We're in touch",
        contactTitle: "Let's",
        contactTitleEm: "talk",
        contactDescEm: "Ready to answer",
        contactDescEnd: " any question and help you find your perfect look",
        phoneHints: ["Main", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Follow us on Instagram",
        collectionCta: "Shop the collection",
    },
    ru: {
        h1: "О бренде MIND BODY — премиум одежда для йоги, спорта и активной жизни",
        heroSubtitle: "Одежда, которая вдохновляет тебя двигаться",
        storyLead: " — бренд одежды для йоги, танцев, фитнеса и других видов спорта, который ",
        storyLeadEm: "отлично зарекомендовал себя",
        storyLeadEnd: " среди известных тренеров по всему миру.",
        storyHighlight:
            "Одежда, стимулирующая к практике, — в ней все твои любимые занятия превращаются в настоящее удовольствие!",
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
        contactLabel: "Мы на связи",
        contactTitle: "Давай",
        contactTitleEm: "поговорим",
        contactDescEm: "Готовы ответить",
        contactDescEnd: " на любые вопросы и помочь с выбором идеального образа для вас",
        phoneHints: ["Основной", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Следи за нами в Instagram",
        collectionCta: "Смотреть коллекцию",
    },
} as const;

export async function loader({ request }: Route.LoaderArgs) {
    try {
        // Fetch About slides via typed Prisma query. The Slide model has a
        // `page` column scoped by which page renders the slide.
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

export default function About() {
    const { slides } = useLoaderData<typeof loader>();
    const { locale } = useI18n();
    const c = CONTENT[locale];

    // Cinematic motion (native scroll, no deps):
    //  • [data-cine-reveal] → `.in` on first entry (type/photos reveal in).
    //  • each [data-cine] act gets a 0→1 `--p` across its pinned scroll range,
    //    driving the Ken-Burns zoom + parallax of its sticky full-screen photo.
    // Reduced-motion / no-IO → everything shown immediately, no scroll work.
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-cine-reveal]"));
        if (reduce || !("IntersectionObserver" in window)) {
            reveals.forEach((el) => el.classList.add("in"));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("in");
                        io.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.25, rootMargin: "0px 0px -12% 0px" },
        );
        // Only now (JS present, motion allowed) arm the hidden→reveal states.
        document.querySelector(".cine")?.classList.add("cine--anim");
        reveals.forEach((el) => io.observe(el));

        const acts = Array.from(document.querySelectorAll<HTMLElement>("[data-cine]"));
        let ticking = false;
        const apply = () => {
            ticking = false;
            const vh = window.innerHeight;
            const y = window.scrollY;
            for (const act of acts) {
                const top = act.offsetTop;
                const h = act.offsetHeight;
                const p = Math.min(1, Math.max(0, (y - top) / Math.max(h - vh, 1)));
                act.style.setProperty("--p", p.toFixed(3));
            }
        };
        const onScroll = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(apply);
            }
        };
        apply();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            io.disconnect();
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [locale]);

    // Owner-curated About slides → a lookbook gallery (preserves their imagery
    // and the admin "edit slides" affordance).
    const lookbook = slides
        .flatMap((s) => [s.image1, s.image2, s.image3])
        .filter((src): src is string => Boolean(src))
        .slice(0, 6);

    return (
        <main className="cine">
            <h1 className="visually-hidden">{c.h1}</h1>
            <div className="cine-grain" aria-hidden="true" />

            {/* ACT I — opening title card */}
            <section className="cine-act cine-act--hero" data-cine>
                <div className="cine-stage">
                    <div className="cine-media">
                        <picture>
                            <source
                                srcSet={buildWebpSrcset(HERO_IMG)}
                                sizes="100vw"
                                type="image/webp"
                            />
                            <img
                                src={HERO_IMG}
                                alt="MIND BODY"
                                className="cine-ken"
                                decoding="async"
                            />
                        </picture>
                    </div>
                    <div className="cine-veil cine-veil--hero" />
                    <div className="cine-hero__copy">
                        <picture>
                            <source srcSet="/pics/mind_body_logo_white.webp" type="image/webp" />
                            <img
                                src="/pics/mind_body_logo_white.webp"
                                alt="MIND BODY"
                                className="cine-hero__logo"
                            />
                        </picture>
                    </div>
                    <div className="cine-scroll" aria-hidden="true">
                        <span className="cine-scroll__line" />
                    </div>
                </div>
            </section>

            {/* ACT II — the statement (the only real line of copy) */}
            <section className="cine-act cine-act--statement" data-cine>
                <div className="cine-stage">
                    <div className="cine-media">
                        <picture>
                            <source
                                srcSet={buildWebpSrcset(STATEMENT_IMG)}
                                sizes="100vw"
                                type="image/webp"
                            />
                            <img
                                src={STATEMENT_IMG}
                                alt="MIND BODY"
                                className="cine-ken cine-ken--right"
                                loading="lazy"
                                decoding="async"
                            />
                        </picture>
                    </div>
                    <div className="cine-veil cine-veil--left" />
                    <div className="cine-copy cine-copy--left">
                        <p className="cine-statement" data-cine-reveal>
                            {c.heroSubtitle}
                        </p>
                    </div>
                </div>
            </section>

            {/* REEL — auto-scrolling film strip, pure rhythm (no text) */}
            <section className="cine-reel" aria-label="MIND BODY">
                <div className="cine-reel__track">
                    {[...REEL, ...REEL].map((src, i) => (
                        <figure
                            className="cine-reel__cell"
                            key={src + i}
                            aria-hidden={i >= REEL.length}
                        >
                            <picture>
                                <source
                                    srcSet={buildWebpSrcset(src)}
                                    sizes="40vw"
                                    type="image/webp"
                                />
                                <img src={src} alt="MIND BODY" loading="lazy" decoding="async" />
                            </picture>
                        </figure>
                    ))}
                </div>
            </section>

            {/* ACT III — the craft, told in four words over one frame */}
            <section className="cine-act cine-act--craft" data-cine>
                <div className="cine-stage">
                    <div className="cine-media">
                        <picture>
                            <source
                                srcSet={buildWebpSrcset(CRAFT_IMG)}
                                sizes="100vw"
                                type="image/webp"
                            />
                            <img
                                src={CRAFT_IMG}
                                alt="MIND BODY"
                                className="cine-ken"
                                loading="lazy"
                                decoding="async"
                            />
                        </picture>
                    </div>
                    <div className="cine-veil" />
                    <div className="cine-copy cine-copy--center">
                        <span className="cine-eyebrow" data-cine-reveal>
                            {c.processTag}
                        </span>
                        <ol className="cine-craft">
                            {PROCESS_STEPS.map((step, i) => (
                                <li
                                    className="cine-craft__item"
                                    data-cine-reveal
                                    style={{ transitionDelay: `${i * 0.1}s` }}
                                    key={step.number}
                                >
                                    <span className="cine-craft__num">{step.number}</span>
                                    <span className="cine-craft__name">{c.steps[i].name}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </section>

            {/* ACT IV — values */}
            <section className="cine-act cine-act--values" data-cine>
                <div className="cine-stage">
                    <div className="cine-media">
                        <picture>
                            <source
                                srcSet={buildWebpSrcset(VALUES_IMG)}
                                sizes="100vw"
                                type="image/webp"
                            />
                            <img
                                src={VALUES_IMG}
                                alt="MIND BODY"
                                className="cine-ken cine-ken--right"
                                loading="lazy"
                                decoding="async"
                            />
                        </picture>
                    </div>
                    <div className="cine-veil cine-veil--left" />
                    <div className="cine-copy cine-copy--left">
                        <ul className="cine-values">
                            {VALUES.map((v, i) => (
                                <li
                                    className="cine-values__line"
                                    data-cine-reveal
                                    style={{ transitionDelay: `${i * 0.12}s` }}
                                    key={v}
                                >
                                    {v}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* LOOKBOOK — owner-curated slides (admin-editable; hidden if none) */}
            {lookbook.length > 0 && (
                <EditorAffordance
                    label="Редагувати слайди"
                    message={{ type: "OPEN_ABOUT_SLIDES_EDITOR" }}
                >
                    <section className="cine-lookbook" data-cine-reveal>
                        {lookbook.map((src, i) => (
                            <figure className="cine-lookbook__cell" key={src + i}>
                                <picture>
                                    <source
                                        srcSet={buildWebpSrcset(src)}
                                        sizes="(max-width: 900px) 50vw, 33vw"
                                        type="image/webp"
                                    />
                                    <img
                                        src={src}
                                        alt="MIND BODY"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </picture>
                            </figure>
                        ))}
                    </section>
                </EditorAffordance>
            )}

            {/* ACT V — contact close (keeps #contact-premium anchor) */}
            <section id="contact-premium" className="cine-act cine-act--contact" data-cine>
                <div className="cine-stage">
                    <div className="cine-media">
                        <picture>
                            <source
                                srcSet={buildWebpSrcset(CONTACT_IMG)}
                                sizes="100vw"
                                type="image/webp"
                            />
                            <img
                                src={CONTACT_IMG}
                                alt="MIND BODY"
                                className="cine-ken"
                                loading="lazy"
                                decoding="async"
                            />
                        </picture>
                    </div>
                    <div className="cine-veil cine-veil--strong" />
                    <div className="cine-copy cine-contact">
                        <span className="cine-eyebrow" data-cine-reveal>
                            {c.contactLabel}
                        </span>
                        <h2 className="cine-contact__title" data-cine-reveal>
                            {c.contactTitle} <em>{c.contactTitleEm}</em>
                        </h2>
                        <div className="cine-contact__phones" data-cine-reveal>
                            {PHONES.map((phone, i) => (
                                <a href={`tel:${phone.tel}`} className="cine-phone" key={phone.tel}>
                                    <span className="cine-phone__num">{phone.display}</span>
                                    <span className="cine-phone__hint">{c.phoneHints[i]}</span>
                                </a>
                            ))}
                        </div>
                        <div className="cine-contact__cta" data-cine-reveal>
                            <a
                                href="https://www.instagram.com/mind_body_sportwear/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cine-btn cine-btn--solid"
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
                            <LLink to="/shop/yoga" className="cine-btn cine-btn--ghost">
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
