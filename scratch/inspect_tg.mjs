import fs from "fs";

const html = fs.readFileSync("scratch/tg_sample.html", "utf8");

const textMatches = [...html.matchAll(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
console.log("Total text matches in html:", textMatches.length);
textMatches.forEach((m, idx) => {
  const text = m[1].replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  console.log(`\n--- Text block ${idx + 1} ---`);
  console.log(text);
});

