import { chromium } from 'playwright';

async function testLayers() {
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

  const productCards = await page.$$('.product-card');
  console.log('Total .product-card elements found:', productCards.length);

  const card = productCards[0];
  if (!card) {
    console.error('No product card found');
    await browser.close();
    return;
  }

  const box = await card.boundingBox();
  console.log('Card bounding box:', box);

  // Scroll card into view
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const updatedBox = await card.boundingBox();
  console.log('Updated card box:', updatedBox);

  // Test what elements are returned at the center of the card
  const elements = await page.evaluate((b) => {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const els = document.elementsFromPoint(cx, cy);
    return els.map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      zIndex: window.getComputedStyle(el).zIndex
    }));
  }, updatedBox);

  console.log('Elements from point at card center:');
  console.log(JSON.stringify(elements, null, 2));

  await browser.close();
}

testLayers().catch(console.error);
