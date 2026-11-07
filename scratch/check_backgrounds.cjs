const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotsDir = 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/backgrounds_audit';
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await page.waitForTimeout(600);

  // Get info about all main sections and their backgrounds
  const sections = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('#main-content');
    if (!main) return [];
    const elements = Array.from(main.querySelectorAll('section, .bw-unified-section, .ig-hyper, .shop-collections-group, footer'));
    return elements.map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        id: el.id,
        className: el.className,
        tagName: el.tagName,
        bg: cs.backgroundColor,
        bgImage: cs.backgroundImage,
        color: cs.color,
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height)
      };
    });
  });

  console.log('Sections audit:', JSON.stringify(sections, null, 2));

  // Take full page screenshot
  await page.screenshot({
    path: path.join(screenshotsDir, 'full_homepage.png'),
    fullPage: true
  });
  console.log('Full page captured');

  await browser.close();
})();
