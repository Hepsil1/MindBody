import type { Route } from "./+types/about";
import { prisma } from "../db.server";
import { useLoaderData } from "react-router";
import { useEffect, useRef } from "react";
import { type SlideData } from "../components/HeroSlider";
import { EditorAffordance } from "../components/EditorAffordance";
import { buildWebpSrcset } from "../utils/responsive-image";
import { useI18n, LLink } from "../i18n";
import { localeFromParamSafe, OG_LOCALE } from "../i18n/config";
import PolotnoCloth, {
    makeClothTargets,
    type ClothTargets,
} from "../components/about/PolotnoCloth";
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

    // Shared morph targets the WebGL silk lerps toward; the scroll effect below
    // writes a preset per section so the same cloth unrolls → folds → drapes →
    // pulls taut → settles into dark satin as you scroll.
    const clothTargets = useRef<ClothTargets>(makeClothTargets());

    // Cinematic scroll reveals: add `.is-in` to [data-reveal] elements the
    // first time they enter the viewport. Reduced-motion / no IntersectionObserver
    // → everything is shown immediately.
    useEffect(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !("IntersectionObserver" in window)) {
            els.forEach((el) => el.classList.add("is-in"));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("is-in");
                        io.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [locale]);

    // Scroll authority (native scroll, no extra deps): pick the section under
    // the viewport centre and write its silk preset + a scroll-velocity energy
    // so the cloth billows when you move and breathes calm when you stop. Also
    // publishes a 0→1 --about-day progress var for subtle DOM re-grading.
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return;
        const root = document.querySelector<HTMLElement>(".about-silk");

        type Preset = Pick<ClothTargets, "fold" | "drape" | "tension" | "settle" | "dark">;
        const presets: Record<string, Preset> = {
            hero: { fold: 0.0, drape: 0.0, tension: 0.0, settle: 0.0, dark: 0.0 },
            manifesto: { fold: 1.0, drape: 0.1, tension: 0.0, settle: 0.0, dark: 0.5 },
            story: { fold: 0.45, drape: 1.0, tension: 0.0, settle: 0.0, dark: 0.5 },
            process: { fold: 0.25, drape: 0.1, tension: 1.0, settle: 0.0, dark: 0.55 },
            lookbook: { fold: 0.3, drape: 0.2, tension: 0.15, settle: 0.0, dark: 0.4 },
            contact: { fold: 0.4, drape: 0.1, tension: 0.0, settle: 1.0, dark: 0.2 },
        };

        const ids = ["hero", "manifesto", "story", "process", "lookbook", "contact"];
        let lastY = window.scrollY;
        let ticking = false;

        const apply = () => {
            ticking = false;
            const vh = window.innerHeight;
            const mid = window.scrollY + vh / 2;
            let key = "hero";
            for (const id of ids) {
                // The contact section keeps the legacy #contact-premium anchor
                // (header "Контакти" links to it); others use silk-<id>.
                const el = document.getElementById(
                    id === "contact" ? "contact-premium" : `silk-${id}`,
                );
                if (!el) continue;
                if (mid >= el.offsetTop) key = id;
            }
            const pr = presets[key] ?? presets.hero;
            const tg = clothTargets.current;
            tg.fold = pr.fold;
            tg.drape = pr.drape;
            tg.tension = pr.tension;
            tg.settle = pr.settle;
            tg.dark = pr.dark;

            const dy = Math.abs(window.scrollY - lastY);
            lastY = window.scrollY;
            tg.scrollVel = Math.min(1, tg.scrollVel * 0.6 + dy / 55);

            if (root) {
                const max = document.body.scrollHeight - vh || 1;
                root.style.setProperty("--about-day", Math.min(1, window.scrollY / max).toFixed(3));
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
        const decay = window.setInterval(() => {
            clothTargets.current.scrollVel *= 0.85;
        }, 140);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            window.clearInterval(decay);
        };
    }, [locale]);

    // Owner-curated About slides → a lookbook gallery (preserves their imagery
    // and the admin "edit slides" affordance).
    const lookbook = slides
        .flatMap((s) => [s.image1, s.image2, s.image3])
        .filter((src): src is string => Boolean(src))
        .slice(0, 6);

    return (
        <main className="about-silk">
            <h1 className="visually-hidden">{c.h1}</h1>

            {/* The single persistent hero: one living piece of WebGL silk fixed
                behind every section. A CSS gradient backdrop paints first (LCP)
                and is the fallback when WebGL/reduced-motion is unavailable. */}
            <div className="about-silk__backdrop" aria-hidden="true" />
            <PolotnoCloth targetsRef={clothTargets} />

            {/* HERO — the unrolling bolt */}
            <section id="silk-hero" className="silk-hero">
                <div className="silk-hero__mark">
                    <picture>
                        <source srcSet="/pics/mind_body_logo.webp" type="image/webp" />
                        <img
                            src="/pics/mind_body_logo.png"
                            alt="MIND BODY"
                            className="silk-hero__logo"
                        />
                    </picture>
                    <span className="silk-hero__script">sport wear</span>
                    <p className="silk-hero__tagline">{c.heroSubtitle}</p>
                </div>
                <div className="silk-scroll" aria-hidden="true">
                    <span className="silk-scroll__word">Scroll</span>
                    <span className="silk-scroll__line" />
                </div>
            </section>

            {/* MANIFESTO — the fold */}
            <section id="silk-manifesto" className="silk-manifesto">
                <p className="silk-manifesto__text">
                    <span className="silk-line" data-reveal>
                        <strong>MIND BODY</strong>
                        {c.storyLead}
                    </span>
                    <span className="silk-line" data-reveal>
                        <em>{c.storyLeadEm}</em>
                        {c.storyLeadEnd}
                    </span>
                </p>
            </section>

            {/* STORY — the drape (silk wipes to reveal the real photo) */}
            <section id="silk-story" className="silk-story">
                <div className="silk-story__media" data-reveal>
                    <picture>
                        <source
                            srcSet={buildWebpSrcset("/pics1cloths/IMG_6215.webp")}
                            sizes="(max-width: 900px) 86vw, 44vw"
                            type="image/webp"
                        />
                        <img
                            src="/pics1cloths/IMG_6215.webp"
                            alt="MIND BODY"
                            className="silk-story__img"
                            loading="lazy"
                            decoding="async"
                        />
                    </picture>
                    <span className="silk-story__est">Est. 2020</span>
                </div>
                <div className="silk-story__body silk-panel" data-reveal>
                    <span className="silk-eyebrow">Our Story</span>
                    <h2 className="silk-h2">{c.heroSubtitle}</h2>
                    <p className="silk-lede">{c.storyHighlight}</p>
                    <ul className="silk-values">
                        <li>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.1"
                                aria-hidden="true"
                            >
                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                                <path d="M8 12L11 15L16 9" />
                            </svg>
                            <span>Premium Quality</span>
                        </li>
                        <li>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.1"
                                aria-hidden="true"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            <span>Handmade with Love</span>
                        </li>
                        <li>
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.1"
                                aria-hidden="true"
                            >
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                                <path d="M2 17L12 22L22 17" />
                                <path d="M2 12L12 17L22 12" />
                            </svg>
                            <span>Eco Materials</span>
                        </li>
                    </ul>
                </div>
            </section>

            {/* PROCESS — four taut panels (gapless; kills the v1 sticky hole) */}
            <section id="silk-process" className="silk-process">
                <header className="silk-process__head silk-panel" data-reveal>
                    <span className="silk-eyebrow">{c.processTag}</span>
                    <h2 className="silk-h2">
                        {c.processTitle}
                        <em>{c.processTitleEm}</em>
                    </h2>
                </header>
                <div className="silk-process__panels">
                    {PROCESS_STEPS.map((step, i) => (
                        <article className="silk-step" data-reveal key={step.number}>
                            <div className="silk-step__media">
                                <picture>
                                    <source
                                        srcSet={buildWebpSrcset(step.image)}
                                        sizes="(max-width: 900px) 92vw, 24vw"
                                        type="image/webp"
                                    />
                                    <img
                                        src={step.image}
                                        alt={step.alt}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </picture>
                                <span className="silk-step__num">{step.number}</span>
                            </div>
                            <div className="silk-step__body">
                                <h3 className="silk-step__name">{c.steps[i].name}</h3>
                                <p>{c.steps[i].text}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* LOOKBOOK — owner-curated slide imagery (admin-editable) */}
            {lookbook.length > 0 && (
                <EditorAffordance
                    label="Редагувати слайди"
                    message={{ type: "OPEN_ABOUT_SLIDES_EDITOR" }}
                >
                    <section id="silk-lookbook" className="silk-lookbook" data-reveal>
                        <div className="silk-lookbook__grid">
                            {lookbook.map((src, i) => (
                                <figure
                                    className={`silk-lookbook__cell silk-lookbook__cell--${i % 6}`}
                                    key={src + i}
                                >
                                    <picture>
                                        <source
                                            srcSet={buildWebpSrcset(src)}
                                            sizes="(max-width: 900px) 50vw, 30vw"
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
                        </div>
                    </section>
                </EditorAffordance>
            )}

            {/* CONTACT — heavy satin settle (keeps #contact-premium anchor) */}
            <section id="contact-premium" className="silk-contact">
                <div className="silk-contact__head" data-reveal>
                    <span className="silk-eyebrow silk-eyebrow--light">{c.contactLabel}</span>
                    <h2 className="silk-h2 silk-h2--light">
                        {c.contactTitle} <em>{c.contactTitleEm}</em>
                    </h2>
                    <p className="silk-contact__desc">
                        <em>{c.contactDescEm}</em>
                        {c.contactDescEnd}
                    </p>
                </div>
                <div className="silk-contact__body" data-reveal>
                    <div className="silk-contact__phones">
                        {PHONES.map((phone, i) => (
                            <a
                                href={`tel:${phone.tel}`}
                                className="silk-contact__link"
                                key={phone.tel}
                            >
                                <span className="silk-contact__icon">
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        aria-hidden="true"
                                    >
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                </span>
                                <span className="silk-contact__info">
                                    <span className="silk-contact__phone">{phone.display}</span>
                                    <span className="silk-contact__hint">{c.phoneHints[i]}</span>
                                </span>
                            </a>
                        ))}
                    </div>
                    <div className="silk-contact__cta">
                        <a
                            href="https://www.instagram.com/mind_body_sportwear/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="silk-contact__ig"
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
                        <LLink to="/shop/yoga" className="silk-contact__shop">
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
            </section>
        </main>
    );
}
