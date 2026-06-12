import type { Route } from "./+types/home";
import { useLoaderData } from "react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import HeroSlider, { type SlideData } from "../components/HeroSlider";
import CategoryCard from "../components/CategoryCard";
import { EditorAffordance } from "../components/EditorAffordance";
import { useSiteSettings, formatStatDisplay, type SiteSettings } from "../utils/site-settings";
import ProductCard from "../components/ProductCard";
import BrandStories from "../components/BrandStories";
import { prisma } from "../db.server";
import { cachedFetch } from "../utils/cache.server";
import { buildWebpSrcset, buildAvifSrcset } from "../utils/responsive-image";
import "../styles/home.css";
import { DEFAULT_SITE_URL } from "../utils/site-url";
import { useI18n, getT, LLink } from "../i18n";
import { localeFromParam, localeFromParamSafe, OG_LOCALE, localizePath } from "../i18n/config";
import { localizeEntities } from "../utils/translations.server";

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
    slug?: string | null;
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

export function meta({ data, params }: Route.MetaArgs) {
    const siteUrl = data?.siteUrl || DEFAULT_SITE_URL;
    const locale = localeFromParamSafe(params.lang);
    const t = getT(locale);
    const homePath = localizePath("/", locale);
    const canonicalUrl = homePath === "/" ? siteUrl : `${siteUrl}${homePath}`;

    // AVIF preloads for the REAL first slide (loader data, not the code
    // defaults). The <picture> in HeroSlider lists AVIF first, so AVIF is
    // what the browser will actually request — preloading WebP was a
    // guaranteed cache miss. `type` lets non-AVIF browsers skip the hint.
    const firstSlide = data?.slides?.[0];
    const heroImgs = firstSlide
        ? [firstSlide.image1, firstSlide.image2, firstSlide.image3].filter(
              (x): x is string => typeof x === "string" && x.length > 0,
          )
        : [];
    const sizesAttr = heroImgs.length > 1 ? "(max-width: 768px) 100vw, 33vw" : "100vw";
    const heroPreloads = heroImgs.map((img, i) => ({
        tagName: "link" as const,
        rel: "preload" as const,
        as: "image" as const,
        type: "image/avif",
        href: img.replace(/\.(jpe?g|png|webp)$/i, ".avif"),
        imageSrcSet: buildAvifSrcset(img),
        imageSizes: sizesAttr,
        ...(i === 0 ? { fetchPriority: "high" as const } : {}),
    }));

    return [
        { title: t("MIND BODY — Спортивний одяг для йоги та активного життя") },
        {
            name: "description",
            content: t(
                "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика. Безкоштовна доставка від 2000₴.",
            ),
        },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: t("MIND BODY — Спортивний одяг") },
        {
            property: "og:description",
            content: t(
                "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика.",
            ),
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
        { property: "og:locale", content: OG_LOCALE[locale] },
        { property: "og:site_name", content: "MIND BODY" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: t("MIND BODY — Спортивний одяг") },
        {
            name: "twitter:description",
            content: t("Український бренд спортивного одягу для жінок та дітей."),
        },
        { name: "twitter:image", content: `${siteUrl}/brand-sun.png` },
        // The white brand logo OVERLAYS the hero and is the page's measured
        // LCP element. It goes FIRST among image preloads: on HTTP/1.1 the
        // browser queues same-host requests, and a tiny logo stuck behind a
        // multi-hundred-KB slide is exactly the 500 ms+ queue delay the
        // trace measured. (Prod h2/h3 multiplexes anyway — order is then
        // just a priority hint.)
        {
            tagName: "link",
            rel: "preload",
            as: "image",
            href: "/pics/mind_body_logo_white.webp",
            fetchPriority: "high",
        },
        // Hero preload — the perf trace caught TWO bugs in the old version:
        // (1) it preloaded the hardcoded DEFAULT slides while the live hero
        // comes from the DB (admin-managed /uploads/…), so on a real deploy
        // the preloads fetched images the page never used — pure wasted
        // bandwidth on the critical path; (2) it preloaded WebP while the
        // <picture> lists AVIF first, so even a correct URL would be a cache
        // miss (double download). Now: dynamic from the loader's actual
        // first slide, in AVIF with type so unsupporting browsers skip it.
        ...heroPreloads,
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "MIND BODY",
                url: siteUrl,
                logo: `${siteUrl}/brand-sun.png`,
                description: t(
                    "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика.",
                ),
                inLanguage: locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "uk-UA",
                address: { "@type": "PostalAddress", addressCountry: "UA" },
                // Verified brand handle (underscore) — the third distinct IG
                // handle the identity audit found on the site; one truth now.
                sameAs: ["https://www.instagram.com/mindbody_sportwear"],
            },
        },
    ];
}

