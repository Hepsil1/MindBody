import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });

  const brokenRequests = [];

  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'mobile_375', width: 375, height: 812 }
  ];

  for (const vp of viewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }
    });

    await context.addCookies([
      { name: 'mb_locale', value: 'uk', domain: 'localhost', path: '/' }
    ]);
    await context.addInitScript(() => {
      localStorage.setItem('mb_cookies_consent_v1', 'accepted');
      sessionStorage.setItem('mb-intro-done', '1');
    });

    const page = await context.newPage();

    page.on('response', r => {
      const isMedia = /\.(webp|avif|png|jpg|jpeg|svg|mp4)(\?.*)?$/i.test(r.url());
      if (r.status() >= 400 && isMedia) {
        brokenRequests.push({ vp: vp.name, url: r.url(), status: r.status(), page: page.url() });
      }
    });

    // 1. Visit Home
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Measure CLS on home page
    const cls = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        const observer = new PerformanceObserver(entryList => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 500);
      });
    });

    console.log(`[${vp.name}] Home CLS: ${cls}`);

    // Verify NewArrivalsEditorial section
    const editorialExists = await page.evaluate(() => {
      const sec = document.querySelector('.editorial-arrivals');
      if (!sec) return null;
      const flagship = sec.querySelector('.editorial-flagship');
      const cards = sec.querySelectorAll('.product-card');
      const counter = sec.querySelector('.editorial-arrivals__counter-badge')?.textContent;
      const title = sec.querySelector('.editorial-arrivals__title')?.textContent;

      // Check card z-index and background
      const firstCard = cards[0] || flagship;
      const computed = window.getComputedStyle(firstCard);
      const zIndex = computed.zIndex;
      const bg = computed.backgroundColor;

      return {
        hasSection: true,
        flagshipTitle: flagship?.querySelector('.editorial-flagship__name')?.textContent?.trim(),
        totalCards: cards.length,
        counter,
        title,
        cardZIndex: zIndex,
        cardBg: bg
      };
    });

    console.log(`[${vp.name}] Editorial section check:`, editorialExists);

    // Scroll to New Arrivals and screenshot
    const arrivalsEl = await page.$('.editorial-arrivals');
    if (arrivalsEl) {
      await arrivalsEl.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const shotPath = `scratch/arrivals_${vp.name}.png`;
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`[${vp.name}] Screenshot saved to ${shotPath}`);
    }

    // 2. Visit About
    console.log(`[${vp.name}] Visiting /about...`);
    await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 3. Visit Shop
    console.log(`[${vp.name}] Visiting /shop...`);
    await page.goto('http://localhost:3000/shop', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 4. Visit PDP
    console.log(`[${vp.name}] Visiting PDP /p/kombinezon-chinchilla-z-dovhym-rukavom...`);
    await page.goto('http://localhost:3000/p/kombinezon-chinchilla-z-dovhym-rukavom', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await context.close();
  }

  await browser.close();

  console.log('\n=== FINAL VERIFICATION RESULTS ===');
  console.log(`Total 4xx/5xx Broken Media Requests across all viewports: ${brokenRequests.length}`);
  if (brokenRequests.length > 0) {
    console.table(brokenRequests);
  } else {
    console.log('✅ ZERO BROKEN MEDIA ASSETS (0 broken requests)!');
  }
}

main().catch(console.error);
