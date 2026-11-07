const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // 1. PDP Clean First Screen
  const pdpPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await pdpPage.goto('http://localhost:3000/p/legginsy-pro', { waitUntil: 'networkidle' });
  await pdpPage.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await pdpPage.waitForTimeout(500);
  await pdpPage.screenshot({
    path: 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/instagram_editorial/04_pdp_clean_first_screen.png',
  });
  console.log('Saved 04_pdp_clean_first_screen.png');

  // 2. Instagram Editorial Section
  const homePage = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await homePage.goto('http://localhost:3000/#instagram', { waitUntil: 'networkidle' });
  await homePage.evaluate(() => {
    document.querySelector('.loading-screen')?.remove();
    document.querySelector('.cookie-banner')?.remove();
  });
  await homePage.waitForTimeout(600);
  const igSec = homePage.locator('#instagram');
  await igSec.scrollIntoViewIfNeeded();
  await homePage.waitForTimeout(400);
  await igSec.screenshot({
    path: 'C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1/screenshots/instagram_editorial/05_instagram_editorial_final.png',
  });
  console.log('Saved 05_instagram_editorial_final.png');

  await browser.close();
})();
