import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useEffect } from "react";
import HeroSlider, { type SlideData } from "../components/HeroSlider";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";
import { prisma } from "../db.server";
import { cachedFetch } from "../utils/cache.server";
import styles from "../styles/home.css?url";


const SITE_URL = "https://mindbody.com.ua";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "MIND BODY — Спортивний одяг для йоги та активного життя" },
    { name: "description", content: "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика. Безкоштовна доставка від 2000₴." },
    { tagName: "link", rel: "canonical", href: SITE_URL },
    { property: "og:url", content: SITE_URL },
    { property: "og:title", content: "MIND BODY — Спортивний одяг" },
    { property: "og:description", content: "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика." },
    { property: "og:type", content: "website" },
    { property: "og:image", content: `${SITE_URL}/brand-sun.png` },
    { property: "og:locale", content: "uk_UA" },
    { property: "og:site_name", content: "MIND BODY" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "MIND BODY — Спортивний одяг" },
    { name: "twitter:description", content: "Український бренд спортивного одягу для жінок та дітей." },
    { name: "twitter:image", content: `${SITE_URL}/brand-sun.png` },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "MIND BODY",
        "url": SITE_URL,
        "logo": `${SITE_URL}/brand-sun.png`,
        "description": "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика.",
        "address": { "@type": "PostalAddress", "addressCountry": "UA" },
        "sameAs": ["https://www.instagram.com/mindbody_ua"]
      }
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Cache TTL: 60 seconds — slides/categories rarely change
    const CACHE_TTL = 60_000;

    // All 3 queries run in parallel with 60s in-memory cache
    const [slides, categoriesFromDb, rawProducts] = await Promise.all([
      cachedFetch('home:slides', CACHE_TTL, () =>
        prisma.$queryRaw`SELECT id, name, type, link, image1, image2, image3, "image1Pos", "image2Pos", "image3Pos" FROM "Slide" WHERE page IS NULL OR page = 'home' ORDER BY "order" ASC` as Promise<any[]>
      ),
      cachedFetch('home:categories', CACHE_TTL, () =>
        prisma.$queryRawUnsafe(`SELECT id, title, subtitle, image, "imagePos", link, "buttonText" FROM "Category" ORDER BY "order" ASC`) as Promise<any[]>
      ),
      cachedFetch('home:products', CACHE_TTL, () =>
        prisma.$queryRawUnsafe(
          `SELECT id, name, price, "comparePrice", category, images, "shopPageSlug", "createdAt"
           FROM "Product"
           WHERE status = 'active'
           ORDER BY "createdAt" DESC LIMIT 8`
        ) as Promise<any[]>
      ),
    ]);

    const NOW = Date.now();
    const NEW_THRESHOLD_DAYS = 14;

    const mapProduct = (p: any) => {
      let imgs: string[] = [];
      try { imgs = JSON.parse(p.images || '[]'); } catch { }
      const price = Number(p.price);
      const comparePrice = Number(p.comparePrice) || 0;
      const isSale = comparePrice > price && price > 0;
      const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
      const isNew = (NOW - createdAt) < NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

      return {
        id: p.id,
        name: p.name,
        category: p.category || p.shopPageSlug,
        price: isSale ? comparePrice : price, // comparePrice is the "original" price
        image: imgs[0] || '/brand-sun.png',
        image2: imgs[1] || null,
        is_new: isNew,
        is_sale: isSale,
        sale_price: isSale ? price : undefined,
        discount_percent: isSale ? Math.round((1 - price / comparePrice) * 100) : 0,
      };
    };

    return {
      slides: slides.map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type as "triptych" | "single",
        link: s.link,
        image1: s.image1,
        image2: s.image2,
        image3: s.image3,
      })) as SlideData[],
      categories: categoriesFromDb.length > 0 ? categoriesFromDb : [
        { id: '1', title: 'YOGA', subtitle: 'Для гармонії тіла та духу', image: '/pics1cloths/IMG_6201.JPG', link: '/shop/yoga', buttonText: 'Переглянути' },
        { id: '2', title: 'SPORT', subtitle: 'Для активних тренувань', image: '/pics1cloths/IMG_6210.JPG', link: '/shop/sport', buttonText: 'Переглянути' },
        { id: '3', title: 'DANCE', subtitle: 'Свобода рухів', image: '/generalpics/595_131123.jpg', link: '/shop/dance', buttonText: 'Переглянути' },
        { id: '4', title: 'CASUAL', subtitle: 'Повсякденний комфорт', image: '/generalpics/348_131123.jpg', link: '/shop/casual', buttonText: 'Переглянути' },
        { id: '5', title: 'KIDS', subtitle: 'Для наймолодших', image: '/pics2cloths/IMG_5222.JPG', link: '/shop/kids', buttonText: 'Переглянути' },
        { id: '6', title: 'YOGATOOLS', subtitle: 'Аксесуари та інвентар', image: '/generalpics/374_131123.jpg', link: '/shop/yogatools', buttonText: 'Переглянути' },
      ],
      newProducts: rawProducts.map(mapProduct),
      instagramData: {
        username: "mindbody_sportwear",
        followersCount: "63.9K",
        profilePictureUrl: "https://cdn2.behold.pictures/su4XpNQnryeiB8O203eV2KgONDk2/17841401933988886/profile.webp",
        posts: [
          { id: "1", mediaUrl: "https://behold.pictures/su4XpNQnryeiB8O203eV2KgONDk2/gGjqxmmbHMaeKvF1NJYz/18013613314928265/medium.jpg", permalink: "https://www.instagram.com/p/CyWaqsqIdkz/" },
          { id: "2", mediaUrl: "https://behold.pictures/su4XpNQnryeiB8O203eV2KgONDk2/gGjqxmmbHMaeKvF1NJYz/18120507985317543/medium.jpg", permalink: "https://www.instagram.com/p/CyRDOY6oTo9/" },
          { id: "3", mediaUrl: "https://behold.pictures/su4XpNQnryeiB8O203eV2KgONDk2/gGjqxmmbHMaeKvF1NJYz/18238941487231477/medium.jpg", permalink: "https://www.instagram.com/p/CyRAuqaoe79/" },
          { id: "4", mediaUrl: "https://behold.pictures/su4XpNQnryeiB8O203eV2KgONDk2/gGjqxmmbHMaeKvF1NJYz/17913473309737851/medium.jpg", permalink: "https://www.instagram.com/p/CrvCs5qoWDY/" }
        ]
      } as any
    };
  } catch (error) {
    console.error("Failed to load home data:", error);
    return { slides: [] as SlideData[], categories: [], newProducts: [], instagramData: null };
  }
}

