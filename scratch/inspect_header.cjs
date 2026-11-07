const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle' });

  const metrics = await page.evaluate(() => {
    const topBar = document.querySelector('.top-bar') || document.querySelector('.header-topbar');
    const header = document.querySelector('header');
    const headerContainer = document.querySelector('.header__container');
    const logo = document.querySelector('.header__logo') || document.querySelector('.header-logo');

    return {
      topBar: topBar
        ? {
            className: topBar.className,
            rect: topBar.getBoundingClientRect(),
            position: window.getComputedStyle(topBar).position,
            top: window.getComputedStyle(topBar).top,
            height: window.getComputedStyle(topBar).height,
            zIndex: window.getComputedStyle(topBar).zIndex,
          }
        : null,
      header: header
        ? {
            className: header.className,
            rect: header.getBoundingClientRect(),
            position: window.getComputedStyle(header).position,
            top: window.getComputedStyle(header).top,
            height: window.getComputedStyle(header).height,
            paddingTop: window.getComputedStyle(header).paddingTop,
            marginTop: window.getComputedStyle(header).marginTop,
            zIndex: window.getComputedStyle(header).zIndex,
          }
        : null,
      logo: logo
        ? {
            rect: logo.getBoundingClientRect(),
          }
        : null,
    };
  });

  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
})();
