import type { Route } from "./+types/about";
import { prisma } from "../db.server";
import { useLoaderData } from "react-router";
import { useEffect } from "react";
import { type SlideData } from "../components/HeroSlider";
import { EditorAffordance } from "../components/EditorAffordance";
import { buildWebpSrcset, buildAvifSrcset } from "../utils/responsive-image";
import { getLqip, getLqipStyle } from "../utils/lqip";
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

// HTML must revalidate every deploy (hashed chunks change) — otherwise a
// stale cached document references a 404'd chunk and hydration sticks.
export function headers() {
    return { "Cache-Control": "no-cache" };
}

// ── Real curated assets (from the brand shoot + Telegram lookbook) ──────────
const HERO_VIDEO = "/uploads/brand-hero.mp4";
const HERO_POSTER = "/pics1cloths/IMG_6201.webp"; // LCP paint
const STATEMENT_STILL = "/pics1cloths/IMG_6206.webp"; // studio, hood up
const STUDIO_STILLNESS = "/pics1cloths/IMG_6202.webp"; // studio, back
const STUDIO_MOTION = "/pics1cloths/IMG_6203.webp"; // studio, motion
const DAYBREAK_SHADOW = "/pics1cloths/IMG_6210.webp"; // studio (clipped away)
const DAYBREAK_LIGHT = "/lifestyle/0Y4A5932.webp"; // terrace (revealed)
const CONTACT_BG = "/lifestyle/0Y4A5964.webp"; // softened bright close
// Daylight lookbook grid — the four craft words ride the first four cells.
const TERRACE = [
    "/lifestyle/0Y4A5929.webp",
    "/lifestyle/0Y4A5969.webp",
    "/lifestyle/0Y4A5940.webp",
    "/lifestyle/0Y4A5975.webp",
    "/lifestyle/0Y4A6005.webp",
    "/lifestyle/0Y4A5994.webp",
];

const PROCESS_STEPS = [
    { number: "01", image: "/pics1cloths/IMG_6203.webp", alt: "Idea" },
    { number: "02", image: "/pics1cloths/IMG_6209.webp", alt: "Materials" },
    { number: "03", image: "/pics1cloths/IMG_6212.webp", alt: "Sewing" },
    { number: "04", image: "/pics1cloths/IMG_6201.webp", alt: "Result" },
] as const;

const PHONES = [
    { tel: "+380966650855", display: "+380 (96) 665-08-55" },
    { tel: "+380509656737", display: "+380 (50) 965-67-37" },
    { tel: "+380973542848", display: "+380 (97) 354-28-48" },
] as const;

