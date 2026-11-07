const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/typography_review';
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Dismiss loading screen and cookie banner
  await page.evaluate(() => {
    const ls = document.querySelector('.loading-screen');
    if (ls) ls.remove();
    const cb = document.querySelector('.cookie-banner');
    if (cb) cb.remove();
  });
  await page.waitForTimeout(600);

  // 1. Header nav pill over hero (unscrolled)
  await page.screenshot({
    path: path.join(screenshotsDir, '01_header_nav_hero.png'),
    clip: { x: 0, y: 0, width: 1440, height: 420 }
  });
  console.log('Captured 01_header_nav_hero.png');

  // 2. Open Mega Menu - YOGA
  await page.hover('.header__nav-item--mega:nth-child(1) .header__nav-link');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(screenshotsDir, '02_megamenu_yoga.png'),
    clip: { x: 200, y: 20, width: 1040, height: 600 }
  });
  console.log('Captured 02_megamenu_yoga.png');

  // 3. Open Mega Menu - SPORT
  await page.hover('.header__nav-item--mega:nth-child(2) .header__nav-link');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(screenshotsDir, '03_megamenu_sport.png'),
    clip: { x: 200, y: 20, width: 1040, height: 600 }
  });
  console.log('Captured 03_megamenu_sport.png');

  // 4. Open Mega Menu - DANCE
  await page.hover('.header__nav-item--mega:nth-child(3) .header__nav-link');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(screenshotsDir, '04_megamenu_dance.png'),
    clip: { x: 200, y: 20, width: 1040, height: 600 }
  });
  console.log('Captured 04_megamenu_dance.png');

  // 5. Open Mega Menu - CASUAL
  await page.hover('.header__nav-item--mega:nth-child(4) .header__nav-link');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(screenshotsDir, '05_megamenu_casual.png'),
    clip: { x: 200, y: 20, width: 1040, height: 600 }
  });
  console.log('Captured 05_megamenu_casual.png');

  // 6. Scrolled header
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(screenshotsDir, '06_header_nav_scrolled.png'),
    clip: { x: 0, y: 0, width: 1440, height: 160 }
  });
  console.log('Captured 06_header_nav_scrolled.png');

  await browser.close();
  console.log('Done capturing screenshots!');
})();
