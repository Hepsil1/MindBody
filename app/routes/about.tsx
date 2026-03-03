import type { Route } from "./+types/about";
import { prisma } from "../db.server";
import { useLoaderData } from "react-router";
import { useState, useEffect } from "react";
import HeroSlider, { type SlideData } from "../components/HeroSlider";

export async function loader({ request }: Route.LoaderArgs) {
    try {
        // Fetch About slides using Raw SQL to bypass outdated client validation
        // The 'page' column exists in DB (pushed) but client might not know it
        const aboutSlidesRaw = await prisma.$queryRaw`SELECT * FROM Slide WHERE page = 'about' ORDER BY "order" ASC` as any[];

        const aboutSlides: SlideData[] = aboutSlidesRaw.map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            link: s.link,
            image1: s.image1,
            image2: s.image2,
            image3: s.image3,
        }));

        // If no slides, return default values format or empty to trigger default in HeroSlider? 
        // HeroSlider handles empty slides by showing built-in defaults (which are Home slides).
        // Since we want specific "About" behavior, we might want to manually handle default if empty.
        // But for now, let's pass what we have. If empty, HeroSlider shows Teal Collection etc. 
        // Maybe we want specific default for About? 
        // Let's pass empty array if empty, and let HeroSlider decide or we provide fallback here.
        // Given user wants "Like index.html", existing defaults are OK or we can inject one.

        return { slides: aboutSlides };
    } catch (error) {
        console.error("About loader error:", error);
        return { slides: [] };
    }
}