// Long-form brand prose per locale (uk canonical). Most of it is unused on
// this minimal-copy page — kept so the wording stays under one roof.
const CONTENT = {
    uk: {
        h1: "Про бренд MIND BODY — преміум одяг для йоги, спорту та активного життя",
        heroSubtitle: "Одяг, який надихає тебе рухатись",
        studyEyebrow: "Етюд у світлі",
        stillnessTag: "Спокій",
        motionTag: "Рух",
        daybreakTitle: "Світло, що",
        daybreakTitleEm: "розкриває",
        processTag: "Наш процес",
        steps: [{ name: "Ідея" }, { name: "Матеріали" }, { name: "Пошив" }, { name: "Результат" }],
        contactLabel: "Ми на зв'язку",
        contactTitle: "Давай",
        contactTitleEm: "поговоримо",
        phoneHints: ["Основний", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Слідкуй за нами в Instagram",
        collectionCta: "Переглянути колекцію",
    },
    en: {
        h1: "About the MIND BODY brand — premium apparel for yoga, sport and active living",
        heroSubtitle: "Clothing that inspires you to move",
        studyEyebrow: "A study in light",
        stillnessTag: "Stillness",
        motionTag: "Motion",
        daybreakTitle: "Light that",
        daybreakTitleEm: "reveals",
        processTag: "Our process",
        steps: [{ name: "Idea" }, { name: "Materials" }, { name: "Sewing" }, { name: "Result" }],
        contactLabel: "We're in touch",
        contactTitle: "Let's",
        contactTitleEm: "talk",
        phoneHints: ["Main", "Viber / Telegram", "WhatsApp"],
        instagramCta: "Follow us on Instagram",
        collectionCta: "Shop the collection",
    },
    ru: {
        h1: "О бренде MIND BODY — премиум одежда для йоги, спорта и активной жизни",
        heroSubtitle: "Одежда, которая вдохновляет тебя двигаться",
        studyEyebrow: "Этюд в свете",
        stillnessTag: "Покой",
        motionTag: "Движение",
        daybreakTitle: "Свет, который",
        daybreakTitleEm: "раскрывает",
        processTag: "Наш процесс",
        steps: [{ name: "Идея" }, { name: "Материалы" }, { name: "Пошив" }, { name: "Результат" }],
        contactLabel: "Мы на связи",
        contactTitle: "Давай",
        contactTitleEm: "поговорим",
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

// AVIF→WebP→LQIP picture (cover) — used in the grid where the cell aspect
// already matches the 4:5 portraits, so there's no crop.
function Pic({
    src,
    alt = "MIND BODY",
    className,
    sizes = "100vw",
    eager = false,
}: {
    src: string;
    alt?: string;
    className?: string;
    sizes?: string;
    eager?: boolean;
}) {
    return (
        <picture>
            <source srcSet={buildAvifSrcset(src)} sizes={sizes} type="image/avif" />
            <source srcSet={buildWebpSrcset(src)} sizes={sizes} type="image/webp" />
            <img
                src={src}
                alt={alt}
                className={className}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                style={getLqipStyle(src)}
            />
        </picture>
    );
}

// Full-bleed "frame": the 4:5 portrait shows CONTAINED + sharp over a soft
// blurred wash (free, from the LQIP) that fills the wide viewport — so the
// full subject (face, greenery) is always visible and nothing crops to an
// empty backdrop. The premium standard for portrait media in a landscape frame.
function Frame({
    src,
    sizes = "100vw",
    eager = false,
    wrap = "",
}: {
    src: string;
    sizes?: string;
    eager?: boolean;
    wrap?: string;
}) {
    const lqip = getLqip(src);
    return (
        <div className={`sol-media ${wrap}`}>
            {lqip && (
                <div
                    className="sol-media__fill"
                    style={{ backgroundImage: `url("${lqip}")` }}
                    aria-hidden="true"
                />
            )}
            <picture className="sol-media__fg">
                <source srcSet={buildAvifSrcset(src)} sizes={sizes} type="image/avif" />
                <source srcSet={buildWebpSrcset(src)} sizes={sizes} type="image/webp" />
                <img
                    src={src}
                    alt="MIND BODY"
                    className="sol-ken"
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                />
            </picture>
        </div>
    );
}

// Same blurred-fill treatment for the brand films.
function VideoFrame({ src, poster }: { src: string; poster: string }) {
    const lqip = getLqip(poster);
    return (
        <div className="sol-media">
            {lqip && (
                <div
                    className="sol-media__fill"
                    style={{ backgroundImage: `url("${lqip}")` }}
                    aria-hidden="true"
                />
            )}
            <video
                className="sol-media__fg sol-video"
                poster={poster}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
            >
                <source src={src} type="video/mp4" />
            </video>
        </div>
    );
}

export default function About() {
    const { slides } = useLoaderData<typeof loader>();
    const { locale } = useI18n();
    const c = CONTENT[locale];

    // One native-scroll engine drives the whole "light study":
    //  • a page-level --lum (0→1) climbs dark→cream with a SHAPED curve
    //    (dip darker just before the daybreak, then bloom),
    //  • each [data-act] gets a 0→1 --p across its pinned range (Ken-Burns +
    //    the daybreak clip-reveal),
    //  • [data-reveal] elements reveal once on entry,
    //  • every <video> pauses while offscreen.
    // Reduced-motion / no-JS → everything visible, --lum rests warm, no scrub.
    useEffect(() => {
        const root = document.querySelector<HTMLElement>(".sol");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
        const videos = Array.from(document.querySelectorAll<HTMLVideoElement>(".sol video"));

        // Offscreen-pause videos (runs in every mode).
        let vio: IntersectionObserver | null = null;
        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(
                (entries) => {
                    for (const e of entries) {
                        const v = e.target as HTMLVideoElement;
                        if (e.isIntersecting) v.play().catch(() => {});
                        else v.pause();
                    }
                },
                { threshold: 0.15 },
            );
            videos.forEach((v) => observer.observe(v));
            vio = observer;
        } else {
            videos.forEach((v) => v.play().catch(() => {}));
        }

        if (reduce || !("IntersectionObserver" in window)) {
            reveals.forEach((el) => el.classList.add("in"));
            root?.style.setProperty("--lum", "0.62");
            return () => vio?.disconnect();
        }

        root?.classList.add("sol--anim");
        root?.style.setProperty("--lum", "0");

        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("in");
                        io.unobserve(e.target);
                    }
                }
            },
            { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
        );
        reveals.forEach((el) => io.observe(el));

        const acts = Array.from(document.querySelectorAll<HTMLElement>("[data-act]"));
        let ticking = false;
        const apply = () => {
            ticking = false;
            const vh = window.innerHeight;
            const y = window.scrollY;
            const prog = Math.min(1, Math.max(0, y / Math.max(document.body.scrollHeight - vh, 1)));
            // Shaped exposure: rise → dip before daybreak → bloom to full light.
            let lum;
            if (prog < 0.34) lum = (prog / 0.34) * 0.4;
            else if (prog < 0.5) lum = 0.4 - ((prog - 0.34) / 0.16) * 0.24;
            else if (prog < 0.78) lum = 0.16 + ((prog - 0.5) / 0.28) * 0.84;
            else lum = 1;
            root?.style.setProperty("--lum", lum.toFixed(3));
            for (const act of acts) {
                const p = Math.min(
                    1,
                    Math.max(0, (y - act.offsetTop) / Math.max(act.offsetHeight - vh, 1)),
                );
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
            vio?.disconnect();
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [locale]);

    const lookbook = slides
        .flatMap((s) => [s.image1, s.image2, s.image3])
        .filter((src): src is string => Boolean(src))
        .slice(0, 6);

    return (
        <main className="sol">
            <h1 className="visually-hidden">{c.h1}</h1>
            {/* Global exposure backdrop: dark→cream driven by --lum */}
            <div className="sol-sky" aria-hidden="true" />
            <div className="sol-grain" aria-hidden="true" />

            {/* ACT 0 — aperture opens over the brand film */}
            <section className="sol-act sol-act--hero" data-act>
                <div className="sol-stage">
                    <VideoFrame src={HERO_VIDEO} poster={HERO_POSTER} />
                    <div className="sol-veil sol-veil--hero" />
                    <div className="sol-aperture" aria-hidden="true" />
                    <div className="sol-hero__copy">
                        <span className="sol-eyebrow" data-reveal>
                            {c.studyEyebrow}
                        </span>
                        <picture>
                            <source srcSet="/pics/mind_body_logo_white.webp" type="image/webp" />
                            <img
                                src="/pics/mind_body_logo_white.webp"
                                alt="MIND BODY"
                                className="sol-hero__logo"
                            />
                        </picture>
                    </div>
                    <div className="sol-scroll" aria-hidden="true">
                        <span className="sol-scroll__line" />
                    </div>
                </div>
            </section>

            {/* ACT 1 — the statement */}
            <section className="sol-act sol-act--statement" data-act>
                <div className="sol-stage">
                    <Frame src={STATEMENT_STILL} />
                    <div className="sol-veil sol-veil--left" />
                    <div className="sol-copy sol-copy--left">
                        <p className="sol-statement" data-reveal>
                            <span className="sol-statement__line">{c.heroSubtitle}</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* ACT 2 — two held beats: stillness / motion */}
            <section className="sol-act sol-act--beat" data-act>
                <div className="sol-stage">
                    <Frame src={STUDIO_STILLNESS} />
                    <span className="sol-tag sol-tag--tr" data-reveal>
                        {c.stillnessTag}
                    </span>
                </div>
            </section>
            <section className="sol-act sol-act--beat" data-act>
                <div className="sol-stage">
                    <Frame src={STUDIO_MOTION} />
                    <span className="sol-tag sol-tag--bl" data-reveal>
                        {c.motionTag}
                    </span>
                </div>
            </section>

            {/* ACT 3 — DAYBREAK: studio shadow wipes to reveal terrace light */}
            <section className="sol-act sol-act--daybreak" data-act>
                <div className="sol-stage">
                    <Frame src={DAYBREAK_LIGHT} wrap="sol-daybreak__back" />
                    <Frame src={DAYBREAK_SHADOW} wrap="sol-daybreak__front" />
                    <div className="sol-veil sol-veil--center" />
                    <div className="sol-copy sol-copy--center">
                        <h2 className="sol-daybreak__title" data-reveal>
                            {c.daybreakTitle} <em>{c.daybreakTitleEm}</em>
                        </h2>
                    </div>
                </div>
            </section>

            {/* ACT 4 — the terrace: daylight lookbook grid (craft as captions) */}
            <section className="sol-act sol-act--terrace">
                <header className="sol-terrace__head" data-reveal>
                    <span className="sol-eyebrow sol-eyebrow--dark">{c.processTag}</span>
                </header>
                <div className="sol-grid">
                    {TERRACE.map((src, i) => (
                        <figure
                            className={`sol-cell sol-cell--${i}`}
                            data-reveal
                            style={{ transitionDelay: `${(i % 3) * 0.08}s` }}
                            key={src}
                        >
                            <Pic src={src} sizes="(max-width: 760px) 50vw, 33vw" />
                            {i < PROCESS_STEPS.length && (
                                <figcaption className="sol-cell__cap">
                                    <span className="sol-cell__num">{PROCESS_STEPS[i].number}</span>
                                    <span className="sol-cell__name">{c.steps[i].name}</span>
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            </section>

            {/* Owner-curated About slides (admin-editable; hidden when none) */}
            {lookbook.length > 0 && (
                <EditorAffordance
                    label="Редагувати слайди"
                    message={{ type: "OPEN_ABOUT_SLIDES_EDITOR" }}
                >
                    <section className="sol-act sol-act--terrace">
                        <div className="sol-grid">
                            {lookbook.map((src, i) => (
                                <figure className="sol-cell" data-reveal key={src + i}>
                                    <Pic src={src} sizes="(max-width: 760px) 50vw, 33vw" />
                                </figure>
                            ))}
                        </div>
                    </section>
                </EditorAffordance>
            )}

            {/* ACT 5 — contact, cream resolution (keeps #contact-premium) */}
            <section id="contact-premium" className="sol-act sol-act--contact" data-act>
                <div className="sol-stage">
                    <Frame src={CONTACT_BG} />
                    <div className="sol-veil sol-veil--cream" />
                    <div className="sol-copy sol-contact">
                        <span className="sol-eyebrow sol-eyebrow--dark" data-reveal>
                            {c.contactLabel}
                        </span>
                        <h2 className="sol-contact__title" data-reveal>
                            {c.contactTitle} <em>{c.contactTitleEm}</em>
                        </h2>
                        <div className="sol-contact__phones" data-reveal>
                            {PHONES.map((phone, i) => (
                                <a href={`tel:${phone.tel}`} className="sol-phone" key={phone.tel}>
                                    <span className="sol-phone__num">{phone.display}</span>
                                    <span className="sol-phone__hint">{c.phoneHints[i]}</span>
                                </a>
                            ))}
                        </div>
                        <div className="sol-contact__cta" data-reveal>
                            <a
                                href="https://www.instagram.com/mind_body_sportwear/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sol-btn sol-btn--solid"
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
                            <LLink to="/shop/yoga" className="sol-btn sol-btn--ghost">
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
