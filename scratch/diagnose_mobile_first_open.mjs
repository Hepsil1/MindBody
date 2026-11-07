import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';

async function diagnoseMobile() {
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 14'];
  const context = await browser.newContext({
    ...iPhone,
    // No cookies, no storage
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__clsEntries = [];
    window.__longTasks = [];
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__clsEntries.push({
              value: entry.value,
              startTime: entry.startTime,
              sources: entry.sources ? entry.sources.map(s => ({
                node: s.node ? (s.node.className || s.node.nodeName) : null,
                currentRect: s.currentRect,
                previousRect: s.previousRect
              })) : []
            });
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      const ltObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
      ltObserver.observe({ type: 'longtask', buffered: true });
    } catch (e) {}
  });

  const outDir = path.resolve('scratch/mobile_first_open_frames');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Navigating to http://localhost:3000/ on Mobile...');
  const start = Date.now();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

  const intervals = [100, 300, 600, 1000, 1500, 2500];
  for (const ms of intervals) {
    const elapsed = Date.now() - start;
    if (ms > elapsed) {
      await page.waitForTimeout(ms - elapsed);
    }
    await page.screenshot({ path: path.join(outDir, `mobile_frame_${ms}ms.png`) });
    console.log(`Captured mobile frame at ~${ms}ms`);
  }

  const metrics = await page.evaluate(() => {
    return {
      clsEntries: window.__clsEntries || [],
      longTasks: window.__longTasks || [],
      scrollY: window.scrollY,
      hasLanguageGate: !!document.querySelector('.lang-gate'),
      languageGateVisible: document.querySelector('.lang-gate')?.classList.contains('lang-gate--visible'),
      hasCookieBanner: !!document.querySelector('.cookie-banner'),
      hasLoadingScreen: !!document.querySelector('.loading-screen'),
      loadingScreenVisible: !document.querySelector('.loading-screen')?.classList.contains('loading-screen--hidden'),
      headerHeight: document.querySelector('.header')?.getBoundingClientRect().height,
      heroHeight: document.querySelector('.hero-slider')?.getBoundingClientRect().height
    };
  });

  console.log('--- MOBILE DIAGNOSTIC RESULTS ---');
  console.log('Header height:', metrics.headerHeight, 'Hero height:', metrics.heroHeight);
  console.log('Loading screen still present:', metrics.hasLoadingScreen, 'visible:', metrics.loadingScreenVisible);
  console.log('Cookie banner present:', metrics.hasCookieBanner);
  console.log('Long tasks count:', metrics.longTasks.length, metrics.longTasks);
  console.log('CLS entries count:', metrics.clsEntries.length);
  for (const cls of metrics.clsEntries) {
    console.log(`Mobile CLS shift: ${cls.value.toFixed(4)} at ${cls.startTime.toFixed(1)}ms`, JSON.stringify(cls.sources));
  }

  await browser.close();
}

diagnoseMobile().catch(console.error);
