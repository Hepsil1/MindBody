import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Initial scroll check
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(400);
  const initialScrollY = await page.evaluate(() => window.scrollY);
  console.log('1. Initial scroll Y:', initialScrollY);

  // 2. Open Cart Drawer by clicking cart button in header
  console.log('2. Clicking cart button...');
  await page.evaluate(() => {
    const btn = document.querySelector('.header__action-btn--cart');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);

  const lenisStateDuringModal = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    htmlClass: document.documentElement.className,
    hasLenisStoppedClass: document.documentElement.classList.contains('lenis-stopped'),
    lenisIsStopped: window.__lenis ? window.__lenis.isStopped : null
  }));
  console.log('3. State while Cart is OPEN:', lenisStateDuringModal);

  // 3. Close Cart Drawer by clicking close button in DOM
  console.log('4. Closing cart drawer via DOM click...');
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.cart-drawer.open .cart-drawer__close') || document.querySelector('.cart-drawer__close');
    if (closeBtn) closeBtn.click();
  });
  await page.waitForTimeout(800);

  const lenisStateAfterClose = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    htmlClass: document.documentElement.className,
    hasLenisStoppedClass: document.documentElement.classList.contains('lenis-stopped'),
    lenisIsStopped: window.__lenis ? window.__lenis.isStopped : null
  }));
  console.log('5. State after Cart is CLOSED:', lenisStateAfterClose);

  // 4. Try scrolling page now with mouse wheel!
  console.log('6. Attempting to scroll page with mouse wheel after closing cart...');
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);

  const scrollYAfterWheel = await page.evaluate(() => window.scrollY);
  console.log('7. Scroll Y after mouse wheel:', scrollYAfterWheel);

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  const scrollYAfterScrollTo = await page.evaluate(() => window.scrollY);
  console.log('8. Scroll Y after window.scrollTo(0, 600):', scrollYAfterScrollTo);

  await browser.close();
}

main().catch(console.error);
