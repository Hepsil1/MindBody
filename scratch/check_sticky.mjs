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

  await page.goto('http://localhost:3000/shop/yoga', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Scroll page down 400px (still inside product grid)
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);

  const check1 = await page.evaluate(() => {
    const aside = document.querySelector('.mb-shop-sidebar');
    const rect = aside.getBoundingClientRect();
    const grid = document.querySelector('.luxe-grid').getBoundingClientRect();
    return {
      windowScrollY: window.scrollY,
      asideTop: rect.top,
      gridTop: grid.top,
      gridHeight: grid.height,
      asideHeight: rect.height,
    };
  });
  console.log('Scroll 400px check:', check1);

  // Scroll page down 800px (still inside product grid)
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);

  const check2 = await page.evaluate(() => {
    const aside = document.querySelector('.mb-shop-sidebar');
    const rect = aside.getBoundingClientRect();
    return {
      windowScrollY: window.scrollY,
      asideTop: rect.top,
    };
  });
  console.log('Scroll 800px check:', check2);

  await browser.close();
}

main().catch(console.error);
