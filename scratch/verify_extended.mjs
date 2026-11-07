import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });

  // 1. Reduced motion ON test
  const rmContext = await browser.newContext({
    viewport: { width: 1440, height: 750 },
    reducedMotion: 'reduce'
  });
  const rmPage = await rmContext.newPage();
  await rmPage.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  await rmPage.goto('http://localhost:3000/shop/yoga', { waitUntil: 'networkidle' });
  await rmPage.waitForTimeout(400);

  // Toggle category accordion with reduced motion
  const catTrigger = rmPage.locator('.mb-shop-sidebar .accordion-trigger').first();
  await catTrigger.click();
  await rmPage.waitForTimeout(100);
  const isClosed = await rmPage.locator('.mb-shop-sidebar .filter-accordion').first().evaluate(el => !el.classList.contains('active'));
  console.log('Reduced motion accordion collapse verified:', isClosed);

  // 2. Mobile drawer (390px iPhone) test
  const mobContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobPage = await mobContext.newPage();
  await mobPage.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  await mobPage.goto('http://localhost:3000/shop/yoga', { waitUntil: 'networkidle' });
  await mobPage.waitForTimeout(400);

  // Open mobile drawer
  await mobPage.locator('.mobile-filter-btn').click();
  await mobPage.waitForTimeout(400);

  // Check if badges and reset button work inside mobile drawer
  const firstMobChip = mobPage.locator('.filter-drawer .mb-size-chip:not(.is-disabled)').first();
  await firstMobChip.click();
  await mobPage.waitForTimeout(300);

  const mobResetBtn = mobPage.locator('.filter-drawer__reset');
  const isMobResetVisible = await mobResetBtn.isVisible();
  console.log('Mobile drawer reset button visible after filter selection:', isMobResetVisible);

  await mobPage.screenshot({ path: 'screenshots/sidebar_redesign/06_mobile_drawer_filtered.png' });

  await browser.close();
  console.log('Extended checks completed successfully!');
}

main().catch(console.error);
