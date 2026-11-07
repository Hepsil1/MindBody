import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Use a low viewport height (1440x700) to explicitly test overflow and internal scroll
  const context = await browser.newContext({ viewport: { width: 1440, height: 700 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  const outDir = 'screenshots/sidebar_redesign';
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Navigating to http://localhost:3000/shop/yoga...');
  await page.goto('http://localhost:3000/shop/yoga', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  // Take screenshot of initial state
  await page.screenshot({ path: path.join(outDir, '01_desktop_initial_low_viewport.png') });

  // Check sidebar elements
  const sidebar = page.locator('.mb-shop-sidebar');
  const isSidebarVisible = await sidebar.isVisible();
  console.log('Sidebar is visible:', isSidebarVisible);

  // Check sticky positioning
  const stickyCheck = await sidebar.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      position: style.position,
      top: style.top,
      overflowY: style.overflowY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      hasOverflow: el.scrollHeight > el.clientHeight,
      hasLenisPrevent: el.hasAttribute('data-lenis-prevent')
    };
  });
  console.log('Sidebar sticky & scroll check:', stickyCheck);

  // Scroll down INSIDE the sidebar
  const initialScrollTop = await sidebar.evaluate((el) => el.scrollTop);
  await sidebar.hover();
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);

  const afterScrollTop = await sidebar.evaluate((el) => el.scrollTop);
  console.log(`Sidebar scrollTop: initial=${initialScrollTop}, after wheel=${afterScrollTop}`);

  // Scroll all the way to bottom of sidebar
  await sidebar.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(500);

  // Check if Price accordion is fully visible
  const priceAccordion = page.locator('.mb-shop-sidebar .filter-accordion:has-text("ЦІНА"), .mb-shop-sidebar .filter-accordion:has-text("ЦЕНА")');
  const isPriceVisible = await priceAccordion.isVisible();
  console.log('Price section is visible at bottom:', isPriceVisible);

  await page.screenshot({ path: path.join(outDir, '02_sidebar_scrolled_to_price.png') });

  // Test selecting a size chip
  const sizeChip = page.locator('.mb-shop-sidebar .mb-size-chip:not(.is-disabled)').first();
  const sizeText = await sizeChip.textContent();
  console.log(`Clicking size chip: "${sizeText?.trim()}"...`);
  await sizeChip.click();
  await page.waitForTimeout(500);

  // Check if Reset button appeared in the sticky header
  const resetBtn = page.locator('.sidebar-reset-btn');
  const isResetVisible = await resetBtn.isVisible();
  console.log('Reset button in sticky header is visible:', isResetVisible);

  await page.screenshot({ path: path.join(outDir, '03_size_selected_with_reset_btn.png') });

  // Test page scroll with sticky sidebar alongside products
  await page.mouse.move(800, 300); // Move cursor to product grid area
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(600);

  const pageScrollCheck = await page.evaluate(() => {
    const aside = document.querySelector('.mb-shop-sidebar');
    const asideRect = aside ? aside.getBoundingClientRect() : null;
    return {
      windowScrollY: window.scrollY,
      asideBoundingTop: asideRect ? asideRect.top : null,
      isStickyInView: asideRect ? asideRect.top >= 0 && asideRect.top <= 120 : false
    };
  });
  console.log('Page scroll check (sticky validation):', pageScrollCheck);

  await page.screenshot({ path: path.join(outDir, '04_page_scrolled_sticky_sidebar.png') });

  // Mobile drawer test (390x844 iPhone 14)
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript(() => {
    localStorage.setItem('mb_locale_selected_v1', 'uk');
    localStorage.setItem('mb_cookies_consent_v1', JSON.stringify({ analytics: true, marketing: false, acceptedAt: Date.now() }));
    document.cookie = 'mb_locale=uk; path=/; max-age=31536000';
  });

  await mobilePage.goto('http://localhost:3000/shop/yoga', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(500);

  // Click mobile filter button
  const mobileFilterBtn = mobilePage.locator('.mobile-filter-btn');
  await mobileFilterBtn.click();
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({ path: path.join(outDir, '05_mobile_filter_drawer_open.png') });

  await browser.close();
  console.log('All Playwright tests completed successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
