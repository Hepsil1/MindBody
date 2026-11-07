import fs from "fs";

const items = JSON.parse(fs.readFileSync("scratch/tg_products_scraped.json", "utf8"));
console.log(`Loaded ${items.length} verified products.`);

const samples = items.slice(0, 10);
for (const [idx, item] of samples.entries()) {
  console.log(`\n--- Item ${idx + 1} [Post ${item.postId}] (${item.allPhotos.length} photos) ---`);
  console.log(item.text);
}
