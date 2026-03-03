/* ================================================
   MIND BODY - Main JavaScript
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  Preloader.init();
  Header.init();
  ScrollReveal.init();
  SmoothScroll.init();
  ProductCards.init();
  Newsletter.init();
});

// === Preloader ===
const Preloader = {
  init() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.classList.remove('no-scroll');
      }, 800);
    });
  }
};

// === Header ===
const Header = {
  init() {
    const header = document.getElementById('header') || document.querySelector('header');
    const burger = document.getElementById('burgerBtn');
    const nav = document.getElementById('mainNav');

    if (!header) return;

    // Scroll behavior
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }

      lastScroll = currentScroll;
    });

    // Mobile menu
    if (burger && nav) {
      burger.addEventListener('click', () => {
        burger.classList.toggle('active');
        nav.classList.toggle('open');
        document.body.classList.toggle('no-scroll');
      });
    }

    // Auth button
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', (e) => this.handleProfileClick(e));
    }

    // Wishlist button
    const wishlistBtn = document.querySelector('.header__wishlist-btn');
    if (wishlistBtn) {
      wishlistBtn.addEventListener('click', (e) => {
        if (!e.currentTarget.onclick) { // Only if no inline handler
          window.location.href = 'wishlist.html';
        }
      });
    }

    if (window.api) {
      this.checkAuthState();
    }
  },

  handleProfileClick(e) {
    if (e) e.preventDefault();
    const token = localStorage.getItem('mb_token');
    if (token) {
      window.location.href = 'profile.html';
    } else {
      this.showAuth();
    }
  },

  async checkAuthState() {
    if (!window.api || !window.api.getCurrentUser) return;

    try {
      const user = await window.api.getCurrentUser();
      const profileBtn = document.getElementById('profileBtn');

      if (profileBtn) {
        if (user) {
          // Logged In
          profileBtn.title = 'Особистий кабінет';
          // We don't overwrite innerHTML here if we want to keep the icon, 
          // but we can add an 'active' class
          profileBtn.classList.add('is-logged-in');
        } else {
          // Guest
          profileBtn.title = 'Увійти';
          profileBtn.classList.remove('is-logged-in');
        }
      }
    } catch (e) {
      console.warn('Auth check failed:', e);
    }
  },

  showAuth() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('open');
      document.body.classList.add('no-scroll');
    }
  },

  closeAuth() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('open');
      document.body.classList.remove('no-scroll');
    }
  },

  toggleAuthForm(type) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (type === 'register') {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
    } else {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
    }
  },

  async handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;

    if (!email || !pass) {
      Toast.warning('Заповніть всі поля');
      return;
    }

    const res = await window.api.login(email, pass);
    if (res.access_token) {
      Toast.success('Вхід успішний!');
      this.closeAuth();
      this.checkAuthState();
    } else {
      Toast.error(res.error || 'Помилка входу');
    }
  },

  async handleRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;

    if (!name || !email || !pass) {
      Toast.warning('Заповніть всі поля');
      return;
    }

    const res = await window.api.register({ full_name: name, email: email, password: pass });
    if (res.access_token) {
      localStorage.setItem('mb_token', res.access_token);
      Toast.success('Реєстрація успішна!');
      this.closeAuth();
      this.checkAuthState();
    } else if (res.id) {
      Toast.success('Реєстрація успішна! Увійдіть.');
      this.toggleAuthForm('login');
    } else {
      Toast.error(res.error || 'Помилка реєстрації');
    }
  }
};

// === Scroll Reveal ===
const ScrollReveal = {
  init() {
    const elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children');

    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => observer.observe(el));
  }
};

// === Smooth Scroll ===
const SmoothScroll = {
  init() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        e.preventDefault();

        const headerHeight = document.getElementById('header')?.offsetHeight || 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      });
    });
  }
};

// === Product Cards ===
const ProductCards = {
  // Expose for inline usage (Shop.js)
  toggleWishlist(btn, productId) {
    if (typeof wishlist !== 'undefined') {
      wishlist.toggleItem(productId);
      const icon = btn.querySelector('svg');

      if (wishlist.isInWishlist(productId)) {
        btn.classList.add('active');
        icon?.setAttribute('fill', 'currentColor');
        Toast.success('Додано до улюблених');
      } else {
        btn.classList.remove('active');
        icon?.setAttribute('fill', 'none');
        Toast.info('Видалено з улюблених');
      }
    }
  },

  init() {
    // Initialize wishlist buttons (only those WITHOUT inline onclick handlers)
    const wishlistBtns = document.querySelectorAll('.product-card__wishlist');

    wishlistBtns.forEach(btn => {
      // Skip buttons that already have inline onclick handlers (from shop.js)
      if (btn.hasAttribute('onclick')) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const card = btn.closest('.product-card');
        const productId = card?.dataset.productId;

        // Only toggle if we have a valid product ID
        if (productId) {
          this.toggleWishlist(btn, productId);
        }
      });
    });

    // Only run on static product elements if any remain
    const addToCartBtns = document.querySelectorAll('.product-card__actions .btn');

    // Add to cart
    addToCartBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const card = btn.closest('.product-card');
        const productData = {
          id: card?.dataset.productId || 'home-item',
          name: card?.querySelector('.product-card__name')?.textContent || 'Товар',
          price: parseInt(card?.querySelector('.product-card__price')?.textContent.replace(/[^0-9]/g, '')) || 0,
          images: [card?.querySelector('img')?.src || '']
        };

        // Animation
        btn.classList.add('loading');
        const originalText = btn.textContent;
        btn.textContent = 'Додаємо...';

        setTimeout(() => {
          if (typeof cart !== 'undefined') {
            cart.addItem(productData);
          }

          btn.classList.remove('loading');
          btn.textContent = 'Додано ✓';
          Toast.success('Товар додано до кошика');

          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }, 800);
      });
    });
  },

  updateCartCount() {
    const counter = document.querySelector('.header__cart-count');
    if (counter) {
      const current = parseInt(counter.textContent) || 0;
      counter.textContent = current + 1;
      counter.classList.add('animate-bounce');
      setTimeout(() => counter.classList.remove('animate-bounce'), 500);
    }
  },

  showToast(message, type = 'success') {
    if (window.Toast) {
      window.Toast[type] ? window.Toast[type](message) : window.Toast.info(message);
    } else {
      console.warn('Toast system not loaded for message:', message);
    }
  }
};

// === Newsletter ===
const Newsletter = {
  init() {
    const form = document.querySelector('.newsletter__form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const input = form.querySelector('input');
      const btn = form.querySelector('button');
      const email = input.value;

      if (!this.validateEmail(email)) {
        input.style.borderColor = 'var(--color-error)';
        return;
      }

      btn.textContent = 'Відправляємо...';
      btn.disabled = true;

      // Simulate API call
      setTimeout(() => {
        btn.textContent = 'Дякуємо! ✓';
        input.value = '';
        input.style.borderColor = 'var(--color-success)';

        setTimeout(() => {
          btn.textContent = 'Підписатись';
          btn.disabled = false;
          input.style.borderColor = '';
        }, 3000);
      }, 1000);
    });
  },

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
};

// === Utility Functions ===
const Utils = {
  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function
  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// === Expose to Global Scope ===
window.Preloader = Preloader;
window.Header = Header;
window.ScrollReveal = ScrollReveal;
window.SmoothScroll = SmoothScroll;
window.ProductCards = ProductCards;
window.Newsletter = Newsletter;
window.Utils = Utils;


