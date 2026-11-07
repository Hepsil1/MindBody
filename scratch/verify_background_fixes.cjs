const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/verified_backgrounds';
  const fs = require('fs');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  const removeOverlays = async () => {
    await page.evaluate(() => {
      document.querySelector('.loading-screen')?.remove();
      document.querySelector('.cookie-banner')?.remove();
    });
  };

  // 1. PDP Header
  await page.goto('http://localhost:3000/p/longsliv-calm', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '01_pdp_fixed_header.png') });
  console.log('01_pdp_fixed_header.png captured');

  // 2. About Header
  await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotsDir, '02_about_fixed_header.png') });
  console.log('02_about_fixed_header.png captured');

  // 3. Homepage Features Bar
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await removeOverlays();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 850));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '03_features_bar_seamless.png') });
  console.log('03_features_bar_seamless.png captured');

  // 4. Instagram Title
  await page.evaluate(() => window.scrollTo(0, 3950));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '04_instagram_editorial_title.png') });
  console.log('04_instagram_editorial_title.png captured');

  // 5. Instagram to Footer Transition
  await page.evaluate(() => window.scrollTo(0, 4900));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '05_instagram_to_footer_transition.png') });
  console.log('05_instagram_to_footer_transition.png captured');

  await browser.close();
  console.log('All verified screenshots ready!');
})();
