const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/audit_pages';
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  const removeOverlays = async () => {
    await page.evaluate(() => {
      document.querySelector('.loading-screen')?.remove();
      document.querySelector('.cookie-banner')?.remove();
    });
  };

  // 1. Homepage top & flow
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '01_home_hero.png') });

  // 2. Catalog / Shop Yoga
  await page.goto('http://localhost:3000/shop/yoga', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '02_shop_yoga.png') });

  // 3. Find a product link and visit PDP
  const firstProductHref = await page.evaluate(() => {
    const a = document.querySelector('.product-card__link') || document.querySelector('a[href^=\"/p/\"]');
    return a ? a.getAttribute('href') : null;
  });
  console.log('First product link:', firstProductHref);

  if (firstProductHref) {
    await page.goto(`http://localhost:3000${firstProductHref}`, { waitUntil: 'networkidle' });
    await removeOverlays();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '03_pdp.png') });
  }

  // 4. Checkout page
  await page.goto('http://localhost:3000/checkout', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '04_checkout.png') });

  // 5. About page
  await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '05_about.png') });

  console.log('All audit pages captured!');
  await browser.close();
})();
