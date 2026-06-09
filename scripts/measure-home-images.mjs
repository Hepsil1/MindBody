import { webkit, devices } from "@playwright/test";

const browser = await webkit.launch();
const ctx = await browser.newContext(devices["iPhone 14"]);
const page = await ctx.newPage();

const masters = [];
const variants = [];

page.on("response", async (r) => {
    const url = r.url();
    if (!/\.(webp|jpg|jpeg|png)$/i.test(url)) return;
    const size = parseInt(r.headers()["content-length"] || "0", 10);
    const status = r.status();
    if (/\d{3,4}w\.webp$/.test(url)) {
        variants.push({ url: url.split("/").pop(), size, status });
    } else {
        masters.push({ url: url.split("/").pop(), size, status });
    }
});

await page.goto("https://saleid.icu/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

const masterTotal = masters.reduce((s, m) => s + m.size, 0);
const variantTotal = variants.reduce((s, v) => s + v.size, 0);

console.log("\n=== MASTER images loaded ===");
masters.forEach((m) => console.log(`  ${m.status}  ${(m.size / 1024).toFixed(1)} KB  ${m.url}`));
console.log(`  Subtotal: ${masters.length} files, ${(masterTotal / 1024).toFixed(1)} KB`);

console.log("\n=== VARIANT images loaded ===");
variants.forEach((v) => console.log(`  ${v.status}  ${(v.size / 1024).toFixed(1)} KB  ${v.url}`));
console.log(`  Subtotal: ${variants.length} files, ${(variantTotal / 1024).toFixed(1)} KB`);

console.log(
    `\n=== TOTAL: ${((masterTotal + variantTotal) / 1024).toFixed(1)} KB across ${masters.length + variants.length} files ===`,
);

await browser.close();
