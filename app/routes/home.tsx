import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import HeroSlider, { type SlideData } from "../components/HeroSlider";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";
import { prisma } from "../db.server";
import productsWomen from "../data/products_women.json";
import productsKids from "../data/products_kids.json";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "MIND BODY — Спортивний одяг для йоги та активного життя" },
    { name: "description", content: "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Use Raw SQL to only fetch HOME slides (page is null or 'home')
    const slides = await prisma.$queryRaw`SELECT * FROM "Slide" WHERE page IS NULL OR page = 'home' ORDER BY "order" ASC` as any[];

    // Dynamic check for category model
    const categoryModel = (prisma as any).category;
    const categoriesFromDb = categoryModel
      ? await categoryModel.findMany({ orderBy: { order: "asc" } })
      : [];

    // Fetch active products from DB for homepage
    let womenProducts: any[] = [];
    let kidsProducts: any[] = [];
    try {
      const allProducts = await prisma.$queryRaw`
        SELECT id, name, description, price, "comparePrice", category, images, colors, sizes, "shopPageSlug"
        FROM "Product"
        WHERE status = 'active'
        ORDER BY "createdAt" DESC
      ` as any[];

      womenProducts = allProducts
        .filter((p: any) => p.shopPageSlug === 'women' || p.category === 'women')
        .slice(0, 4)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category || 'women',
          price: Number(p.price),
          price_usd: Math.round(Number(p.price) / 40),
          image: (() => { try { const imgs = JSON.parse(p.images || '[]'); return imgs[0] || '/pics1cloths/IMG_6201.JPG'; } catch { return '/pics1cloths/IMG_6201.JPG'; } })(),
          image2: (() => { try { const imgs = JSON.parse(p.images || '[]'); return imgs[1] || null; } catch { return null; } })(),
          is_new: p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false,
          is_sale: p.comparePrice ? Number(p.comparePrice) > Number(p.price) : false,
          sale_price: p.comparePrice && Number(p.comparePrice) > Number(p.price) ? Number(p.price) : undefined
        }));

      kidsProducts = allProducts
        .filter((p: any) => p.shopPageSlug === 'kids' || p.category === 'kids')
        .slice(0, 4)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category || 'kids',
          price: Number(p.price),
          price_usd: Math.round(Number(p.price) / 40),
          image: (() => { try { const imgs = JSON.parse(p.images || '[]'); return imgs[0] || '/pics2cloths/IMG_5222.JPG'; } catch { return '/pics2cloths/IMG_5222.JPG'; } })(),
          image2: (() => { try { const imgs = JSON.parse(p.images || '[]'); return imgs[1] || null; } catch { return null; } })(),
          is_new: p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false,
          is_sale: p.comparePrice ? Number(p.comparePrice) > Number(p.price) : false,
          sale_price: p.comparePrice && Number(p.comparePrice) > Number(p.price) ? Number(p.price) : undefined
        }));
    } catch (e) {
      console.error('Failed to load products:', e);
    }

    // Fallback sample data if DB is empty - use actual products from JSON
    if (womenProducts.length === 0) {
      womenProducts = productsWomen.slice(0, 4).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category === 'jumpsuit' ? 'Комбінезон' : (p.category === 'leggings' ? 'Легінси' : 'Товар'),
        price: p.price,
        price_usd: p.priceUSD || Math.round(p.price / 40),
        image: `/${p.images[0]}`,
        image2: p.images[1] ? `/${p.images[1]}` : null,
        is_new: p.isNew
      }));
    }
    if (kidsProducts.length === 0) {
      kidsProducts = productsKids.slice(0, 4).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category.includes('jumpsuit') ? 'Дитячий комбінезон' : 'Дитячий товар',
        price: p.price,
        price_usd: p.priceUSD || Math.round(p.price / 40),
        image: `/${p.images[0]}`,
        image2: p.images[1] ? `/${p.images[1]}` : null,
        is_new: p.isNew
      }));
    }

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
        {
          id: "1",
          title: "Жінкам",
          subtitle: "Колекція для неї",
          image: "/pics1cloths/IMG_6201.JPG",
          link: "/shop/women",
          buttonText: "Переглянути все"
        },
        {
          id: "2",
          title: "Дітям",
          subtitle: "Для малечі",
          image: "/pics2cloths/IMG_5222.JPG",
          link: "/shop/kids",
          buttonText: "Дивитись товари"
        }
      ],
      womenProducts,
      kidsProducts,
    };
  } catch (error) {
    console.error("Failed to load home data:", error);
    return { slides: [] as SlideData[], categories: [], womenProducts: [], kidsProducts: [] };
  }
}

