const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/backgrounds_audit';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await page.waitForTimeout(600);

  // 1. Transition: Hero to Features Bar
  await page.evaluate(() => window.scrollTo(0, 750));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't1_hero_to_features.png') });

  // 2. Transition: Features Bar to Collections Header
  await page.evaluate(() => window.scrollTo(0, 950));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't2_features_to_collections.png') });

  // 3. Collections cards area
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't3_collections_cards.png') });

  // 4. New arrivals / slider area
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't4_new_arrivals.png') });

  // 5. Transition: Collections to About
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't5_collections_to_about.png') });

  // 6. Transition: About to Instagram
  await page.evaluate(() => window.scrollTo(0, 3800));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't6_about_to_instagram.png') });

  // 7. Transition: Instagram to Footer
  await page.evaluate(() => window.scrollTo(0, 4800));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 't7_instagram_to_footer.png') });

  console.log('All transitions captured!');
  await browser.close();
})();
