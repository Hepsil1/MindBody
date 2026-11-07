import fs from "fs";

const items = JSON.parse(fs.readFileSync("scratch/tg_parsed_catalog.json", "utf8"));

console.log("No | Post | Name | Price | Shop / Cat | Fabric | Sleeve | Colors | Photos");
console.log("-".repeat(95));
items.forEach((p, i) => {
  console.log(
    `${(i + 1).toString().padStart(2)} | ` +
    `${p.postId.toString().padStart(4)} | ` +
    `${p.name.padEnd(25)} | ` +
    `${p.price.toString().padStart(4)} ₴ | ` +
    `${(p.shopPageSlug + '/' + p.category).padEnd(16)} | ` +
    `${(p.fabric || '-').padEnd(6)} | ` +
    `${(p.sleeve || '-').padEnd(10)} | ` +
    `${p.colors.join(',').padEnd(15)} | ` +
    `${p.photoCount} photos`
  );
});
