const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:3000/p/legginsy-pro', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await page.waitForTimeout(500);

  const matrix = page.locator('.pdp-specs-matrix');
  await matrix.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/instagram_editorial/03_pdp_specs_matrix.png',
  });
  console.log('Saved 03_pdp_specs_matrix.png');
  await browser.close();
})();
