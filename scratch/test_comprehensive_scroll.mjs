import { chromium } from 'playwright';

async function testAll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  console.log('--- TEST 1: Navigation with lock clearing ---');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Open cart drawer
  await page.evaluate(() => {
    const btn = document.querySelector('.header__action-btn--cart');
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  
  // While cart drawer is open, navigate to a category page
  await page.goto('http://localhost:3000/uk/shop/yoga', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Check scroll state on new page
  let canScrollYoga = await page.evaluate(async () => {
    const initial = window.scrollY;
    window.scrollBy(0, 200);
    return {
      bodyOverflow: document.body.style.overflow,
      lenisStopped: window.__lenis?.isStopped ?? false,
      scrollY: window.scrollY
    };
  });
  console.log('After SPA navigation with open cart -> Yoga page state:', canScrollYoga);

  // Test wheel scroll on category page
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);
  const yogaScrolled = await page.evaluate(() => window.scrollY);
  console.log('Category page scroll Y after wheel:', yogaScrolled);

  console.log('--- TEST 2: PDP Modals and return ---');
  // Navigate to first product on yoga page
  await page.goto('http://localhost:3000/uk/p/kombinezon-asana', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Click Size Guide if present
  const sizeGuideBtn = await page.$('.pdp__size-guide-btn, [data-action="size-guide"], button:has-text("Розмірна сітка"), button:has-text("Таблиця розмірів")');
  if (sizeGuideBtn) {
    console.log('Found size guide button, clicking...');
    await sizeGuideBtn.click();
    await page.waitForTimeout(500);
    const duringModal = await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      lenisStopped: window.__lenis?.isStopped ?? false
    }));
    console.log('During size guide modal:', duringModal);

    // Close size guide modal (Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const afterModal = await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      lenisStopped: window.__lenis?.isStopped ?? false
    }));
    console.log('After size guide modal closed:', afterModal);

    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);
    const pdpScrolled = await page.evaluate(() => window.scrollY);
    console.log('PDP scroll Y after wheel:', pdpScrolled);
  } else {
    console.log('Size guide button not found, testing PDP wheel directly...');
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);
    console.log('PDP scroll Y:', await page.evaluate(() => window.scrollY));
  }

  console.log('--- TEST 3: Search overlay open and close ---');
  await page.goto('http://localhost:3000/uk', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const searchBtn = await page.$('.header__action-btn--search');
  if (searchBtn) {
    await searchBtn.click();
    await page.waitForTimeout(400);
    console.log('Search opened, state:', await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      lenisStopped: window.__lenis?.isStopped
    })));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    console.log('Search closed, state:', await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      lenisStopped: window.__lenis?.isStopped
    })));
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(400);
    console.log('Scroll Y after search wheel:', await page.evaluate(() => window.scrollY));
  }

  console.log('--- ALL SCROLL TESTS FINISHED SUCCESSFULLY ---');
  await browser.close();
}

testAll().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
