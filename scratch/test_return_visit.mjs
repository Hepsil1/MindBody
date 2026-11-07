import { chromium } from 'playwright';

async function testReturnVisit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. First visit (cold load)...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const firstVisitHasIntroSeen = await page.evaluate(() => {
    return sessionStorage.getItem('mb_intro_seen_v1');
  });
  console.log('First visit sessionStorage mb_intro_seen_v1:', firstVisitHasIntroSeen);

  console.log('2. Reloading in the same session (return visit)...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

  const returnVisitCheck = await page.evaluate(() => {
    const htmlHasClass = document.documentElement.classList.contains('mb-intro-done');
    const loadingScreen = document.querySelector('.loading-screen');
    const isHiddenByCss = loadingScreen ? window.getComputedStyle(loadingScreen).display === 'none' : true;
    return {
      htmlHasClass,
      hasLoadingScreenInDom: !!loadingScreen,
      isHiddenByCss
    };
  });
  console.log('Return visit check immediately at domcontentloaded:', returnVisitCheck);

  if (!returnVisitCheck.htmlHasClass || !returnVisitCheck.isHiddenByCss) {
    throw new Error('Return visit failed: curtain was not hidden before first paint!');
  }

  console.log('✅ RETURN VISIT PASSED: No curtain flash on return visits!');
  await browser.close();
}

testReturnVisit().catch(err => {
  console.error(err);
  process.exit(1);
});
