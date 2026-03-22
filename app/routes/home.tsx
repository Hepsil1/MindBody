import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useEffect } from "react";
import HeroSlider, { type SlideData } from "../components/HeroSlider";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";
import { prisma } from "../db.server";
import { cachedFetch } from "../utils/cache.server";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "MIND BODY — Спортивний одяг для йоги та активного життя" },
    { name: "description", content: "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика." },
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

    const mapProduct = (p: any) => {
      let imgs: string[] = [];
      try { imgs = JSON.parse(p.images || '[]'); } catch { }
      return {
        id: p.id,
        name: p.name,
        category: p.category || p.shopPageSlug,
        price: Number(p.price),
        price_usd: Math.round(Number(p.price) / 40),
        image: imgs[0] || '/brand-sun.png',
        image2: imgs[1] || null,
        is_new: true,
        is_sale: p.comparePrice ? Number(p.comparePrice) > Number(p.price) : false,
        sale_price: p.comparePrice && Number(p.comparePrice) > Number(p.price) ? Number(p.price) : undefined
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
    };
  } catch (error) {
    console.error("Failed to load home data:", error);
    return { slides: [] as SlideData[], categories: [], newProducts: [] };
  }
}

export default function Home() {
  const { slides, categories, newProducts } = useLoaderData<typeof loader>();

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
                  <img src="/generalpics/338_131123.jpg" alt="MIND BODY Lifestyle" className="about-modern__image" />
                  <div className="about-modern__image-overlay"></div>
                  <div className="about-modern__floating-badge">
                    <span className="about-modern__badge-text">Est. 2024</span>
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
      </section>


    </main>
  );
}
