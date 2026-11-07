const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/restored_bg';
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await page.waitForTimeout(600);

  // Check if any canvas element exists or is running on home
  const canvasExists = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.smart-sun-particles');
    return !!canvas;
  });
  console.log('Canvas SmartSunParticles on Home:', canvasExists);

  // 1. Collections top
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '01_collections_restored.png') });

  // 2. Collections cards
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '02_cards_restored.png') });

  // 3. New arrivals
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '03_new_arrivals_restored.png') });

  // 4. About section
  await page.evaluate(() => window.scrollTo(0, 3100));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '04_about_restored.png') });

  // 5. Instagram section
  await page.evaluate(() => window.scrollTo(0, 4200));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '05_instagram_restored.png') });

  // 6. Transition to footer
  await page.evaluate(() => window.scrollTo(0, 5000));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, '06_footer_restored.png') });

  console.log('All restored screenshots taken!');
  await browser.close();
})();
