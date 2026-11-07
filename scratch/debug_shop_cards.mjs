import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cardImages = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.product-card'));
    return cards.map(c => {
      const name = c.querySelector('.product-card__title, .product-card__name')?.innerText;
      const imgs = Array.from(c.querySelectorAll('img')).map(img => ({
        src: img.src,
        currentSrc: img.currentSrc,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        loading: img.loading
      }));
      return { name, imgs };
    });
  });

  console.log('Total cards on /shop:', cardImages.length);
  for (const card of cardImages) {
    for (const img of card.imgs) {
      if (img.naturalWidth === 0) {
        console.log(`ZERO WIDTH: Product "${card.name}" -> src: ${img.src}, currentSrc: ${img.currentSrc}, complete: ${img.complete}, loading: ${img.loading}`);
      }
    }
  }

  await browser.close();
}

main().catch(console.error);
