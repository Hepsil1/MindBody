import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import HeroSlider, { type SlideData } from "../components/HeroSlider";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";
import { prisma } from "../db.server";
import { cachedFetch } from "../utils/cache.server";
import { buildWebpSrcset } from "../utils/responsive-image";
import "../styles/home.css";

const DEFAULT_SITE_URL = "https://saleid.icu";

// One Instagram post tile rendered in the social proof section.
interface InstagramPost {
    id: string;
    mediaUrl: string;
    permalink: string;
}

interface InstagramData {
    username: string;
    followersCount: string;
    profilePictureUrl: string;
    posts: InstagramPost[];
}

// Home category card — covers DB rows and the hard-coded fallback alike.
interface HomeCategoryCard {
    id: string;
    title: string;
    subtitle: string | null;
    image: string;
    imagePos?: string;
    link: string;
    buttonText: string;
    // Batch 41: optional theme mood. Read from the new `moodType` column
    // on Category via raw SQL (the Prisma client wasn't regenerated to
    // avoid the PM2 DLL lock on Windows — DB column exists, types catch
    // up on the next clean deploy).
    moodType?: string | null;
}

// New-products card on the home page.
interface HomeProductCard {
    id: string;
    name: string;
    // Matches ProductCard's `string | undefined` API (null is not accepted).
    category: string | undefined;
    price: number;
    image: string;
    image2: string | null;
    is_new: boolean;
    is_sale: boolean;
    sale_price: number | undefined;
    discount_percent: number;
}

export function meta({ data }: Route.MetaArgs) {
    const siteUrl = data?.siteUrl || DEFAULT_SITE_URL;
    return [
        { title: "MIND BODY — Спортивний одяг для йоги та активного життя" },
        {
            name: "description",
            content:
                "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика. Безкоштовна доставка від 2000₴.",
        },
        { tagName: "link", rel: "canonical", href: siteUrl },
        { property: "og:url", content: siteUrl },
        { property: "og:title", content: "MIND BODY — Спортивний одяг" },
        {
            property: "og:description",
            content:
                "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика.",
        },
        { property: "og:type", content: "website" },
        { property: "og:image", content: `${siteUrl}/brand-sun.png` },
        // Declared dimensions of brand-sun.png. Telling Facebook/Twitter/
        // Telegram the size upfront means the first share renders a real
        // preview instead of a "fetching…" placeholder.
        // TODO: ship a proper 1200x630 landscape OG image — current asset
        // is square (504x503) and gets letterboxed in some clients.
        { property: "og:image:width", content: "504" },
        { property: "og:image:height", content: "503" },
        { property: "og:locale", content: "uk_UA" },
        { property: "og:site_name", content: "MIND BODY" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "MIND BODY — Спортивний одяг" },
        {
            name: "twitter:description",
            content: "Український бренд спортивного одягу для жінок та дітей.",
        },
        { name: "twitter:image", content: `${siteUrl}/brand-sun.png` },
        // Preload first hero slide triptych — critical for LCP.  Each
        // preload includes imagesrcset + imagesizes so the browser picks
        // the responsive variant matching the viewport instead of pre-
        // fetching the full master and then using src-fallback (which
        // defeats Atoms R+S srcset entirely).  Mobile gets ~400/800w
        // (~80-150KB each), desktop gets 1200w (~250KB).
        /* Hero triptych preload — must match buildWebpSrcset() output
           (400/800/1200/1600/2000w + master). Previously capped at
           1200w which meant retina desktop (1920×2 = 1266 phys px or
           4K 3840 phys px) preloaded the 1200w → cached → used even
           though the <picture> offered larger variants = soft slides.
           Now preload offers all variants so browser picks the right
           one at preload time and uses the same cached entry. */
        {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: "/generalpics/333_131123.webp",
            imagesrcset:
                "/generalpics/333_131123-400w.webp 400w, /generalpics/333_131123-800w.webp 800w, /generalpics/333_131123-1200w.webp 1200w, /generalpics/333_131123-1600w.webp 1600w, /generalpics/333_131123.webp 2400w",
            imagesizes: "(max-width: 768px) 100vw, 33vw",
            fetchPriority: "high",
        },
        {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: "/generalpics/374_131123.webp",
            imagesrcset:
                "/generalpics/374_131123-400w.webp 400w, /generalpics/374_131123-800w.webp 800w, /generalpics/374_131123-1200w.webp 1200w, /generalpics/374_131123-1600w.webp 1600w, /generalpics/374_131123.webp 2400w",
            imagesizes: "(max-width: 768px) 100vw, 33vw",
        },
        {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: "/generalpics/338_131123.webp",
            imagesrcset:
                "/generalpics/338_131123-400w.webp 400w, /generalpics/338_131123-800w.webp 800w, /generalpics/338_131123-1200w.webp 1200w, /generalpics/338_131123-1600w.webp 1600w, /generalpics/338_131123.webp 2400w",
            imagesizes: "(max-width: 768px) 100vw, 33vw",
        },
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "MIND BODY",
                url: siteUrl,
                logo: `${siteUrl}/brand-sun.png`,
                description:
                    "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика.",
                address: { "@type": "PostalAddress", addressCountry: "UA" },
                sameAs: ["https://www.instagram.com/mindbody_ua"],
            },
        },
    ];
}

export function headers() {
    return {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    };
}

