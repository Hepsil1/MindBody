import fs from "fs";

const items = JSON.parse(fs.readFileSync("scratch/tg_parsed_catalog.json", "utf8"));

const targetIds = [2577, 2668, 2672, 2676, 2689, 2693, 2757, 2761, 2765, 3188, 3196, 3343];

for (const p of items) {
  if (targetIds.includes(p.postId)) {
    console.log(`\n=== Post ${p.postId} ===`);
    console.log(p.cleanDescription);
  }
}
