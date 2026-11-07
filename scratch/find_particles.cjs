const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  const elements = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll("*").forEach(el => {
      const cls = typeof el.className === "string" ? el.className : "";
      const id = el.id || "";
      if (
        cls.includes("sun") ||
        cls.includes("particle") ||
        cls.includes("pattern") ||
        cls.includes("float") ||
        id.includes("sun") ||
        el.tagName === "CANVAS" ||
        (el.tagName === "svg" && (cls || id))
      ) {
        const rect = el.getBoundingClientRect();
        list.push({
          tag: el.tagName,
          id,
          class: cls,
          top: Math.round(rect.top + window.scrollY),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    });
    return list;
  });

  console.log("Elements found:", JSON.stringify(elements, null, 2));
  await browser.close();
})();
