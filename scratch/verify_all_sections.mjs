import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Preset cookies/storage to skip gates
  await page.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  const routes = [
    { name: 'yoga', url: 'http://localhost:3000/shop/yoga' },
    { name: 'sport', url: 'http://localhost:3000/shop/sport' },
    { name: 'kids', url: 'http://localhost:3000/shop/kids' },
    { name: 'casual', url: 'http://localhost:3000/shop/casual' }
  ];

  const results = [];
  const outDir = 'screenshots/tg_catalog_sections';
  fs.mkdirSync(outDir, { recursive: true });

  for (const r of routes) {
    const failedUrls = [];
    const responseStatuses = [];

    const onReqFailed = (req) => {
      const url = req.url();
      if (!url.includes('google-analytics') && !url.includes('mc.yandex')) {
        failedUrls.push(`${req.failure()?.errorText || 'failed'}: ${url}`);
      }
    };

    const onResp = (res) => {
      const status = res.status();
      const url = res.url();
      if (status >= 400 && !url.includes('favicon') && !url.includes('google-analytics')) {
        responseStatuses.push(`${status} ${url}`);
      }
    };

    page.on('requestfailed', onReqFailed);
    page.on('response', onResp);

    console.log(`Checking ${r.name} (${r.url})...`);
    const resp = await page.goto(r.url, { waitUntil: 'networkidle', timeout: 15000 });
    const httpStatus = resp ? resp.status() : 0;

    await page.waitForTimeout(500);

    const productCards = await page.$$eval('.product-card', (cards) => cards.map(c => {
      const title = c.querySelector('.product-card-title, h3, .product-title')?.textContent?.trim() || '';
      const price = c.querySelector('.product-card-price, .price, .product-price')?.textContent?.trim() || '';
      return { title, price };
    }));

    const screenshotPath = path.join(outDir, `${r.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    results.push({
      section: r.name,
      status: httpStatus,
      productsCount: productCards.length,
      sampleProducts: productCards.slice(0, 3),
      errors404: responseStatuses,
      failedRequests: failedUrls
    });

    page.off('requestfailed', onReqFailed);
    page.off('response', onResp);
  }

  console.log('\n--- VERIFICATION RESULTS ---');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
