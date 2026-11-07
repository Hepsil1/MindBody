import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  
  // Set cookie and localStorage
  await context.addCookies([
    { name: 'mb_locale', value: 'uk', domain: 'localhost', path: '/' }
  ]);
  await context.addInitScript(() => {
    localStorage.setItem('mb_cookies_consent_v1', 'accepted');
    sessionStorage.setItem('mb-intro-done', '1');
  });

  const page = await context.newPage();

  const brokenRequests = [];
  const brokenDomImages = [];
  const emptySections = [];
  const textAnomalies = [];

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    const isMedia = /\.(webp|avif|png|jpg|jpeg|svg|mp4)(\?.*)?$/i.test(url);
    if (status >= 400 && isMedia) {
      brokenRequests.push({ url, status, pageUrl: page.url() });
    }
  });

  // 1. Get all routes to test
  // First load home to discover PDP links and shop links
  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Discover all internal links
  const discoveredLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    return anchors
      .map(a => a.getAttribute('href'))
      .filter(href => href && href.startsWith('/') && !href.startsWith('/admin') && !href.startsWith('/api'));
  });

  const uniqueLinks = Array.from(new Set([
    '/',
    '/shop',
    '/shop/yoga',
    '/shop/sport',
    '/shop/dance',
    '/shop/casual',
    '/shop/kids',
    '/shop/yogatools',
    '/about',
    '/contacts',
    '/favorites',
    '/cart',
    '/reviews',
    ...discoveredLinks
  ]));

  console.log(`Discovered ${uniqueLinks.length} unique routes to audit.`);

  for (const route of uniqueLinks) {
    const fullUrl = `http://localhost:3000${route}`;
    // console.log(`Auditing: ${route}`);
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);

      // Check all DOM <img> elements
      const domImages = await page.evaluate((currRoute) => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const issues = [];
        for (const img of imgs) {
          const src = img.currentSrc || img.src;
          const rect = img.getBoundingClientRect();
          // Natural width 0 means it failed to load or has empty source
          if (!src || src === '' || img.naturalWidth === 0) {
            issues.push({
              route: currRoute,
              src: src || '<EMPTY>',
              alt: img.alt,
              className: img.className,
              renderedWidth: rect.width,
              renderedHeight: rect.height,
              visible: rect.width > 0 && rect.height > 0
            });
          }
        }
        return issues;
      }, route);

      for (const imgIssue of domImages) {
        brokenDomImages.push(imgIssue);
      }

      // Check text anomalies: lorem ipsum, undefined keys, 0 ₴
      const textIssues = await page.evaluate((currRoute) => {
        const bodyText = document.body.innerText;
        const issues = [];
        if (/lorem ipsum/i.test(bodyText)) {
          issues.push({ route: currRoute, issue: 'Lorem Ipsum found' });
        }
        const zeroPriceMatches = bodyText.match(/\b0\s*[₴$€]/g);
        if (zeroPriceMatches) {
          issues.push({ route: currRoute, issue: `Found zero price: ${zeroPriceMatches.join(', ')}` });
        }
        if (/undefined|\[object Object\]/i.test(bodyText)) {
          // Check if it's actual rendered text
          issues.push({ route: currRoute, issue: 'Suspicious "undefined" or "[object Object]" text' });
        }
        return issues;
      }, route);

      for (const txt of textIssues) {
        textAnomalies.push(txt);
      }

    } catch (err) {
      console.error(`Error loading ${route}:`, err.message);
    }
  }

  await browser.close();

  const report = {
    summary: {
      routesAudited: uniqueLinks.length,
      brokenMediaRequests: brokenRequests.length,
      brokenDomImages: brokenDomImages.length,
      textAnomalies: textAnomalies.length
    },
    brokenRequests,
    brokenDomImages,
    textAnomalies
  };

  fs.writeFileSync('scratch/media_audit_report.json', JSON.stringify(report, null, 2));
  console.log('\n=== AUDIT COMPLETE ===');
  console.log(`Routes Audited: ${report.summary.routesAudited}`);
  console.log(`Broken Media HTTP Requests (4xx/5xx): ${report.summary.brokenMediaRequests}`);
  console.log(`Broken DOM <img> elements (naturalWidth === 0): ${report.summary.brokenDomImages}`);
  console.log(`Text Anomalies: ${report.summary.textAnomalies}`);

  if (brokenRequests.length > 0) {
    console.log('\n--- Broken Media Requests: ---');
    console.table(brokenRequests);
  }
  if (brokenDomImages.length > 0) {
    console.log('\n--- Broken DOM Images: ---');
    console.table(brokenDomImages);
  }
  if (textAnomalies.length > 0) {
    console.log('\n--- Text Anomalies: ---');
    console.table(textAnomalies);
  }
}

main().catch(console.error);