export async function loader({ request }: Route.LoaderArgs) {
    try {
        // Cache TTL: 60 seconds — slides/categories rarely change
        const CACHE_TTL = 60_000;

        // All 3 queries run in parallel with 60s in-memory cache
        const [slides, categoriesFromDb, rawProducts] = await Promise.all([
            // Keep raw SQL here because legacy rows may still have a NULL page
            // column even though the Prisma schema marks it non-nullable.
            // The generic ensures the result is still typed.
            cachedFetch(
                "home:slides",
                CACHE_TTL,
                () =>
                    prisma.$queryRaw<
                        Array<{
                            id: string;
                            name: string;
                            type: string;
                            link: string | null;
                            image1: string;
                            image2: string | null;
                            image3: string | null;
                            image1Pos: string;
                            image2Pos: string;
                            image3Pos: string;
                        }>
                    >`SELECT id, name, type, link, image1, image2, image3, "image1Pos", "image2Pos", "image3Pos" FROM "Slide" WHERE page IS NULL OR page = 'home' ORDER BY "order" ASC`,
            ),
            cachedFetch(
                "home:categories",
                CACHE_TTL,
                () =>
                    /* Batch 41: switched to raw SQL so we can read the new
                   `moodType` column without forcing a `prisma generate`
                   on a Windows host where PM2 has the query engine DLL
                   locked.  Type-wise we cast through HomeCategoryCard
                   below — runtime shape matches. */
                    prisma.$queryRaw<
                        Array<{
                            id: string;
                            title: string;
                            subtitle: string | null;
                            image: string;
                            imagePos: string;
                            link: string;
                            buttonText: string;
                            moodType: string | null;
                        }>
                    >`SELECT id, title, subtitle, image, "imagePos", link, "buttonText", "moodType" FROM "Category" ORDER BY "order" ASC`,
            ),
            cachedFetch("home:products", CACHE_TTL, () =>
                prisma.product.findMany({
                    where: { status: "active" },
                    orderBy: { createdAt: "desc" },
                    take: 12,
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        comparePrice: true,
                        category: true,
                        images: true,
                        shopPageSlug: true,
                        createdAt: true,
                    },
                }),
            ),
        ]);

        const NOW = Date.now();
        const NEW_THRESHOLD_DAYS = 14;

        // Typed via the Prisma return shape inferred above.
        const mapProduct = (p: (typeof rawProducts)[number]): HomeProductCard => {
            let imgs: string[] = [];
            try {
                imgs = JSON.parse(p.images || "[]");
            } catch {
                // Malformed images JSON — fall back to the brand placeholder.
            }
            const price = Number(p.price);
            const comparePrice = Number(p.comparePrice) || 0;
            const isSale = comparePrice > price && price > 0;
            const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
            const isNew = NOW - createdAt < NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

            return {
                id: p.id,
                name: p.name,
                category: p.category ?? p.shopPageSlug ?? undefined,
                price: isSale ? comparePrice : price, // comparePrice is the "original" price
                image: imgs[0] || "/brand-sun.png",
                image2: imgs[1] || null,
                is_new: isNew,
                is_sale: isSale,
                sale_price: isSale ? price : undefined,
                discount_percent: isSale ? Math.round((1 - price / comparePrice) * 100) : 0,
            };
        };

        const slidesPayload: SlideData[] = slides.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type as "triptych" | "single",
            link: s.link,
            image1: s.image1,
            image2: s.image2,
            image3: s.image3,
        }));

        // Normalise into HomeCategoryCard[] so the render side doesn't have
        // to branch on a union — fallback array now has the same shape as DB rows.
        const FALLBACK_CATEGORIES: HomeCategoryCard[] = [
            {
                id: "1",
                title: "YOGA",
                subtitle: "Для гармонії тіла та духу",
                image: "/pics1cloths/IMG_6201.webp",
                link: "/shop/yoga",
                buttonText: "Переглянути",
                // Batch 41 pilot: Yoga is the first mood-tagged category.
                // The DB row (set via admin) overrides this; the fallback
                // value just lets local-dev / empty-DB render the pilot
                // visual immediately.
                moodType: "yoga",
            },
            {
                id: "2",
                title: "SPORT",
                subtitle: "Для активних тренувань",
                image: "/pics1cloths/IMG_6210.webp",
                link: "/shop/sport",
                buttonText: "Переглянути",
            },
            {
                id: "3",
                title: "DANCE",
                subtitle: "Свобода рухів",
                image: "/generalpics/595_131123.webp",
                link: "/shop/dance",
                buttonText: "Переглянути",
            },
            {
                id: "4",
                title: "CASUAL",
                subtitle: "Повсякденний комфорт",
                image: "/generalpics/348_131123.webp",
                link: "/shop/casual",
                buttonText: "Переглянути",
            },
            {
                id: "5",
                title: "KIDS",
                subtitle: "Для наймолодших",
                image: "/pics2cloths/IMG_5222.webp",
                link: "/shop/kids",
                buttonText: "Переглянути",
            },
            {
                id: "6",
                title: "YOGATOOLS",
                subtitle: "Аксесуари та інвентар",
                image: "/generalpics/374_131123.webp",
                link: "/shop/yogatools",
                buttonText: "Переглянути",
            },
        ];

        return {
            slides: slidesPayload,
            categories: categoriesFromDb.length > 0 ? categoriesFromDb : FALLBACK_CATEGORIES,
            newProducts: rawProducts.map(mapProduct),
            // Instagram preview tiles. The previous Behold CDN URLs
            // (behold.pictures/...) are dead — every tile rendered as a
            // broken-image icon. Use local product photography from
            // public/generalpics instead: zero external dependency, always
            // loads. permalink points at the real IG profile.
            instagramData: {
                username: "mindbody_sportwear",
                followersCount: "63.9K",
                profilePictureUrl: "/logo-sun.png",
                posts: [
                    {
                        id: "1",
                        mediaUrl: "/generalpics/333_131123.webp",
                        permalink: "https://www.instagram.com/mindbody_sportwear/",
                    },
                    {
                        id: "2",
                        mediaUrl: "/generalpics/347_131123.webp",
                        permalink: "https://www.instagram.com/mindbody_sportwear/",
                    },
                    {
                        id: "3",
                        mediaUrl: "/generalpics/374_131123.webp",
                        permalink: "https://www.instagram.com/mindbody_sportwear/",
                    },
                    {
                        id: "4",
                        mediaUrl: "/generalpics/595_131123.webp",
                        permalink: "https://www.instagram.com/mindbody_sportwear/",
                    },
                    {
                        id: "5",
                        mediaUrl: "/generalpics/588_131123.webp",
                        permalink: "https://www.instagram.com/mindbody_sportwear/",
                    },
                    {
                        id: "6",
                        mediaUrl: "/generalpics/602_131123.webp",
                        permalink: "https://www.instagram.com/mindbody_sportwear/",
                    },
                ],
            } satisfies InstagramData,
            siteUrl: process.env.SITE_URL || DEFAULT_SITE_URL,
        };
    } catch (error) {
        console.error("Failed to load home data:", error);
        return {
            slides: [] as SlideData[],
            categories: [] as HomeCategoryCard[],
            newProducts: [] as HomeProductCard[],
            instagramData: null as InstagramData | null,
        };
    }
}