export default function Home() {
  const { slides, categories, womenProducts, kidsProducts } = useLoaderData<typeof loader>();
  const [showBackToTop, setShowBackToTop] = useState(false);

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

      // Back to top visibility
      if (window.scrollY > 500) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
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
    // Small delay to ensure all dynamic elements are rendered
    setTimeout(() => {
      document.querySelectorAll('.section__header, .value-item, .product-card').forEach(el => {
        el.classList.add('reveal-ready');
        observer.observe(el);
      });
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <main>
      <HeroSlider slides={slides} />

      {/* Trust Bar */}
      <section className="trust-bar">
        <div className="container">
          <div className="trust-bar__grid">
            <div className="trust-bar__item">
              <span className="trust-bar__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" /><polyline points="16 8 20 8 23 11 23 16 20 16" /><circle cx="18" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>
              </span>
              <div className="trust-bar__text">
                <strong>Швидка доставка</strong>
                <span>Нова Пошта по всій Україні</span>
              </div>
            </div>
            <div className="trust-bar__item">
              <span className="trust-bar__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
              </span>
              <div className="trust-bar__text">
                <strong>Повернення 14 днів</strong>
                <span>Обмін та повернення без проблем</span>
              </div>
            </div>
            <div className="trust-bar__item">
              <span className="trust-bar__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
              </span>
              <div className="trust-bar__text">
                <strong>Українське виробництво</strong>
                <span>100% якість та контроль</span>
              </div>
            </div>
            <div className="trust-bar__item">
              <span className="trust-bar__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
              </span>
              <div className="trust-bar__text">
                <strong>Безпечна оплата</strong>
                <span>Оплата карткою або при отриманні</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Categories */}
      <section className="categories section" id="shop">
        <div className="container">
          <div className="section__header">
            <h2 className="section__title">Обирайте свій стиль</h2>
            <p className="section__subtitle">Колекції для активного способу життя</p>
          </div>
          <div className="categories__grid">
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
      </section>

      {/* New Collections - 8 Cards Grid */}
      <section className="section section--alt new-arrivals" id="new-collections">
        <div className="logo-pattern-bg"></div>
        <div className="container">
          <div className="section__header section__header--center">
            <span className="section__badge">Новинки {new Date().getFullYear()}</span>
            <h2 className="section__title">Нові надходження</h2>
            <p className="section__subtitle">Сезонні новинки колекції для всієї родини</p>
          </div>

          {/* Women's Row */}
          <div className="arrivals-category">
            <div className="collection-header">
              <div className="collection-header__content">
                <span className="collection-header__label">Жіноча колекція</span>
              </div>
              <Link to="/shop/women" className="collection-link">
                <span className="collection-link__text">Переглянути колекцію</span>
                <span className="collection-link__icon">→</span>
              </Link>
            </div>
            <div className="products-grid-4">
              {womenProducts.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>

          {/* Kids Row */}
          <div className="arrivals-category arrivals-category--kids">
            <div className="collection-header">
              <div className="collection-header__content">
                <span className="collection-header__label">Дитяча колекція</span>
              </div>
              <Link to="/shop/kids" className="collection-link">
                <span className="collection-link__text">Переглянути колекцію</span>
                <span className="collection-link__icon">→</span>
              </Link>
            </div>
            <div className="products-grid-4">
              {kidsProducts.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
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

      {/* Back to Top Button */}
      <button
        className={`back-to-top ${showBackToTop ? 'is-visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
    </main>
  );
}