const FALLBACK_INSTAGRAM_POSTS = [
  { id: "1", mediaUrl: "/generalpics/ig1.jpg", permalink: "https://www.instagram.com/mindbody_sportwear/" },
  { id: "2", mediaUrl: "/generalpics/ig2.jpg", permalink: "https://www.instagram.com/mindbody_sportwear/" },
  { id: "3", mediaUrl: "/generalpics/ig3.jpg", permalink: "https://www.instagram.com/mindbody_sportwear/" },
  { id: "4", mediaUrl: "/generalpics/ig4.jpg", permalink: "https://www.instagram.com/mindbody_sportwear/" }
];

export default function Home() {
  const { slides, categories, newProducts, instagramData } = useLoaderData<typeof loader>();
  const postsToRender = instagramData?.posts?.length ? instagramData.posts : FALLBACK_INSTAGRAM_POSTS;
  const igUsername = instagramData?.username || "mindbody_sportwear";
  const igProfilePic = instagramData?.profilePictureUrl || "/logo-sun.png";

  // Scroll logic for parallax and back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      // Parallax for values background
      const section = document.querySelector('.values-modern') as HTMLElement;
      const bgElement = document.querySelector('.values-modern .values-premium__bg-image') as HTMLElement;
      if (section && bgElement) {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const offset = (sectionCenter - viewportCenter) * 0.4;
        bgElement.style.transform = `translateY(${offset}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // IntersectionObserver for scroll-reveal animations
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: 0.1
    };

    const revealOnScroll = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    };

    const observer = new IntersectionObserver(revealOnScroll, observerOptions);

    // Add reveal class to elements only when JS is ready
    setTimeout(() => {
      // Section headers
      document.querySelectorAll('.section__header').forEach(el => {
        el.classList.add('reveal-ready');
        observer.observe(el);
      });

      // Category cards with stagger
      document.querySelectorAll('.category-card-editorial').forEach((el, i) => {
        el.classList.add('reveal-ready');
        (el as HTMLElement).style.transitionDelay = `${i * 0.1}s`;
        observer.observe(el);
      });

      // Product cards with stagger
      document.querySelectorAll('.product-card').forEach((el, i) => {
        el.classList.add('reveal-ready');
        (el as HTMLElement).style.transitionDelay = `${(i % 4) * 0.12}s`;
        observer.observe(el);
      });

      // Value items with stagger
      document.querySelectorAll('.value-item').forEach((el, i) => {
        el.classList.add('reveal-ready');
        (el as HTMLElement).style.transitionDelay = `${i * 0.15}s`;
        observer.observe(el);
      });

      // About section elements
      document.querySelectorAll('.about-modern__image-side, .about-modern__content-side').forEach((el, i) => {
        el.classList.add('reveal-ready');
        (el as HTMLElement).style.transitionDelay = `${i * 0.2}s`;
        observer.observe(el);
      });
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <main>
      <HeroSlider slides={slides} />
      {/* Premium Features Bar */}
      <section className="premium-features-bar">
        <div className="container" style={{ maxWidth: '1440px' }}>
          <div className="features-bar__grid">

            <div className="feature-item group">
              <div className="feature-item__icon-wrapper">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"></path>
                </svg>
              </div>
              <div className="feature-item__text">
                <h4 className="feature-item__title">Українське виробництво</h4>
                <p className="feature-item__desc">100% контроль якості у своєму цеху</p>
              </div>
            </div>

            <div className="feature-item group">
              <div className="feature-item__icon-wrapper">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div className="feature-item__text">
                <h4 className="feature-item__title">Premium Supplex</h4>
                <p className="feature-item__desc">Технологічні тканини, що дихають</p>
              </div>
            </div>

            <div className="feature-item group">
              <div className="feature-item__icon-wrapper">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 16l-4-4m0 0l4-4m-4 4h14m-10 8a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
                </svg>
              </div>
              <div className="feature-item__text">
                <h4 className="feature-item__title">Повернення 14 днів</h4>
                <p className="feature-item__desc">Обмін та повернення без проблем</p>
              </div>
            </div>

            <div className="feature-item group">
              <div className="feature-item__icon-wrapper">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                  <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round"></rect>
                  <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round"></line>
                </svg>
              </div>
              <div className="feature-item__text">
                <h4 className="feature-item__title">Швидка оплата</h4>
                <p className="feature-item__desc">Безпечно карткою або при отриманні</p>
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

            <p className="section__subtitle collections-subtitle">Втілення ідеального балансу між <br /> функціональністю та бездоганною естетикою</p>
          </div>
          <div className="editorial-categories-grid">
            {categories.map((cat: any) => (
              <CategoryCard
                key={cat.id}
                title={cat.title}
                subtitle={cat.subtitle}
                image={cat.image}
                imagePos={cat.imagePos}
                link={cat.link}
                buttonText={cat.buttonText}
              />
            ))}
          </div>
        </div>

        {/* Sub-section: New Arrivals */}
        <div className="container" id="new-collections">
          <div className="section__header section__header--center">
            <span className="section__badge">Новинки {new Date().getFullYear()}</span>
            <h2 className="section__title">Нові надходження</h2>
            <p className="section__subtitle">Сезонні новинки з усіх колекцій</p>
          </div>

          <div className="products-grid-4">
            {newProducts.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          <div className="section__cta-center">
            <Link to="/shop/yoga" className="btn btn--primary btn--large">
              Переглянути всі колекції
            </Link>
          </div>
        </div>
      </section>

      <section className="section values-modern" id="values">
        <div className="logo-pattern-bg"></div>

        <div className="container">
          <div className="values-modern__header">
            <span className="values-modern__signature">Натхнення для активного життя</span>
            <h3 className="values-modern__title">Що робить нас особливими</h3>
          </div>

          <div className="values-modern__grid">
            <div className="value-item">
              <div className="value-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <div className="value-item__content">
                <h4 className="value-item__title">Виробництво в Україні</h4>
                <p className="value-item__text">Власний цех. 100% контроль якості на кожному етапі</p>
              </div>
            </div>

            <div className="value-item">
              <div className="value-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.38 3.46L16 2 12 3.46 8 2 3.62 3.46a2 2 0 0 0-1.34 1.89v13.3a2 2 0 0 0 1.34 1.89L8 22l4-1.46L16 22l4.38-1.46a2 2 0 0 0 1.34-1.89V5.35a2 2 0 0 0-1.34-1.89z" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
              </div>
              <div className="value-item__content">
                <h4 className="value-item__title">Преміум тканини</h4>
                <p className="value-item__text">Supplex® + Lycra® — дихаючий матеріал, що тримає форму 50+ прань</p>
              </div>
            </div>

            <div className="value-item">
              <div className="value-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" /></svg>
              </div>
              <div className="value-item__content">
                <h4 className="value-item__title">Еко-пакування</h4>
                <p className="value-item__text">Recycled матеріали. Zero waste підхід до крою</p>
              </div>
            </div>

            <div className="value-item">
              <div className="value-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
              </div>
              <div className="value-item__content">
                <h4 className="value-item__title">4-way stretch</h4>
                <p className="value-item__text">Еластичність у всіх напрямках. Ідеальна посадка для йоги та фітнесу</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* About Section - Professional Modern Redesign */}
      <section className="about-modern section" id="about">
        <div className="logo-pattern-bg"></div>
        <div className="container">
          <div className="about-modern__wrapper">
            <div className="about-modern__grid">
              <div className="about-modern__image-side">
                <div className="about-modern__image-container about-modern__image-container--fade">
                  <img src="/generalpics/338_131123.jpg" alt="MIND BODY Lifestyle" className="about-modern__image" loading="lazy" />
                  <div className="about-modern__image-overlay"></div>
                  <div className="about-modern__floating-badge">
                    <span className="about-modern__badge-text">Since 2024</span>
                  </div>
                </div>
              </div>
              <div className="about-modern__content-side">
                <div className="about-modern__header">
                  <span className="about-modern__tagline">Про бренд</span>
                  <h2 className="about-modern__title">
                    Подаруй собі <span>комфорт</span>
                  </h2>
                </div>
                <div className="about-modern__text-block">
                  <p className="about-modern__description">
                    MIND BODY &mdash; це більше, ніж просто одяг. Це філософія гармонії між тілом та розумом,
                    втілена в преміальних тканинах та продуманому дизайні.
                  </p>
                  <p className="about-modern__description">
                    Ми створюємо кожну колекцію в Україні, обираючи найкращі матеріали,
                    що забезпечують ідеальну посадку та безкомпромісну зручність під час йоги,
                    фітнесу чи щоденного життя.
                  </p>
                </div>
                <div className="about-modern__features">
                  <div className="about-modern__feature">
                    <div className="about-modern__feature-icon-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <div className="about-modern__feature-info">
                      <h5 className="about-modern__feature-title">Преміум якість</h5>
                      <p className="about-modern__feature-text">Тільки сертифіковані європейські тканини</p>
                    </div>
                  </div>
                  <div className="about-modern__feature">
                    <div className="about-modern__feature-icon-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <div className="about-modern__feature-info">
                      <h5 className="about-modern__feature-title">Зроблено з любов'ю</h5>
                      <p className="about-modern__feature-text">Увага до кожного шва та деталі</p>
                    </div>
                  </div>
                </div>
                <div className="about-modern__actions">
                  <Link to="/about" className="btn btn--primary btn--large">
                    Дізнатись історію
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Instagram Premium Section (Merged visually into the About section logic) */}
      <div className="ig-hyper" id="instagram">
        {/* Infinite Photo Background Wall */}
        <div className="ig-hyper__wall">
          <div className="ig-hyper__marquee ig-hyper__marquee--left">
            {[...postsToRender, ...postsToRender, ...postsToRender].map((post: any, i: number) => (
              <div key={`left-${i}`} className="ig-hyper__photo" style={{ backgroundImage: `url(${post.mediaUrl})` }} />
            ))}
          </div>
          <div className="ig-hyper__marquee ig-hyper__marquee--right">
            {[...postsToRender, ...postsToRender, ...postsToRender].reverse().map((post: any, i: number) => (
              <div key={`right-${i}`} className="ig-hyper__photo" style={{ backgroundImage: `url(${post.mediaUrl})` }} />
            ))}
          </div>
        </div>

        {/* The center content container */}
        <div className="ig-hyper__content container">
          <div className="ig-hyper__header">
            <h2 className="ig-hyper__title">Світ <em>Mind Body</em></h2>
            <p className="ig-hyper__subtitle">
              Більше, ніж просто одяг. Світ естетики, мотивації та щоденного натхнення.<br/>Будь в курсі нових колекцій першою.
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
                      <div className="ig-ui-time">04:54</div>
                      <div className="ig-ui-island">
                        <div className="ig-ui-island-cam"></div>
                      </div>
                      <div className="ig-ui-status-icons">
                        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
                          <rect x="1" y="8" width="3" height="4" rx="1" />
                          <rect x="6" y="5" width="3" height="7" rx="1" />
                          <rect x="11" y="2" width="3" height="10" rx="1" />
                          <rect x="16" y="0" width="3" height="12" rx="1" fillOpacity="0.3"/>
                        </svg>
                        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 8.5C4.5 5.5 11.5 5.5 15 8.5" />
                          <path d="M4 11C6.5 9 9.5 9 12 11" />
                        </svg>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.5px' }}>28</span>
                          <svg width="24" height="13" viewBox="0 0 24 13" fill="none" stroke="currentColor">
                            <rect x="1" y="1" width="20" height="11" rx="3" strokeWidth="1" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" />
                            <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
                            <path d="M22 4.5v4" strokeWidth="2" strokeLinecap="round" stroke="rgba(255,255,255,0.4)" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Top Navbar */}
                    <div className="ig-ui-topbar">
                      <div className="ig-ui-topleft">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        <span className="ig-ui-username">{igUsername}</span>
                      </div>
                      <div className="ig-ui-topright">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                      </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="ig-ui-content">
                      {/* Header: Avatar & Stats */}
                      <div className="ig-ui-header">
                        <div className="ig-ui-avatar-wrap">
                          <img src={igProfilePic} alt={igUsername} className="ig-ui-avatar" />
                        </div>
                        <div className="ig-ui-stats">
                          <div className="ig-ui-stat"><span className="num">2168</span><span className="lbl">публикации</span></div>
                          <div className="ig-ui-stat"><span className="num">63,9 тыс.</span><span className="lbl">подписчики</span></div>
                          <div className="ig-ui-stat"><span className="num">1257</span><span className="lbl">подписки</span></div>
                        </div>
                      </div>

                      {/* Bio Section */}
                      <div className="ig-ui-bio">
                        <div className="ig-ui-name">MIND BODY sport wear <span style={{ fontWeight: 400 }}>одяг для йоги та фітнесу</span></div>
                        <div className="ig-ui-text">
                          Комбінезон твоєї мрії!✨<br />
                          Найбільший вибір,найкраща якість<br />
                          для маленьких 👸 <span className="ig-ui-mention">@mindbody_kidswear</span><br />
                          casual одяг <span className="ig-ui-mention">@fluid_feel_free</span> &nbsp;<span style={{ color: '#a8a8a8' }}>ещё</span><br />
                          <span style={{ fontWeight: 600 }}>Показать перевод</span>
                        </div>
                        <a href="/" className="ig-ui-link">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: '-2px' }}>
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                          </svg>
                          t.me/mindbody_sportwear
                        </a>
                      </div>

                      {/* Action Buttons */}
                      <div className="ig-ui-actions">
                        <div className="ig-ui-btn">
                          Вы подписаны
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}><path d="M6 9l6 6 6-6" /></svg>
                        </div>
                        <div className="ig-ui-btn">Сообщение</div>
                        <div className="ig-ui-btn icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg></div>
                      </div>

                      {/* Highlights */}
                      <div className="ig-ui-highlights">
                        {['SALE', 'SALE FLUID', 'SALE SET', 'ВІДГУКИ 11'].map((name, idx) => (
                          <div key={idx} className="ig-ui-highlight">
                            <div className="ig-ui-hl-ring">
                              <div className="ig-ui-hl-img" style={{ backgroundImage: `url(${postsToRender[idx % postsToRender.length]?.mediaUrl})` }}></div>
                            </div>
                            <span>{name}</span>
                          </div>
                        ))}
                      </div>

                      {/* Tabs */}
                      <div className="ig-ui-tabs">
                        <div className="ig-ui-tab active"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg></div>
                        <div className="ig-ui-tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M4 6h16M4 18h16M8 2v4M16 2v4M12 18v4" /></svg></div>
                        <div className="ig-ui-tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></div>
                      </div>

                      {/* 3-Column Grid Feed */}
                      <div className="ig-ui-feed">
                        {Array.from({ length: 9 }).map((_, i) => {
                          const post = postsToRender[i % postsToRender.length];
                          return (
                            <a key={`ig-${i}`} href={post.permalink} target="_blank" rel="noopener noreferrer" className="ig-ui-feed-post">
                              <img src={post.mediaUrl} alt={`Post ${i + 1}`} loading="lazy" />
                            </a>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Navbar */}
                    <div className="ig-ui-navbar">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="4" ry="4" /><path d="M10 8l6 4-6 4V8z" /></svg>
                      <div className="ig-ui-nav-avatar"><img src={igProfilePic} alt="Profile" /></div>
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

          <a href="https://www.instagram.com/mindbody_sportwear/" target="_blank" rel="noopener noreferrer" className="ig-hyper__cta">
              Відкрити Instagram
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>

      </div>
      </section>

    </main>
  );
}

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