export default function About() {
    const { slides } = useLoaderData<typeof loader>();

    // Use HeroSlider with custom overlay content to match Homepage style but with About text
    return (
        <main className="about-dynamic">
            {/* Full-Screen Hero with Slides using HeroSlider */}
            <HeroSlider slides={slides} showScroll={false}>
                {/* Custom Overlay Content for About Page */}
                {/* Custom Overlay Content for About Page */}
                {/* Custom Overlay Content for About Page */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes breathe {
                        0%, 100% { transform: scale(1); filter: brightness(0) invert(1) drop-shadow(0 0 15px rgba(255,255,255,0.3)); }
                        50% { transform: scale(1.05); filter: brightness(0) invert(1) drop-shadow(0 0 25px rgba(255,255,255,0.5)); }
                    }
                `}} />

                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}>

                    {/* Centered Brand Logo with Breathing Animation */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '-40px' // Visual optical centering
                    }}>
                        <img
                            src="/pics/mind_body_logo.png"
                            alt="MIND BODY"
                            style={{
                                maxWidth: '75vw',
                                width: '550px',
                                height: 'auto',
                                animation: 'breathe 4s ease-in-out infinite'
                            }}
                        />
                        {/* Removed redundant text since logo contains it */}
                    </div>

                    {/* Bottom Left Subtitle - Vertical Layout (Mirrors Scroll) */}
                    <div style={{
                        position: 'absolute',
                        left: '50px',
                        bottom: '50px',
                        display: 'flex',
                        flexDirection: 'column', // Stack line and text
                        alignItems: 'center',
                        gap: '15px',
                        opacity: 0.8,
                    }}>
                        <p style={{
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            transform: 'rotate(180deg)',
                            color: '#fff',
                            fontSize: 'clamp(0.8rem, 1vw, 0.9rem)',
                            fontFamily: "'Tenor Sans', sans-serif",
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            margin: 0,
                            whiteSpace: 'nowrap'
                        }}>
                            Одяг, який надихає тебе рухатись
                        </p>
                        <div style={{ width: '1px', height: '40px', background: '#fff' }}></div>
                    </div>
                    {/* Right Side Scroll Indicator - Refined */}
                    <div style={{
                        position: 'absolute',
                        right: '50px',
                        bottom: '50px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        opacity: 0.9
                    }}>
                        <span style={{
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            color: '#fff',
                            fontSize: '0.75rem',
                            letterSpacing: '4px',
                            textTransform: 'uppercase',
                            fontWeight: 300,
                            transform: 'rotate(180deg)'
                        }}>
                            Scroll
                        </span>
                        <div style={{
                            width: '1px',
                            height: '50px',
                            background: 'rgba(255,255,255,0.4)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '100%',
                                height: '40%',
                                background: '#fff',
                                animation: 'scrollDown 2s cubic-bezier(0.77, 0, 0.175, 1) infinite'
                            }}></div>
                        </div>
                    </div>
                </div>
            </HeroSlider>

            {/* Story Section - Premium Redesign */}
            <section className="story-premium">
                <div className="story-premium__left">
                    <div className="story-premium__overlay"></div>
                    <img src="/pics1cloths/IMG_6215.JPG" alt="MIND BODY" className="story-premium__image" />
                    <div className="story-premium__badge">
                        <span>Est. 2020</span>
                    </div>
                </div>
                <div className="story-premium__right">
                    <div className="story-premium__logos">
                        <div className="story-logo story-logo--1"></div>
                        <div className="story-logo story-logo--2"></div>
                        <div className="story-logo story-logo--3"></div>
                        <div className="story-logo story-logo--4"></div>
                        <div className="story-logo story-logo--5"></div>
                    </div>
                    <div className="story-premium__content">
                        <span className="story-premium__tag">Our Story</span>
                        <h2 className="story-premium__title">
                            Motivate for active life
                        </h2>
                        <div className="story-premium__text">
                            <p>
                                <strong>MIND BODY sport wear</strong> — бренд одягу для йоги, танців,
                                фітнесу та інших видів спорту, який <em>чудово зарекомендував себе</em> серед
                                відомих тренерів по всьому світу.
                            </p>
                            <p className="story-premium__highlight">
                                Одяг, стимулюючий до практики, в ньому всі твої улюблені заняття
                                перетворюються на справжнє задоволення!
                            </p>
                        </div>
                        <div className="story-premium__values">
                            <div className="story-value">
                                <div className="story-value__icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                                        <path d="M8 12L11 15L16 9" />
                                    </svg>
                                </div>
                                <span className="story-value__text">Premium Quality</span>
                            </div>
                            <div className="story-value">
                                <div className="story-value__icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                </div>
                                <span className="story-value__text">Handmade with Love</span>
                            </div>
                            <div className="story-value">
                                <div className="story-value__icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                        <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                                        <path d="M2 17L12 22L22 17" />
                                        <path d="M2 12L12 17L22 12" />
                                    </svg>
                                </div>
                                <span className="story-value__text">Eco Materials</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Process Section - Wide Cards with Logo Background */}
            <section className="process-wide">
                <div className="process-wide__bg">
                    <div className="process-logo process-logo--1"></div>
                    <div className="process-logo process-logo--2"></div>
                    <div className="process-logo process-logo--3"></div>
                    <div className="process-logo process-logo--4"></div>
                    <div className="process-logo process-logo--5"></div>
                    <div className="process-logo process-logo--6"></div>
                    <div className="process-logo process-logo--7"></div>
                    <div className="process-logo process-logo--8"></div>
                </div>
                <div className="process-wide__container">
                    <div className="process-wide__header">
                        <span className="process-wide__tag">Наш процес</span>
                        <h2 className="process-wide__title">Шлях до <em>досконалості</em></h2>
                    </div>
                    <div className="process-wide__grid">
                        <div className="process-wide__card">
                            <div className="process-wide__number">01</div>
                            <div className="process-wide__image">
                                <img src="/pics1cloths/IMG_6203.JPG" alt="Idea" />
                            </div>
                            <div className="process-wide__content">
                                <h3 className="process-wide__name">Ідея</h3>
                                <p className="process-wide__text">Натхнення з практики йоги та активного руху. Ми створюємо образи, що відповідають духу свободи.</p>
                            </div>
                        </div>
                        <div className="process-wide__card">
                            <div className="process-wide__number">02</div>
                            <div className="process-wide__image">
                                <img src="/pics1cloths/IMG_6209.JPG" alt="Materials" />
                            </div>
                            <div className="process-wide__content">
                                <h3 className="process-wide__name">Матеріали</h3>
                                <p className="process-wide__text">Тканини найвищої якості з усього світу. Дихаючі, еластичні та довговічні.</p>
                            </div>
                        </div>
                        <div className="process-wide__card">
                            <div className="process-wide__number">03</div>
                            <div className="process-wide__image">
                                <img src="/pics1cloths/IMG_6212.JPG" alt="Sewing" />
                            </div>
                            <div className="process-wide__content">
                                <h3 className="process-wide__name">Пошив</h3>
                                <p className="process-wide__text">Ручна робота досвідчених майстрів. Кожен шов — це прояв любові до справи.</p>
                            </div>
                        </div>
                        <div className="process-wide__card">
                            <div className="process-wide__number">04</div>
                            <div className="process-wide__image">
                                <img src="/pics1cloths/IMG_6201.JPG" alt="Result" />
                            </div>
                            <div className="process-wide__content">
                                <h3 className="process-wide__name">Результат</h3>
                                <p className="process-wide__text">Одяг, що надихає на нові звершення. Стиль, комфорт та впевненість у кожному русі.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section - Premium with Flying Logos */}
            <section className="contact-premium">
                <div className="contact-premium__left">
                    <div className="contact-premium__logos">
                        <div className="flying-logo flying-logo--1"></div>
                        <div className="flying-logo flying-logo--2"></div>
                        <div className="flying-logo flying-logo--3"></div>
                        <div className="flying-logo flying-logo--4"></div>
                        <div className="flying-logo flying-logo--5"></div>
                    </div>
                    <div className="contact-premium__text">
                        <span className="contact-premium__label">Ми на зв'язку</span>
                        <h2 className="contact-premium__title">Давай<br /><em>поговоримо</em></h2>
                    </div>
                </div>
                <div className="contact-premium__right">
                    <p className="contact-premium__desc">
                        <em>Готові відповісти</em> на будь-які питання та допомогти з вибором ідеального образу для вас
                    </p>
                    <div className="contact-premium__phones">
                        <a href="tel:+380966650855" className="contact-premium__link">
                            <div className="contact-premium__icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </div>
                            <div className="contact-premium__info">
                                <span className="contact-premium__phone">+380 (96) 665-08-55</span>
                                <span className="contact-premium__hint">Основний</span>
                            </div>
                        </a>
                        <a href="tel:+380509656737" className="contact-premium__link">
                            <div className="contact-premium__icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </div>
                            <div className="contact-premium__info">
                                <span className="contact-premium__phone">+380 (50) 965-67-37</span>
                                <span className="contact-premium__hint">Viber / Telegram</span>
                            </div>
                        </a>
                        <a href="tel:+380973542848" className="contact-premium__link">
                            <div className="contact-premium__icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </div>
                            <div className="contact-premium__info">
                                <span className="contact-premium__phone">+380 (97) 354-28-48</span>
                                <span className="contact-premium__hint">WhatsApp</span>
                            </div>
                        </a>
                    </div>
                    <a href="https://www.instagram.com/mind_body_sportwear/" target="_blank" rel="noopener noreferrer" className="contact-premium__social">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        <span>Слідкуй за нами в Instagram</span>
                    </a>
                </div>
            </section>
        </main>
    );
}
