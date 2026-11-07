const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/instagram_editorial';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop 1440x900
  const pageDesktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await pageDesktop.goto('http://localhost:3000/#instagram', { waitUntil: 'networkidle' });
  await pageDesktop.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await pageDesktop.waitForTimeout(600);

  const section = pageDesktop.locator('#instagram');
  await section.scrollIntoViewIfNeeded();
  await pageDesktop.waitForTimeout(400);

  await section.screenshot({ path: path.join(screenshotsDir, '01_instagram_editorial_desktop.png') });
  console.log('Saved 01_instagram_editorial_desktop.png');

  // 2. Mobile 390x844 (iPhone 14)
  const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pageMobile.goto('http://localhost:3000/#instagram', { waitUntil: 'networkidle' });
  await pageMobile.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await pageMobile.waitForTimeout(600);

  const sectionMobile = pageMobile.locator('#instagram');
  await sectionMobile.scrollIntoViewIfNeeded();
  await pageMobile.waitForTimeout(400);

  await sectionMobile.screenshot({ path: path.join(screenshotsDir, '02_instagram_editorial_mobile.png') });
  console.log('Saved 02_instagram_editorial_mobile.png');

  await browser.close();
})();