const FALLBACK_INSTAGRAM_POSTS = [
    {
        id: "1",
        mediaUrl: "/generalpics/333_131123.webp",
        permalink: "https://www.instagram.com/mindbody_sportwear/",
    },
    {
        id: "2",
        mediaUrl: "/generalpics/347_131123.webp",
        permalink: "https://www.instagram.com/mindbody_sportwear/",
    },
    {
        id: "3",
        mediaUrl: "/generalpics/374_131123.jpg",
        permalink: "https://www.instagram.com/mindbody_sportwear/",
    },
    {
        id: "4",
        mediaUrl: "/generalpics/595_131123.jpg",
        permalink: "https://www.instagram.com/mindbody_sportwear/",
    },
];

export default function Home() {
    const { slides, categories, newProducts, instagramData } = useLoaderData<typeof loader>();
    const postsToRender = instagramData?.posts?.length
        ? instagramData.posts
        : FALLBACK_INSTAGRAM_POSTS;
    const igUsername = instagramData?.username || "mindbody_sportwear";
    const igProfilePic = instagramData?.profilePictureUrl || "/logo-sun.png";

    const [currentPlaylistIdx, setCurrentPlaylistIdx] = useState(0);

    /* NEW ARRIVALS INFINITE CAROUSEL */
    const carouselRef = useRef<HTMLDivElement>(null);
    const bwFeaturesRef = useRef<HTMLDivElement>(null);
    const [activeArrival, setActiveArrival] = useState(0);
    const [activeFeature, setActiveFeature] = useState(0);
    const CARD_WIDTH = 300; // approximate, updated on layout
    const VISIBLE = 4;

    const scrollCarousel = useCallback((dir: "prev" | "next") => {
        const el = carouselRef.current;
        if (!el) return;
        const cardEl = el.querySelector(".product-card") as HTMLElement;
        const cardW = cardEl ? cardEl.offsetWidth + 24 : CARD_WIDTH + 24; // 24 = gap
        el.scrollBy({
            left: dir === "next" ? cardW * VISIBLE : -cardW * VISIBLE,
            behavior: "smooth",
        });
    }, []);

    // Touch swipe support
    const touchStartX = useRef(0);
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) scrollCarousel(diff > 0 ? "next" : "prev");
    };

    // Mobile carousel scroll tracking — drives the progress bar (New Arrivals)
    // and the dot indicator (Brand World features). Uses one IntersectionObserver
    // per carousel root, finds the most-visible child, sets it as active. Skips
    // entirely on desktop where the original arrow controls drive the UX.
    useEffect(() => {
        if (typeof window === "undefined" || window.innerWidth > 768) return;
        const observers: IntersectionObserver[] = [];
        const observeChildren = (root: HTMLElement | null, setActive: (i: number) => void) => {
            if (!root) return;
            const cards = Array.from(root.children) as HTMLElement[];
            if (!cards.length) return;
            const io = new IntersectionObserver(
                (entries) => {
                    let best: IntersectionObserverEntry | null = null;
                    for (const e of entries) {
                        if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
                    }
                    if (best && best.isIntersecting && best.intersectionRatio > 0.55) {
                        const idx = cards.indexOf(best.target as HTMLElement);
                        if (idx !== -1) setActive(idx);
                    }
                },
                { root, threshold: [0.4, 0.6, 0.8, 1] },
            );
            cards.forEach((c) => io.observe(c));
            observers.push(io);
        };
        observeChildren(carouselRef.current, setActiveArrival);
        observeChildren(bwFeaturesRef.current, setActiveFeature);
        return () => observers.forEach((o) => o.disconnect());
    }, [newProducts.length]);

    // Tap-a-dot navigation for BW features carousel — smooth-scrolls the
    // tapped feature card into view. Native scroll-snap then locks it.
    const scrollFeatureToIndex = useCallback((i: number) => {
        const root = bwFeaturesRef.current;
        const child = root?.children[i] as HTMLElement | undefined;
        if (!child) return;
        child.scrollIntoView({ inline: "start", behavior: "smooth", block: "nearest" });
    }, []);

    // Batch 51: Auto-cycle activeFeature on mobile every 5s (Stories-style).
    // Resets when user manually changes feature (via chip tap) because
    // setInterval is dependency-keyed on activeFeature — any state change
    // tears down the old interval and starts a fresh 5s window.  Skips
    // desktop entirely (where the 4 features render as a full row).
    useEffect(() => {
        if (typeof window === "undefined" || window.innerWidth > 768) return;
        const id = setInterval(() => {
            setActiveFeature((prev) => (prev + 1) % 4);
        }, 5000);
        return () => clearInterval(id);
    }, [activeFeature]);
    const videoPlaylist = [
        "/uploads/brand-hero.mp4",
        "/uploads/brand-video-2.mp4",
        "/uploads/brand-video-3.mp4",
    ];

    /* ZENITH MAGNETIC LOGO LOGIC */
    const magneticRef = useRef<HTMLDivElement>(null);

    const handleMagneticMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!magneticRef.current) return;
        const { left, top, width, height } = magneticRef.current.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        // Calculate cursor distance from center
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;

        // Magnetic Pull (max distance tilt effect)
        const rotateX = -(deltaY / height) * 35; // 35 deg max tilt
        const rotateY = (deltaX / width) * 35;
        const translateX = deltaX * 0.25; // 25% pull ratio
        const translateY = deltaY * 0.25;

        magneticRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(${translateX}px, ${translateY}px, 0)`;
    };

    const handleMagneticLeave = () => {
        if (!magneticRef.current) return;
        // Spring back to rest state smoothly
        magneticRef.current.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) translate3d(0px, 0px, 0)`;
    };

    // Animated counters — trigger when section enters viewport
    useEffect(() => {
        const animateCounter = (el: HTMLElement) => {
            const target = parseInt(el.dataset.count || "0", 10);
            const suffix = el.dataset.suffix || "";
            const isLarge = target >= 1000;
            const duration = 1800;
            const start = performance.now();
            const numEl = el.querySelector(".stat-number") as HTMLElement;
            if (!numEl) return;

            const tick = (now: number) => {
                const elapsed = Math.min((now - start) / duration, 1);
                // ease-out cubic
                const eased = 1 - Math.pow(1 - elapsed, 3);
                const value = Math.round(eased * target);
                if (isLarge && target >= 10000) {
                    numEl.textContent = (value / 1000).toFixed(1) + "K" + suffix;
                } else {
                    numEl.textContent = value.toLocaleString("uk-UA") + suffix;
                }
                if (elapsed < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !entry.target.classList.contains("counted")) {
                        entry.target.classList.add("counted");
                        animateCounter(entry.target as HTMLElement);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.5 },
        );

        setTimeout(() => {
            document.querySelectorAll(".stat-item").forEach((el) => observer.observe(el));
        }, 100);

        return () => observer.disconnect();
    }, []);

    // Scroll reveal animation
    useEffect(() => {
        const observerOptions = {
            root: null,
            rootMargin: "0px 0px -100px 0px",
            threshold: 0.1,
        };

        const revealOnScroll = (entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                }
            });
        };

        const observer = new IntersectionObserver(revealOnScroll, observerOptions);

        setTimeout(() => {
            // General elements
            document.querySelectorAll(".section__header").forEach((el) => {
                el.classList.add("reveal-ready");
                observer.observe(el);
            });

            // Category cards with stagger
            document.querySelectorAll(".category-card-editorial").forEach((el, i) => {
                el.classList.add("reveal-ready");
                (el as HTMLElement).style.transitionDelay = `${i * 0.1}s`;
                observer.observe(el);
            });

            // Product cards with stagger
            document.querySelectorAll(".product-card").forEach((el, i) => {
                el.classList.add("reveal-ready");
                (el as HTMLElement).style.transitionDelay = `${(i % 4) * 0.12}s`;
                observer.observe(el);
            });

            // Brand World intro grid
            document.querySelectorAll(".bw-intro__grid").forEach((el) => {
                el.classList.add("reveal-ready");
                observer.observe(el);
            });

            // Brand World bento tiles with stagger
            document.querySelectorAll(".bw-tile").forEach((el, i) => {
                el.classList.add("reveal-ready");
                (el as HTMLElement).style.transitionDelay = `${i * 0.13}s`;
                observer.observe(el);
            });
        }, 100);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <main>
            {/* Accessible H1 — visually hidden because the hero wordmark
                is a logo image, not text. WCAG 1.3.1 / Lighthouse
                heading-order: every page needs a single H1. */}
            <h1 className="visually-hidden">
                MIND BODY — преміум жіночий спортивний одяг для йоги, гімнастики та активного життя
            </h1>
            <HeroSlider slides={slides} />
            {/* Premium Features Bar */}
            <section className="premium-features-bar" aria-labelledby="features-heading">
                <h2 id="features-heading" className="visually-hidden">
                    Переваги бренду
                </h2>
                <div className="container" style={{ maxWidth: "1440px" }}>
                    <div className="features-bar__grid">
                        <div className="feature-item group">
                            <div className="feature-item__icon-wrapper">
                                <svg
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                                    ></path>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"
                                    ></path>
                                </svg>
                            </div>
                            <div className="feature-item__text">
                                <h3 className="feature-item__title">Українське виробництво</h3>
                                <p className="feature-item__desc">
                                    100% контроль якості у своєму цеху
                                </p>
                            </div>
                        </div>

                        <div className="feature-item group">
                            <div className="feature-item__icon-wrapper">
                                <svg
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                                    ></path>
                                </svg>
                            </div>
                            <div className="feature-item__text">
                                <h3 className="feature-item__title">Premium Supplex</h3>
                                <p className="feature-item__desc">
                                    Технологічні тканини, що дихають
                                </p>
                            </div>
                        </div>

                        <div className="feature-item group">
                            <div className="feature-item__icon-wrapper">
                                <svg
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M10 16l-4-4m0 0l4-4m-4 4h14m-10 8a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"
                                    />
                                </svg>
                            </div>
                            <div className="feature-item__text">
                                <h3 className="feature-item__title">Повернення 14 днів</h3>
                                <p className="feature-item__desc">
                                    Обмін та повернення без проблем
                                </p>
                            </div>
                        </div>

                        <div className="feature-item group">
                            <div className="feature-item__icon-wrapper">
                                <svg
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                >
                                    <rect
                                        x="3"
                                        y="5"
                                        width="18"
                                        height="14"
                                        rx="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    ></rect>
                                    <line
                                        x1="3"
                                        y1="10"
                                        x2="21"
                                        y2="10"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    ></line>
                                </svg>
                            </div>
                            <div className="feature-item__text">
                                <h3 className="feature-item__title">Швидка оплата</h3>
                                <p className="feature-item__desc">
                                    Безпечно карткою або при отриманні
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Unified Collections Group (Categories + New Arrivals) */}
            <section className="section section--alt shop-collections-group">
                <div className="logo-pattern-bg"></div>
                {/* Sub-section: Categories */}
                <div className="container collections-container" id="shop">
                    <div className="section__header section__header--center collections-header">
                        <div className="collections-badge">
                            <div className="collections-badge__line"></div>
                            <span>Exclusive Collections</span>
                            <div className="collections-badge__line"></div>
                        </div>

                        <h2 className="section__title collections-title">Обирайте свій стиль</h2>

                        <p className="section__subtitle collections-subtitle">
                            Втілення ідеального балансу між <br /> функціональністю та бездоганною
                            естетикою
                        </p>
                    </div>
                    <div className="editorial-categories-grid">
                        {categories.map((cat) => (
                            <CategoryCard
                                key={cat.id}
                                title={cat.title}
                                subtitle={cat.subtitle ?? ""}
                                image={cat.image}
                                imagePos={cat.imagePos}
                                link={cat.link}
                                buttonText={cat.buttonText}
                                moodType={cat.moodType}
                            />
                        ))}
                    </div>
                </div>

                {/* Sub-section: New Arrivals */}
                <div className="container" id="new-collections">
                    <div className="new-arrivals-header">
                        <div className="new-arrivals-header__text">
                            <span className="new-arrivals-badge">
                                <span className="new-arrivals-badge__dot" />
                                Новинки {new Date().getFullYear()}
                            </span>
                            <h2 className="section__title">Нові надходження</h2>
                            <p className="section__subtitle">Сезонні новинки з усіх колекцій</p>
                        </div>
                        <div className="new-arrivals-header__controls">
                            <button
                                className="carousel-btn carousel-btn--prev"
                                aria-label="Попередні товари"
                                onClick={() => scrollCarousel("prev")}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                >
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                            <button
                                className="carousel-btn carousel-btn--next"
                                aria-label="Наступні товари"
                                onClick={() => scrollCarousel("next")}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                >
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div
                        className="products-carousel"
                        ref={carouselRef}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {newProducts.map((p, i) => (
                            <ProductCard key={p.id} product={p} priority={i < 4} />
                        ))}
                    </div>

                    {/* Mobile counter — "01 — 12" in Cormorant italic, large.
                        Editorial pacing cue: signals curation ("12 chosen
                        pieces") rather than inventory. Desktop hides via CSS
                        @media. aria-live announces position to AT. */}
                    <div
                        className="arrival-counter"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        aria-label={`Новинка ${activeArrival + 1} з ${newProducts.length}`}
                    >
                        <span className="arrival-counter__num">
                            {String(activeArrival + 1).padStart(2, "0")}
                        </span>
                        <span className="arrival-counter__sep" aria-hidden="true">
                            —
                        </span>
                        <span className="arrival-counter__total">
                            {String(newProducts.length).padStart(2, "0")}
                        </span>
                    </div>

                    <div className="section__cta-center">
                        <Link to="/shop" className="btn btn--outline">
                            Переглянути всі новинки →
                        </Link>
                    </div>
                </div>
                <section className="bw-unified-section bw-v3" id="about">
                    <div className="container">
                        <div className="bw-v3-layout">
                            {/* Left: The Manifesto & Zen Ripple Logo */}
                            <div className="bw-v3-manifesto">
                                <div
                                    className="bw-zen-visual bw-magnetic-wrapper"
                                    ref={magneticRef}
                                    onMouseMove={handleMagneticMove}
                                    onMouseLeave={handleMagneticLeave}
                                >
                                    <div className="bw-kinetic-ring">
                                        <svg viewBox="0 0 100 100" width="160" height="160">
                                            <defs>
                                                <path
                                                    id="circlePath"
                                                    d="M 50, 50 m -40, 0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0"
                                                />
                                            </defs>
                                            <text
                                                fill="currentColor"
                                                fontSize="10.5"
                                                fontWeight="700"
                                                letterSpacing="0.25em"
                                                style={{ textTransform: "uppercase" }}
                                            >
                                                <textPath href="#circlePath" startOffset="0%">
                                                    Mind Body • Ukrainian Brand • Premium Quality •
                                                </textPath>
                                            </text>
                                        </svg>
                                    </div>
                                    <img
                                        src="/brand-sun.webp"
                                        alt="MindBody Energy"
                                        className="bw-zen-logo"
                                    />
                                </div>

                                {/* Batch 43: split into head + body wrappers so on
                                    mobile the H2 can sit ABOVE the video while
                                    the paragraph + mission + CTA stack AFTER
                                    the video.  On desktop these wrappers are
                                    transparent divs — original visual unchanged. */}
                                <div className="bw-manifesto-text">
                                    <div className="bw-manifesto-head">
                                        <span className="bw-eyebrow-minimal">MIND BODY®</span>
                                        <h2 className="bw-heading-elegant">
                                            Рух що <em>перетворює</em>
                                        </h2>
                                    </div>
                                    <div className="bw-manifesto-body">
                                        <p className="bw-body-minimal">
                                            Ми не просто шиємо одяг — ми створюємо другу шкіру, що
                                            слідує за кожним рухом. Кожна колекція народжується з
                                            глибокою увагою до деталей та любов'ю до тіла.
                                        </p>
                                        <div className="bw-mission-elegant">
                                            Подаруй собі <em>комфорт</em> — і ти подаруєш собі крила
                                        </div>
                                        <Link to="/about" className="bw-btn-elegant">
                                            Філософія бренду
                                            <span className="bw-btn-arr">→</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Batch 51: Story-Strip chips above video frame.
                                Mobile-only — tap-to-jump between 4 features.
                                Each chip shows the active state via .is-active
                                class.  Desktop hides via @media. */}
                            <div
                                className="bw-v3-chips"
                                role="tablist"
                                aria-label="Переваги бренду"
                            >
                                {[0, 1, 2, 3].map((i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        role="tab"
                                        className={`bw-v3-chip ${activeFeature === i ? "is-active" : ""}`}
                                        aria-selected={activeFeature === i}
                                        aria-controls={`bw-feat-item--${i + 1}`}
                                        onClick={() => setActiveFeature(i)}
                                    >
                                        <span className="bw-v3-chip__num">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Center: The Floating Image Reveal Frame */}
                            <div className="bw-v3-frame-container">
                                <div className="bw-v3-frame-dots">
                                    {videoPlaylist.map((_, i) => (
                                        <span
                                            key={i}
                                            className={`bw-v3-dot ${currentPlaylistIdx === i ? "bw-v3-dot--active" : ""}`}
                                        />
                                    ))}
                                </div>
                                {/* Batch 49: title overlay on video TOP (mobile-only).
                                    "Рух що перетворює" appears as cinematic film-
                                    poster title at top of video.  Desktop hides
                                    this via @media (title lives in left column
                                    of bw-v3-manifesto on desktop). */}
                                <div className="bw-v3-video-title" aria-hidden="true">
                                    Рух що <em>перетворює</em>
                                </div>
                                {/* Batch 46: pull-quote overlay over video bottom.
                                    Mobile-only — desktop hides via @media.  Mission
                                    text duplicates intentionally (also lives in
                                    body section); CSS hides the body copy on
                                    mobile so user sees the quote only here. */}
                                <div className="bw-v3-video-quote" aria-hidden="true">
                                    Подаруй собі <em>комфорт</em> — і ти подаруєш собі крила
                                </div>
                                <div className="bw-v3-frame">
                                    {/* 1. Sequential continuous playlist (3 videos) with smooth crossfade */}
                                    {videoPlaylist.map((src, i) => (
                                        <video
                                            key={`p-${i}`}
                                            className={`bw-frame-img bw-playlist-vid ${currentPlaylistIdx === i ? "is-default-active" : ""}`}
                                            src={src}
                                            autoPlay={i === 0}
                                            loop={false}
                                            muted
                                            playsInline
                                            preload={i === 0 ? "auto" : "metadata"}
                                            onEnded={() => {
                                                const nextIdx = (i + 1) % videoPlaylist.length;
                                                setCurrentPlaylistIdx(nextIdx);
                                                const nextVid = document.querySelector(
                                                    `.bw-playlist-vid[src="${videoPlaylist[nextIdx]}"]`,
                                                ) as HTMLVideoElement;
                                                if (nextVid) {
                                                    nextVid.currentTime = 0;
                                                    nextVid.play();
                                                }
                                            }}
                                        />
                                    ))}

                                    {/* 2. Hover-target videos (4 static repeating clips overlaid on
                                        the playlist). All have muted+playsInline to satisfy iOS
                                        no-sound policy and stay inline. Mobile hides them entirely
                                        via @media display:none. preload="metadata" cuts initial
                                        fetch (only first frame + codec metadata) — full stream
                                        only fetches when autoPlay kicks in on desktop. */}
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--1"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-hero.mp4" type="video/mp4" />
                                    </video>
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--2"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-video-2.mp4" type="video/mp4" />
                                    </video>
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--3"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-video-3.mp4" type="video/mp4" />
                                    </video>
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-video-2.mp4" type="video/mp4" />
                                    </video>
                                </div>
                            </div>

                            {/* Right: The Ultra-Clean Feature List (Macro Typography)
                                Batch 51: data-active controls which feature is
                                shown on mobile (only one visible at a time, tied
                                to activeFeature state).  Desktop ignores
                                data-active and shows all four. */}
                            <div className="bw-v3-features bw-macro-features" ref={bwFeaturesRef}>
                                <div
                                    id="bw-feat-item--1"
                                    className="bw-feat-item bw-feat-item--1"
                                    data-active={activeFeature === 0 ? "true" : "false"}
                                    role="tabpanel"
                                    aria-hidden={activeFeature !== 0}
                                >
                                    <div className="bw-macro-number" data-text="01">
                                        01
                                    </div>
                                    <div className="bw-macro-content">
                                        <h3 className="bw-feat-title">Дихаючі тканини</h3>
                                        <p className="bw-feat-desc">
                                            Преміальні матеріали, що забезпечують ідеальну
                                            терморегуляцію.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    id="bw-feat-item--2"
                                    className="bw-feat-item bw-feat-item--2"
                                    data-active={activeFeature === 1 ? "true" : "false"}
                                    role="tabpanel"
                                    aria-hidden={activeFeature !== 1}
                                >
                                    <div className="bw-macro-number" data-text="02">
                                        02
                                    </div>
                                    <div className="bw-macro-content">
                                        <h3 className="bw-feat-title">Ексклюзивний дизайн</h3>
                                        <p className="bw-feat-desc">
                                            Естетика, що надихає навіть під час найважчих тренувань.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    id="bw-feat-item--3"
                                    className="bw-feat-item bw-feat-item--3"
                                    data-active={activeFeature === 2 ? "true" : "false"}
                                    role="tabpanel"
                                    aria-hidden={activeFeature !== 2}
                                >
                                    <div className="bw-macro-number" data-text="03">
                                        03
                                    </div>
                                    <div className="bw-macro-content">
                                        <h3 className="bw-feat-title">Ідеальна посадка</h3>
                                        <p className="bw-feat-desc">
                                            Анатомічний крій, що бездоганно підкреслює вашу фігуру.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    id="bw-feat-item--4"
                                    className="bw-feat-item bw-feat-item--4"
                                    data-active={activeFeature === 3 ? "true" : "false"}
                                    role="tabpanel"
                                    aria-hidden={activeFeature !== 3}
                                >
                                    <div className="bw-macro-number" data-text="04">
                                        04
                                    </div>
                                    <div className="bw-macro-content">
                                        <h3 className="bw-feat-title">Сертифікована якість</h3>
                                        <p className="bw-feat-desc">
                                            100% контроль, створено з любов'ю та увагою до кожної
                                            деталі.
                                        </p>
                                        <Link to="/shop" className="bw-feat-link">
                                            Каталог <span className="bw-feat-link-arr">→</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile dot navigation — desktop hides via CSS @media.
                                4 dots = 4 fixed feature cards. Active dot updates
                                live as user swipes. Tapping a dot smooth-scrolls
                                to that feature. role=tablist for AT semantics. */}
                            <div className="bw-feat-dots-wrap">
                                <div
                                    className="bw-feat-dots"
                                    role="tablist"
                                    aria-label="Перегляд переваг"
                                >
                                    {[0, 1, 2, 3].map((i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            role="tab"
                                            className={`bw-feat-dot ${activeFeature === i ? "is-active" : ""}`}
                                            aria-selected={activeFeature === i}
                                            aria-label={`Перевага ${i + 1} з 4`}
                                            onClick={() => scrollFeatureToIndex(i)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ANIMATED COUNTERS */}
                <section className="stats-section">
                    <div className="container">
                        <div className="stats-grid">
                            <div
                                className="stat-item"
                                data-count="63900"
                                data-suffix="+"
                                data-format="social"
                            >
                                <span className="stat-number">63.9K</span>
                                <span className="stat-label">Підписників в Instagram</span>
                            </div>
                            <div className="stat-item" data-count="2168" data-suffix="+">
                                <span className="stat-number">2168</span>
                                <span className="stat-label">Публікацій у соцмережах</span>
                            </div>
                            <div className="stat-item" data-count="10" data-suffix="+">
                                <span className="stat-number">10+</span>
                                <span className="stat-label">Років на ринку</span>
                            </div>
                            <div className="stat-item" data-count="5000" data-suffix="+">
                                <span className="stat-number">5000+</span>
                                <span className="stat-label">Задоволених клієнтів</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Instagram Premium Section (Merged visually into the About section logic) */}
                <div className="ig-hyper" id="instagram">
                    {/* Photo wall removed: was rendering 36 hidden <div> elements
                        with backgroundImage URLs (postsToRender × 6 × 2 sides).
                        Globally display:none in home.css since redesign — pure DOM
                        bloat. Removing saves ~3 KB HTML + skips inline-style parsing. */}

                    {/* The center content container */}
                    <div className="ig-hyper__content container">
                        <div className="ig-hyper__header">
                            <p className="ig-hyper__overline">Наш Instagram</p>
                            <h2 className="ig-hyper__title">
                                <span className="ig-hyper__title-world">Світ</span>
                                <em>Mind Body</em>
                            </h2>
                            <p className="ig-hyper__subtitle">
                                Більше, ніж просто одяг — це естетика, мотивація та щоденне
                                натхнення.
                                <br />
                                Будь в курсі нових колекцій першою.
                            </p>
                        </div>

                        <div className="ig-hyper__centerpiece">
                            {/* The majestic iPhone mockup */}
                            <div className="ig-premium__phone-wrap">
                                <div className="ig-premium__phone-glow" />
                                <div className="ig-premium__phone">
                                    {/* Realistic iPhone Hardware Buttons */}
                                    <div className="ig-premium__btn-action"></div>
                                    <div className="ig-premium__btn-vol-up"></div>
                                    <div className="ig-premium__btn-vol-down"></div>
                                    <div className="ig-premium__btn-power"></div>

                                    {/* Screen content */}
                                    <div className="ig-premium__screen">
                                        <div className="ig-ui-wrapper">
                                            {/* iOS Status Bar */}
                                            <div className="ig-ui-statusbar">
                                                <div className="ig-ui-time">
                                                    {new Date().toLocaleTimeString("uk-UA", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </div>
                                                <div className="ig-ui-island">
                                                    <div className="ig-ui-island-cam"></div>
                                                </div>
                                                <div className="ig-ui-status-icons">
                                                    <svg
                                                        width="18"
                                                        height="12"
                                                        viewBox="0 0 18 12"
                                                        fill="currentColor"
                                                    >
                                                        <rect
                                                            x="1"
                                                            y="8"
                                                            width="3"
                                                            height="4"
                                                            rx="1"
                                                        />
                                                        <rect
                                                            x="6"
                                                            y="5"
                                                            width="3"
                                                            height="7"
                                                            rx="1"
                                                        />
                                                        <rect
                                                            x="11"
                                                            y="2"
                                                            width="3"
                                                            height="10"
                                                            rx="1"
                                                        />
                                                        <rect
                                                            x="16"
                                                            y="0"
                                                            width="3"
                                                            height="12"
                                                            rx="1"
                                                            fillOpacity="0.3"
                                                        />
                                                    </svg>
                                                    <svg
                                                        width="16"
                                                        height="12"
                                                        viewBox="0 0 16 12"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M1 8.5C4.5 5.5 11.5 5.5 15 8.5" />
                                                        <path d="M4 11C6.5 9 9.5 9 12 11" />
                                                    </svg>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontSize: "13px",
                                                                fontWeight: 600,
                                                                letterSpacing: "-0.5px",
                                                            }}
                                                        >
                                                            28
                                                        </span>
                                                        <svg
                                                            width="24"
                                                            height="13"
                                                            viewBox="0 0 24 13"
                                                            fill="none"
                                                            stroke="currentColor"
                                                        >
                                                            <rect
                                                                x="1"
                                                                y="1"
                                                                width="20"
                                                                height="11"
                                                                rx="3"
                                                                strokeWidth="1"
                                                                fill="rgba(255,255,255,0.15)"
                                                                stroke="rgba(255,255,255,0.4)"
                                                            />
                                                            <rect
                                                                x="3"
                                                                y="3"
                                                                width="7"
                                                                height="7"
                                                                rx="1"
                                                                fill="currentColor"
                                                                stroke="none"
                                                            />
                                                            <path
                                                                d="M22 4.5v4"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                stroke="rgba(255,255,255,0.4)"
                                                            />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Top Navbar */}
                                            <div className="ig-ui-topbar">
                                                <div className="ig-ui-topleft">
                                                    <svg
                                                        width="24"
                                                        height="24"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <path d="M15 18l-6-6 6-6" />
                                                    </svg>
                                                    <span className="ig-ui-username">
                                                        {igUsername}
                                                    </span>
                                                </div>
                                                <div className="ig-ui-topright">
                                                    <svg
                                                        width="24"
                                                        height="24"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                                    </svg>
                                                    <svg
                                                        width="24"
                                                        height="24"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <circle cx="12" cy="12" r="1" />
                                                        <circle cx="19" cy="12" r="1" />
                                                        <circle cx="5" cy="12" r="1" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Scrollable Content */}
                                            <div className="ig-ui-content">
                                                {/* Header: Avatar & Stats */}
                                                <div className="ig-ui-header">
                                                    <div className="ig-ui-avatar-wrap">
                                                        <img
                                                            src={igProfilePic}
                                                            alt={igUsername}
                                                            className="ig-ui-avatar"
                                                        />
                                                    </div>
                                                    <div className="ig-ui-stats">
                                                        <div className="ig-ui-stat">
                                                            <span className="num">2168</span>
                                                            <span className="lbl">публікації</span>
                                                        </div>
                                                        <div className="ig-ui-stat">
                                                            <span className="num">63,9 тис.</span>
                                                            <span className="lbl">підписники</span>
                                                        </div>
                                                        <div className="ig-ui-stat">
                                                            <span className="num">1257</span>
                                                            <span className="lbl">підписки</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bio Section */}
                                                <div className="ig-ui-bio">
                                                    <div className="ig-ui-name">
                                                        MIND BODY sport wear{" "}
                                                        <span style={{ fontWeight: 400 }}>
                                                            одяг для йоги та фітнесу
                                                        </span>
                                                    </div>
                                                    <div className="ig-ui-text">
                                                        Комбінезон твоєї мрії!✨
                                                        <br />
                                                        Найбільший вибір,найкраща якість
                                                        <br />
                                                        для маленьких 👸{" "}
                                                        <span className="ig-ui-mention">
                                                            @mindbody_kidswear
                                                        </span>
                                                        <br />
                                                        casual одяг{" "}
                                                        <span className="ig-ui-mention">
                                                            @fluid_feel_free
                                                        </span>{" "}
                                                        &nbsp;
                                                        <span style={{ color: "#a8a8a8" }}>ще</span>
                                                        <br />
                                                        <span style={{ fontWeight: 600 }}>
                                                            Показати переклад
                                                        </span>
                                                    </div>
                                                    <a href="/" className="ig-ui-link">
                                                        <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            style={{
                                                                marginRight: "4px",
                                                                verticalAlign: "-2px",
                                                            }}
                                                        >
                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                        </svg>
                                                        t.me/mindbody_sportwear
                                                    </a>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="ig-ui-actions">
                                                    <div className="ig-ui-btn">
                                                        Ви підписані
                                                        <svg
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            style={{ marginLeft: "4px" }}
                                                        >
                                                            <path d="M6 9l6 6 6-6" />
                                                        </svg>
                                                    </div>
                                                    <div className="ig-ui-btn">Повідомлення</div>
                                                    <div className="ig-ui-btn icon">
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                        >
                                                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                            <circle cx="8.5" cy="7" r="4" />
                                                            <line x1="20" y1="8" x2="20" y2="14" />
                                                            <line x1="23" y1="11" x2="17" y2="11" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* Highlights */}
                                                <div className="ig-ui-highlights">
                                                    {[
                                                        "SALE",
                                                        "SALE FLUID",
                                                        "SALE SET",
                                                        "ВІДГУКИ 11",
                                                    ].map((name, idx) => {
                                                        const hlImg =
                                                            postsToRender[
                                                                idx % postsToRender.length
                                                            ]?.mediaUrl;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="ig-ui-highlight"
                                                            >
                                                                <div className="ig-ui-hl-ring">
                                                                    <div className="ig-ui-hl-img">
                                                                        {hlImg && (
                                                                            <picture>
                                                                                <source
                                                                                    srcSet={buildWebpSrcset(
                                                                                        hlImg,
                                                                                    )}
                                                                                    sizes="64px"
                                                                                    type="image/webp"
                                                                                />
                                                                                <img
                                                                                    src={hlImg}
                                                                                    alt=""
                                                                                    loading="lazy"
                                                                                    decoding="async"
                                                                                />
                                                                            </picture>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span>{name}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Tabs */}
                                                <div className="ig-ui-tabs">
                                                    <div className="ig-ui-tab active">
                                                        <svg
                                                            width="24"
                                                            height="24"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                        >
                                                            <rect
                                                                x="3"
                                                                y="3"
                                                                width="18"
                                                                height="18"
                                                                rx="2"
                                                                ry="2"
                                                            />
                                                            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                                                        </svg>
                                                    </div>
                                                    <div className="ig-ui-tab">
                                                        <svg
                                                            width="24"
                                                            height="24"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                        >
                                                            <rect
                                                                x="4"
                                                                y="2"
                                                                width="16"
                                                                height="20"
                                                                rx="2"
                                                                ry="2"
                                                            />
                                                            <path d="M4 6h16M4 18h16M8 2v4M16 2v4M12 18v4" />
                                                        </svg>
                                                    </div>
                                                    <div className="ig-ui-tab">
                                                        <svg
                                                            width="24"
                                                            height="24"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                        >
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* 3-Column Grid Feed */}
                                                <div className="ig-ui-feed">
                                                    {Array.from({ length: 9 }).map((_, i) => {
                                                        const post =
                                                            postsToRender[i % postsToRender.length];
                                                        return (
                                                            <a
                                                                key={`ig-${i}`}
                                                                href={post.permalink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="ig-ui-feed-post"
                                                            >
                                                                {/* Atom T (cont.): IG-mock grid was the
                                                                    biggest remaining master-fetch on
                                                                    home (slots are ~120px wide on
                                                                    mobile but loaded 2000w masters).
                                                                    Picture/source/srcset = -400w
                                                                    variant picked → ~30KB instead
                                                                    of 150KB per tile. */}
                                                                <picture>
                                                                    <source
                                                                        srcSet={buildWebpSrcset(
                                                                            post.mediaUrl,
                                                                        )}
                                                                        sizes="(max-width: 768px) 33vw, 120px"
                                                                        type="image/webp"
                                                                    />
                                                                    <img
                                                                        src={post.mediaUrl}
                                                                        alt={`Post ${i + 1}`}
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                    />
                                                                </picture>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Bottom Navbar */}
                                            <div className="ig-ui-navbar">
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                    <polyline points="9 22 9 12 15 12 15 22" />
                                                </svg>
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <circle cx="11" cy="11" r="8" />
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                </svg>
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <rect
                                                        x="3"
                                                        y="3"
                                                        width="18"
                                                        height="18"
                                                        rx="2"
                                                        ry="2"
                                                    />
                                                    <line x1="12" y1="8" x2="12" y2="16" />
                                                    <line x1="8" y1="12" x2="16" y2="12" />
                                                </svg>
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <rect
                                                        x="2"
                                                        y="2"
                                                        width="20"
                                                        height="20"
                                                        rx="4"
                                                        ry="4"
                                                    />
                                                    <path d="M10 8l6 4-6 4V8z" />
                                                </svg>
                                                <div className="ig-ui-nav-avatar">
                                                    <img src={igProfilePic} alt="Profile" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Minimal floating badge */}
                                <div className="ig-hyper__float">
                                    <div className="ig-hyper__live-dot" /> LIVE
                                </div>
                            </div>
                        </div>

                        <a
                            href="https://www.instagram.com/mindbody_sportwear/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ig-hyper__cta"
                        >
                            <svg
                                className="ig-hyper__cta-icon"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                            </svg>
                            Відкрити Instagram
                        </a>
                    </div>
                </div>
            </section>
        </main>
    );
}
