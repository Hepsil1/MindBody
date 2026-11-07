import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  // Fresh context: no cookies, no localStorage
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Listen for layout shifts and console errors
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
    } catch (e) {
      console.error(e);
    }
  });

  const outDir = path.resolve('scratch/first_open_frames');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Navigating to http://localhost:3000/ ...');
  const start = Date.now();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

  // Take rapid screenshots to see what user sees
  const intervals = [100, 300, 600, 1000, 1500, 2500];
  for (const ms of intervals) {
    const elapsed = Date.now() - start;
    if (ms > elapsed) {
      await page.waitForTimeout(ms - elapsed);
    }
    await page.screenshot({ path: path.join(outDir, `frame_${ms}ms.png`) });
    console.log(`Captured frame at ~${ms}ms`);
  }

  // Extract layout shifts and long tasks
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
      hasLenis: !!window.__lenis,
      lenisStopped: window.__lenis?.isStopped
    };
  });

  console.log('--- DIAGNOSTIC RESULTS ---');
  console.log('Loading screen still present:', metrics.hasLoadingScreen, 'visible:', metrics.loadingScreenVisible);
  console.log('Language gate present:', metrics.hasLanguageGate, 'visible:', metrics.languageGateVisible);
  console.log('Cookie banner present:', metrics.hasCookieBanner);
  console.log('Lenis active:', metrics.hasLenis, 'stopped:', metrics.lenisStopped);
  console.log('Long tasks count:', metrics.longTasks.length, metrics.longTasks);
  console.log('CLS entries count:', metrics.clsEntries.length);
  for (const cls of metrics.clsEntries) {
    console.log(`CLS shift: ${cls.value.toFixed(4)} at ${cls.startTime.toFixed(1)}ms`, JSON.stringify(cls.sources));
  }

  await browser.close();
}

diagnose().catch(console.error);
