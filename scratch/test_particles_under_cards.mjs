import { chromium } from 'playwright';

async function testParticles() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ accepted: true, at: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const card = (await page.$$('.product-card'))[1];
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Check computed z-index of card vs canvas
  const zIndices = await page.evaluate(() => {
    const cardEl = document.querySelectorAll('.product-card')[1];
    const canvas = document.querySelector('canvas.smart-sun-particles');
    return {
      cardZIndex: cardEl ? window.getComputedStyle(cardEl).zIndex : null,
      cardPosition: cardEl ? window.getComputedStyle(cardEl).position : null,
      cardBg: cardEl ? window.getComputedStyle(cardEl).backgroundColor : null,
      canvasZIndex: canvas ? window.getComputedStyle(canvas).zIndex : null,
      canvasPosition: canvas ? window.getComputedStyle(canvas).position : null,
    };
  });
  console.log('Z-Index Comparison:', zIndices);

  // Take screenshot of card area
  await page.screenshot({ path: 'scratch/card_after_fix.png', clip: await card.boundingBox() });
  console.log('Saved scratch/card_after_fix.png');

  await browser.close();
}

testParticles().catch(console.error);
