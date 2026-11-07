const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const tree = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('#main-content');
    return Array.from(main.children).map(c => {
      const cs = window.getComputedStyle(c);
      const innerSections = Array.from(c.querySelectorAll('section, [class*="section"]')).map(s => {
        const scs = window.getComputedStyle(s);
        return {
          tag: s.tagName,
          id: s.id,
          class: s.className,
          bg: scs.backgroundColor,
          bgImg: scs.backgroundImage !== 'none' ? scs.backgroundImage.slice(0, 40) : 'none'
        };
      });
      return {
        tag: c.tagName,
        id: c.id,
        class: c.className,
        bg: cs.backgroundColor,
        bgImg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 40) : 'none',
        innerCount: innerSections.length,
        innerSections
      };
    });
  });
  console.log(JSON.stringify(tree, null, 2));
  await browser.close();
})();
