/* ================================================
   MIND BODY — Hero Slider JavaScript
   Premium slider with touch support & Ken Burns sync
   ================================================ */

class HeroSlider {
    constructor(options = {}) {
        // Configuration
        this.config = {
            containerSelector: '.hero-slider',
            slideSelector: '.hero-slider__slide',
            dotSelector: '.hero-slider__dot',
            interval: options.interval || 4000,
            transitionDuration: options.transitionDuration || 1200,
            autoplay: options.autoplay !== false,
            enableTouch: options.enableTouch !== false,
        };

        // State
        this.currentSlide = 0;
        this.totalSlides = 0;
        this.autoplayInterval = null;
        this.isTransitioning = false;
        this.touchStartX = 0;
        this.touchEndX = 0;

        // Elements
        this.container = null;
        this.slides = [];
        this.dots = [];

        // Initialize
        this.init();
    }

    init() {
        // Get elements
        this.container = document.querySelector(this.config.containerSelector);
        if (!this.container) return;

        this.slides = Array.from(this.container.querySelectorAll(this.config.slideSelector));
        this.dots = Array.from(this.container.querySelectorAll(this.config.dotSelector));
        this.totalSlides = this.slides.length;

        if (this.totalSlides === 0) return;

        // Bind events
        this.bindEvents();

        // Start autoplay
        if (this.config.autoplay) {
            this.startAutoplay();
        }

        // Preload next slide images
        this.preloadSlide(1);

        console.log(`HeroSlider initialized with ${this.totalSlides} slides`);
    }

    bindEvents() {
        // Dot navigation
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.stopAutoplay(); // Stop on manual interaction
                this.goToSlide(index);
                this.startAutoplay(); // Restart after interaction
            });
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.stopAutoplay();
                this.prevSlide();
                this.startAutoplay();
            } else if (e.key === 'ArrowRight') {
                this.stopAutoplay();
                this.nextSlide();
                this.startAutoplay();
            }
        });

        // Loop visibility check - just in case, but interval is robust
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.config.autoplay) {
                this.startAutoplay();
            }
        });

        // Touch events for swipe
        if (this.config.enableTouch) {
            this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
            this.container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
            this.container.addEventListener('touchend', () => this.handleTouchEnd());
        }
    }

    goToSlide(index) {
        if (this.isTransitioning || index === this.currentSlide) return;
        if (index < 0 || index >= this.totalSlides) return;

        this.isTransitioning = true;

        // Update slides
        this.slides[this.currentSlide].classList.remove('is-active');
        this.slides[index].classList.add('is-active');

        // Update dots
        this.dots[this.currentSlide]?.classList.remove('is-active');
        this.dots[index]?.classList.add('is-active');

        // Update current index
        this.currentSlide = index;

        // Allow next transition after duration
        setTimeout(() => {
            this.isTransitioning = false;
        }, this.config.transitionDuration);

        // Preload next
        this.preloadSlide((index + 1) % this.totalSlides);
    }

    nextSlide() {
        const next = (this.currentSlide + 1) % this.totalSlides;
        this.goToSlide(next);
    }

    prevSlide() {
        const prev = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(prev);
    }

    startAutoplay() {
        this.stopAutoplay(); // Clear existing to prevent duplicates
        this.autoplayInterval = setInterval(() => {
            this.nextSlide();
        }, this.config.interval);
    }

    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
    }

    // Touch handling for swipe
    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.stopAutoplay();
    }

    handleTouchMove(e) {
        this.touchEndX = e.touches[0].clientX;
    }

    handleTouchEnd() {
        const diff = this.touchStartX - this.touchEndX;
        const threshold = 50; // Minimum swipe distance

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                this.nextSlide();
            } else {
                this.prevSlide();
            }
        }

        this.touchStartX = 0;
        this.touchEndX = 0;
        this.startAutoplay(); // Restart after swipe
    }

    // Preload images
    preloadSlide(index) {
        if (index < 0 || index >= this.totalSlides) return;
        const slide = this.slides[index];
        const img = slide.querySelector('img');
        if (img && !img.complete) {
            const preloadImg = new Image();
            preloadImg.src = img.src;
        }
    }
}

// ================================================
// Glassmorphic Header on Scroll
// ================================================

class StickyHeader {
    constructor() {
        this.header = document.querySelector('.header');
        this.scrollThreshold = 50;
        this.isScrolled = false;

        if (this.header) {
            this.init();
        }
    }

    init() {
        // Use passive listener for better scroll performance
        window.addEventListener('scroll', () => this.onScroll(), { passive: true });

        // Check initial state
        this.onScroll();
    }

    onScroll() {
        const scrollY = window.scrollY || window.pageYOffset;

        if (scrollY > this.scrollThreshold && !this.isScrolled) {
            this.header.classList.add('is-scrolled');
            this.isScrolled = true;
        } else if (scrollY <= this.scrollThreshold && this.isScrolled) {
            this.header.classList.remove('is-scrolled');
            this.isScrolled = false;
        }
    }
}

// ================================================
// Parallax Effect on Hero (subtle)
// ================================================

class HeroParallax {
    constructor() {
        this.hero = document.querySelector('.hero-slider');
        this.content = document.querySelector('.hero-slider__content');
        this.enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (this.hero && this.content && this.enabled) {
            this.init();
        }
    }

    init() {
        window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    }

    onScroll() {
        const scrollY = window.scrollY || window.pageYOffset;
        const heroHeight = this.hero.offsetHeight;

        // Only apply effect while hero is visible
        if (scrollY < heroHeight) {
            const progress = scrollY / heroHeight;

            // Subtle parallax on content - moves slower than scroll
            const contentOffset = scrollY * 0.3;
            this.content.style.transform = `translateY(${contentOffset}px)`;

            // Fade out content as user scrolls
            this.content.style.opacity = 1 - (progress * 0.8);
        }
    }
}

// ================================================
// Initialize Everything
// ================================================

// Initialize safely
function initHeroSlider() {
    console.log('Hero Slider: initializing...');
    if (window.heroSlider) return; // Prevent double init

    try {
        const slider = new HeroSlider({
            interval: 4000,
            transitionDuration: 1200,
            autoplay: true,
            enableTouch: true,
        });
        window.heroSlider = slider;
        console.log('Hero Slider: started successfully');
    } catch (e) {
        console.error('Hero Slider: failed to init', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroSlider);
} else {
    initHeroSlider();
}