export function headers() {
    return {
        // HTML must NOT be cached across deploys: each deploy deletes the old
        // hashed JS chunks, so a stale cached document would reference a 404'd
        // chunk and fail to hydrate (loading screen sticks). Revalidate every
        // time so the browser always gets the current chunk references. (Loader
        // data is still cached server-side via cachedFetch, so this is cheap.)
        "Cache-Control": "no-cache",
    };
}

export async function loader({ request, params }: Route.LoaderArgs) {
    // ":lang?" makes home a catch-all for unknown single-segment URLs
    // ("/garbage") — reject anything that isn't a real locale with a 404.
    const locale = localeFromParam(params.lang);
    try {
        // Cache TTL: 60 seconds — slides/categories rarely change
        const CACHE_TTL = 60_000;

        // All 3 queries run in parallel with 60s in-memory cache
        const [slides, categoriesFromDb, rawProducts] = await Promise.all([
            // Slide.page is NOT NULL (default 'home'), so a typed read is safe.
            cachedFetch("home:slides", CACHE_TTL, () =>
                prisma.slide.findMany({
                    where: { page: "home" },
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        link: true,
                        image1: true,
                        image2: true,
                        image3: true,
                        image1Pos: true,
                        image2Pos: true,
                        image3Pos: true,
                    },
                }),
            ),
            cachedFetch("home:categories", CACHE_TTL, () =>
                prisma.category.findMany({
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        title: true,
                        subtitle: true,
                        image: true,
                        imagePos: true,
                        link: true,
                        buttonText: true,
                        moodType: true,
                    },
                }),
            ),
            cachedFetch("home:products", CACHE_TTL, () =>
                prisma.product.findMany({
                    where: { status: "active" },
                    orderBy: { createdAt: "desc" },
                    take: 12,
                    select: {
                        id: true,
                        slug: true,
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
                slug: p.slug ?? undefined,
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
            // Carry the admin's face-safe crop positions — without these the
            // hero falls back to center-crop and slices through portrait photos.
            image1Pos: s.image1Pos,
            image2Pos: s.image2Pos,
            image3Pos: s.image3Pos,
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

        // en/ru: translated DB content (fresh objects — cached arrays stay uk).
        const [categories, newProducts] = await Promise.all([
            localizeEntities(
                "Category",
                categoriesFromDb.length > 0 ? categoriesFromDb : FALLBACK_CATEGORIES,
                locale,
                ["title", "subtitle", "buttonText"],
            ),
            localizeEntities("Product", rawProducts.map(mapProduct), locale, ["name"]),
        ]);

        return {
            slides: slidesPayload,
            categories,
            newProducts,
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

// Premium-features-bar icons — fixed in code, matched to the editable
// homeFeatures.items by index (the texts are owner-editable, the iconography
// is a brand-design decision that stays a deploy).
const FEATURE_ICONS = [
    <svg
        key="0"
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
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"
        />
    </svg>,
    <svg
        key="1"
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
        />
    </svg>,
    <svg
        key="2"
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
    </svg>,
    <svg
        key="3"
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
        />
        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>,
];

export default function Home() {
    const { slides, categories, newProducts, instagramData } = useLoaderData<typeof loader>();
    const { t, lp } = useI18n();
    // Owner-editable home content (admin → Редактор сайту → Налаштування).
    const { homeFeatures, homeStats, homeBrandWorld }: SiteSettings = useSiteSettings();
    const postsToRender = instagramData?.posts?.length
        ? instagramData.posts
        : FALLBACK_INSTAGRAM_POSTS;
    const igUsername = instagramData?.username || "mindbody_sportwear";
    const igProfilePic = instagramData?.profilePictureUrl || "/logo-sun.png";

    const [currentPlaylistIdx, setCurrentPlaylistIdx] = useState(0);
    // Ref mirror for the section IntersectionObserver (mounted once) — it
    // must read the CURRENT playlist position when the section re-enters
    // the viewport, not the index captured at mount.
    const currentPlaylistIdxRef = useRef(0);
    useEffect(() => {
        currentPlaylistIdxRef.current = currentPlaylistIdx;
    }, [currentPlaylistIdx]);

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

    // Batch 52: Auto-cycle removed — mobile is now minimalist (video +
    // 1 phrase + button), features hidden, so cycling activeFeature had
    // no visible effect and just churned re-renders.  Desktop drives
    // activeFeature via the IntersectionObserver above.
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

    // Mobile: <BrandStories> replaces the legacy .bw-v3-frame-container
    // video (CSS display:none'd below 768px).  But display:none does NOT
    // pause a <video> — it keeps decoding in the background.  Pause &
    // de-autoplay the legacy clips on phones so only the stories player
    // runs.  Desktop is untouched.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(max-width: 768px)");
        const apply = () => {
            if (!mq.matches) return;
            document
                .querySelectorAll<HTMLVideoElement>(".bw-v3-frame-container video")
                .forEach((v) => {
                    try {
                        v.pause();
                        v.removeAttribute("autoplay");
                    } catch {
                        /* ignore */
                    }
                });
        };
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    // Desktop content-jank guard: a <video> keeps its decoder hot for as
    // long as it plays, regardless of visibility — and this section sits
    // several screens below the fold. Pause EVERY brand video while the
    // section is offscreen; when it scrolls back in, resume only the
    // playlist's current clip (the hover clips restart from the hover
    // handlers). Cuts idle decode from up-to-5 parallel streams to 0/1.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const frame = document.querySelector(".bw-v3-frame");
        if (!frame) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                const vids = frame.querySelectorAll<HTMLVideoElement>("video");
                if (!entry.isIntersecting) {
                    vids.forEach((v) => v.pause());
                } else {
                    const current =
                        frame.querySelectorAll<HTMLVideoElement>(".bw-playlist-vid")[
                            currentPlaylistIdxRef.current
                        ];
                    current?.play().catch(() => {});
                }
            },
            { threshold: 0.15 },
        );
        io.observe(frame);
        return () => io.disconnect();
    }, []);

    // Hover-video playback control (paired with the CSS :hover visibility
    // rules): play clip N while feature N is hovered, pause on leave.
    const hoverVid = (n: number, play: boolean) => {
        const v = document.querySelector<HTMLVideoElement>(`.bw-frame-hover-vid--${n}`);
        if (!v) return;
        if (play) {
            v.play().catch(() => {});
        } else {
            v.pause();
        }
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
                {t(
                    "MIND BODY — преміум жіночий спортивний одяг для йоги, гімнастики та активного життя",
                )}
            </h1>
            {/* Inside the visual editor's iframe this section grows a
                click-to-edit affordance; for real visitors it renders the
                slider unchanged (EditorAffordance is a no-op outside the
                editor — see app/utils/editor-bridge.ts). */}
            <EditorAffordance
                label="Редагувати слайди"
                message={{ type: "OPEN_HOME_SLIDES_EDITOR" }}
            >
                <HeroSlider slides={slides} />
            </EditorAffordance>
            {/* Premium Features Bar — texts owner-editable (home_features);
                the 4 icons are fixed in code, matched to items by index. */}
            <EditorAffordance
                label="Редагувати переваги"
                message={{ type: "OPEN_SETTINGS_SECTION", section: "features" }}
            >
                <section className="premium-features-bar" aria-labelledby="features-heading">
                    <h2 id="features-heading" className="visually-hidden">
                        {t("Переваги бренду")}
                    </h2>
                    <div className="container" style={{ maxWidth: "1440px" }}>
                        <div className="features-bar__grid">
                            {homeFeatures.items.map((item, i) => (
                                <div className="feature-item group" key={i}>
                                    <div className="feature-item__icon-wrapper">
                                        {FEATURE_ICONS[i]}
                                    </div>
                                    <div className="feature-item__text">
                                        <h3 className="feature-item__title">{t(item.title)}</h3>
                                        <p className="feature-item__desc">{t(item.desc)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </EditorAffordance>

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

                        <h2 className="section__title collections-title">
                            {t("Обирайте свій стиль")}
                        </h2>

                        <p className="section__subtitle collections-subtitle">
                            {t("Втілення ідеального балансу між")} <br />{" "}
                            {t("функціональністю та бездоганною естетикою")}
                        </p>
                    </div>
                    <EditorAffordance
                        label="Редагувати категорії"
                        message={{ type: "OPEN_HOME_CATEGORIES_EDITOR" }}
                    >
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
                    </EditorAffordance>
                </div>

                {/* Sub-section: New Arrivals */}
                <div className="container" id="new-collections">
                    <div className="new-arrivals-header">
                        <div className="new-arrivals-header__text">
                            <span className="new-arrivals-badge">
                                <span className="new-arrivals-badge__dot" />
                                {t("Новинки")}{" "}
                                <span suppressHydrationWarning>{new Date().getFullYear()}</span>
                            </span>
                            <h2 className="section__title">{t("Нові надходження")}</h2>
                            <p className="section__subtitle">
                                {t("Сезонні новинки з усіх колекцій")}
                            </p>
                        </div>
                        <div className="new-arrivals-header__controls">
                            <button
                                className="carousel-btn carousel-btn--prev"
                                aria-label={t("Попередні товари")}
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
                                aria-label={t("Наступні товари")}
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
                        aria-label={t("Новинка {n} з {total}", {
                            n: activeArrival + 1,
                            total: newProducts.length,
                        })}
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
                        <LLink to="/shop/yoga" className="btn btn--outline">
                            {t("Переглянути всі новинки")} →
                        </LLink>
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
                                            {t("Рух що")} <em>{t("перетворює")}</em>
                                        </h2>
                                    </div>
                                    <div className="bw-manifesto-body">
                                        <p className="bw-body-minimal">
                                            {t(
                                                "Ми не просто шиємо одяг — ми створюємо другу шкіру, що слідує за кожним рухом. Кожна колекція народжується з глибокою увагою до деталей та любов'ю до тіла.",
                                            )}
                                        </p>
                                        <div className="bw-mission-elegant">
                                            {t("Подаруй собі")} <em>{t("комфорт")}</em>{" "}
                                            {t("— і ти подаруєш собі крила")}
                                        </div>
                                        <LLink to="/about" className="bw-btn-elegant">
                                            {t("Філософія бренду")}
                                            <span className="bw-btn-arr">→</span>
                                        </LLink>
                                    </div>
                                </div>
                            </div>

                            {/* Batch 53: Interactive mobile "stories" player.
                                Mobile-only (desktop display:none) — replaces the
                                passive auto-advancing video below.  Tap / hold /
                                swipe between the 3 brand films.  See
                                app/components/BrandStories.tsx. */}
                            <BrandStories videos={videoPlaylist} />

                            {/* Batch 51: Story-Strip chips above video frame.
                                Mobile-only — tap-to-jump between 4 features.
                                Each chip shows the active state via .is-active
                                class.  Desktop hides via @media. */}
                            <div
                                className="bw-v3-chips"
                                role="tablist"
                                aria-label={t("Переваги бренду")}
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
                                    {t("Рух що")} <em>{t("перетворює")}</em>
                                </div>
                                {/* Batch 46: pull-quote overlay over video bottom.
                                    Mobile-only — desktop hides via @media.  Mission
                                    text duplicates intentionally (also lives in
                                    body section); CSS hides the body copy on
                                    mobile so user sees the quote only here. */}
                                <div className="bw-v3-video-quote" aria-hidden="true">
                                    {t("Подаруй собі")} <em>{t("комфорт")}</em>{" "}
                                    {t("— і ти подаруєш собі крила")}
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

                                    {/* 2. Hover-target videos (4 static repeating clips overlaid
                                        on the playlist). Visibility is CSS-driven (the
                                        .bw-feat-item--N:hover rules), but the old autoPlay+loop
                                        kept all four decoding 24/7 even at opacity:0 / mobile
                                        display:none — the single biggest content-jank source on
                                        the page (5 simultaneous video decodes). They now start on
                                        the matching feature's hover (onMouseEnter below) and
                                        pause on leave; the section observer pauses everything
                                        offscreen. Visuals are identical — playback just begins
                                        when a human can actually see it. */}
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--1"
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-hero.mp4" type="video/mp4" />
                                    </video>
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--2"
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-video-2.mp4" type="video/mp4" />
                                    </video>
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--3"
                                        loop
                                        muted
                                        playsInline
                                        preload="metadata"
                                    >
                                        <source src="/uploads/brand-video-3.mp4" type="video/mp4" />
                                    </video>
                                    <video
                                        className="bw-frame-img bw-frame-hover-vid bw-frame-hover-vid--4"
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
                            <EditorAffordance
                                label="Редагувати Brand World"
                                message={{
                                    type: "OPEN_SETTINGS_SECTION",
                                    section: "brandWorld",
                                }}
                            >
                                <div
                                    className="bw-v3-features bw-macro-features"
                                    ref={bwFeaturesRef}
                                >
                                    {homeBrandWorld.items.map((feat, i) => {
                                        const num = String(i + 1).padStart(2, "0");
                                        return (
                                            <div
                                                id={`bw-feat-item--${i + 1}`}
                                                className={`bw-feat-item bw-feat-item--${i + 1}`}
                                                key={i}
                                                data-active={activeFeature === i ? "true" : "false"}
                                                role="tabpanel"
                                                aria-hidden={activeFeature !== i}
                                                // CSS already reveals hover-clip N on :hover;
                                                // these start/stop its DECODER to match (the
                                                // old always-on autoplay was the jank source).
                                                onMouseEnter={() => hoverVid(i + 1, true)}
                                                onMouseLeave={() => hoverVid(i + 1, false)}
                                            >
                                                <div className="bw-macro-number" data-text={num}>
                                                    {num}
                                                </div>
                                                <div className="bw-macro-content">
                                                    <h3 className="bw-feat-title">
                                                        {t(feat.title)}
                                                    </h3>
                                                    <p className="bw-feat-desc">{t(feat.desc)}</p>
                                                    {/* The catalog CTA lives on the last card. */}
                                                    {i === homeBrandWorld.items.length - 1 && (
                                                        <LLink
                                                            to="/shop/yoga"
                                                            className="bw-feat-link"
                                                        >
                                                            {t("Каталог")}{" "}
                                                            <span className="bw-feat-link-arr">
                                                                →
                                                            </span>
                                                        </LLink>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </EditorAffordance>

                            {/* Mobile dot navigation — desktop hides via CSS @media.
                                4 dots = 4 fixed feature cards. Active dot updates
                                live as user swipes. Tapping a dot smooth-scrolls
                                to that feature. role=tablist for AT semantics. */}
                            <div className="bw-feat-dots-wrap">
                                <div
                                    className="bw-feat-dots"
                                    role="tablist"
                                    aria-label={t("Перегляд переваг")}
                                >
                                    {[0, 1, 2, 3].map((i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            role="tab"
                                            className={`bw-feat-dot ${activeFeature === i ? "is-active" : ""}`}
                                            aria-selected={activeFeature === i}
                                            aria-label={t("Перевага {n} з {total}", {
                                                n: i + 1,
                                                total: 4,
                                            })}
                                            onClick={() => scrollFeatureToIndex(i)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ANIMATED COUNTERS — owner-editable (home_stats). The visible
                    stat-number is the SSR/no-JS value; animateCounter (above)
                    reads data-count/data-suffix and animates on scroll. */}
                <EditorAffordance
                    label="Редагувати статистику"
                    message={{ type: "OPEN_SETTINGS_SECTION", section: "stats" }}
                >
                    <section className="stats-section">
                        <div className="container">
                            <div className="stats-grid">
                                {homeStats.items.map((stat, i) => (
                                    <div
                                        className="stat-item"
                                        key={i}
                                        data-count={stat.count}
                                        data-suffix={stat.suffix}
                                    >
                                        <span className="stat-number">
                                            {formatStatDisplay(stat.count, stat.suffix)}
                                        </span>
                                        <span className="stat-label">{t(stat.label)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </EditorAffordance>

                {/* Instagram Premium Section (Merged visually into the About section logic) */}
                <div className="ig-hyper" id="instagram">
                    {/* Photo wall removed: was rendering 36 hidden <div> elements
                        with backgroundImage URLs (postsToRender × 6 × 2 sides).
                        Globally display:none in home.css since redesign — pure DOM
                        bloat. Removing saves ~3 KB HTML + skips inline-style parsing. */}

                    {/* The center content container */}
                    <div className="ig-hyper__content container">
                        <div className="ig-hyper__header">
                            <p className="ig-hyper__overline">{t("Наш Instagram")}</p>
                            <h2 className="ig-hyper__title">
                                <span className="ig-hyper__title-world">{t("Світ")}</span>
                                <em>Mind Body</em>
                            </h2>
                            <p className="ig-hyper__subtitle">
                                {t(
                                    "Більше, ніж просто одяг — це естетика, мотивація та щоденне натхнення.",
                                )}
                                <br />
                                {t("Будь в курсі нових колекцій першою.")}
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
                                                {/* Live clock in a decorative iOS-mockup status bar.
                                                   The SSR-rendered minute can differ from the
                                                   minute at client hydration, which produced an
                                                   intermittent React #418 (text hydration mismatch)
                                                   on the home route. suppressHydrationWarning is the
                                                   documented fix for intentionally dynamic timestamp
                                                   text: keep the live value, silence the expected diff. */}
                                                <div
                                                    className="ig-ui-time"
                                                    suppressHydrationWarning
                                                >
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
                                                            <span className="lbl">
                                                                {t("публікації")}
                                                            </span>
                                                        </div>
                                                        <div className="ig-ui-stat">
                                                            <span className="num">
                                                                {t("63,9 тис.")}
                                                            </span>
                                                            <span className="lbl">
                                                                {t("підписники")}
                                                            </span>
                                                        </div>
                                                        <div className="ig-ui-stat">
                                                            <span className="num">1257</span>
                                                            <span className="lbl">
                                                                {t("підписки")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bio Section */}
                                                <div className="ig-ui-bio">
                                                    <div className="ig-ui-name">
                                                        MIND BODY sport wear{" "}
                                                        <span style={{ fontWeight: 400 }}>
                                                            {t("одяг для йоги та фітнесу")}
                                                        </span>
                                                    </div>
                                                    <div className="ig-ui-text">
                                                        {t("Комбінезон твоєї мрії!✨")}
                                                        <br />
                                                        {t("Найбільший вибір,найкраща якість")}
                                                        <br />
                                                        {t("для маленьких 👸")}{" "}
                                                        <span className="ig-ui-mention">
                                                            @mindbody_kidswear
                                                        </span>
                                                        <br />
                                                        {t("casual одяг")}{" "}
                                                        <span className="ig-ui-mention">
                                                            @fluid_feel_free
                                                        </span>{" "}
                                                        &nbsp;
                                                        <span style={{ color: "#a8a8a8" }}>
                                                            {t("ще")}
                                                        </span>
                                                        <br />
                                                        <span style={{ fontWeight: 600 }}>
                                                            {t("Показати переклад")}
                                                        </span>
                                                    </div>
                                                    <a href={lp("/")} className="ig-ui-link">
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
                                                        {t("Ви підписані")}
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
                                                    <div className="ig-ui-btn">
                                                        {t("Повідомлення")}
                                                    </div>
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
                                                                <span>{t(name)}</span>
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
                            {t("Відкрити Instagram")}
                        </a>
                    </div>
                </div>
            </section>
        </main>
    );
}
