import fs from "fs";

const rawProducts = JSON.parse(fs.readFileSync("scratch/tg_products_scraped.json", "utf8"));

// Color map dictionary
const COLOR_TRANSLATE = {
  "чорний": "black",
  "чорному": "black",
  "білий": "white",
  "білому": "white",
  "айворі": "cream",
  "молочний": "cream",
  "кремовий": "cream",
  "бежевий": "beige",
  "латте": "beige",
  "капучино": "beige",
  "мокко": "beige",
  "бургунді": "marsala",
  "марсала": "marsala",
  "виноград": "marsala",
  "червоний": "red",
  "шоколад": "brown",
  "синій": "blue",
  "електрик": "blue",
  "крило ворона": "navy",
  "блакитний": "blue",
  "ніжно-блакитний": "blue",
  "ніжно- блакитний": "blue",
  "зелений": "green",
  "нефріт": "green",
  "смарагд": "green",
  "малахіт": "green",
  "м'ятний": "mint",
  "мʼятний": "mint",
  "графіт": "gray",
  "сірий": "gray",
  "фіалка": "purple",
  "лавандовий": "lavender",
  "лаванда": "lavender",
  "ультрафіолет": "purple",
  "рожевий": "pink",
  "пудра": "pink",
  "жовтий": "yellow",
  "гірчиця": "yellow",
  "помаранчевий": "orange",
  "теракот": "orange",
  "хакі": "green",
  "оливка": "green",
};

function parseItem(item) {
  const text = item.text || "";

  // 1. Title / Model name
  let name = "";
  const quoteMatch = text.match(/[«"“]([^»"”]+)[»"”]/);
  const modelName = quoteMatch ? quoteMatch[1].trim() : "";

  if (/сорочк/i.test(text)) {
    name = modelName ? `Сорочка «${modelName}»` : "Сорочка FEEL FREE";
  } else if (/худі|світшот/i.test(text)) {
    name = modelName ? `Худі «${modelName}»` : "Худі EASE";
  } else if (/джогер/i.test(text)) {
    name = modelName ? `Джогери «${modelName}»` : "Джогери FLOW";
  } else if (/комплект.*льон/i.test(text)) {
    name = "Комплект лляний";
  } else if (/комплект/i.test(text)) {
    name = "Комплект бавовняний";
  } else if (/дитяч|kids|#мамадонька/i.test(text)) {
    name = modelName ? `Дитячий комбінезон «${modelName}»` : "Дитячий комбінезон";
  } else if (modelName) {
    if (/#velo|velo/i.test(text) && !/velo/i.test(modelName)) {
      name = `Комбінезон «${modelName} VELO»`;
    } else if (/#рукав|довгим рукавом/i.test(text)) {
      name = `Комбінезон «${modelName}» з довгим рукавом`;
    } else if (/#футболк|рукавом футболкою/i.test(text)) {
      name = `Комбінезон «${modelName}» рукав-футболка`;
    } else {
      name = `Комбінезон «${modelName}»`;
    }
  } else if (/BUTTERFLY/i.test(text)) {
    name = "Комбінезон «BUTTERFLY»";
  } else if (/ICE CREAM/i.test(text)) {
    name = "Комбінезон «ICE CREAM»";
  } else if (/GUERLAIN/i.test(text)) {
    name = "Комбінезон «GUERLAIN»";
  } else {
    name = `Комбінезон MindBody ${item.postId}`;
  }

  // 2. Price
  let price = 0;
  const priceMatch = text.match(/(?:💵|Ціна:?)\s*([0-9\s]+)(?:грн|\/)/i);
  if (priceMatch) {
    const digits = priceMatch[1].replace(/\s+/g, "");
    price = parseInt(digits, 10);
  } else {
    // Try any number followed by грн
    const грнMatch = text.match(/([0-9\s]{3,6})\s*грн/i);
    if (грнMatch) {
      price = parseInt(грнMatch[1].replace(/\s+/g, ""), 10);
    }
  }

  // 3. Sizes
  const sizes = [];
  const sizeMatch = text.match(/📌\s*([^\n\r]+)/);
  if (sizeMatch) {
    const sStr = sizeMatch[1];
    if (/XXS/i.test(sStr) && /XL/i.test(sStr)) {
      sizes.push("XXS", "XS", "S", "M", "L", "XL");
    } else if (/XS/i.test(sStr) && /XL/i.test(sStr)) {
      sizes.push("XS", "S", "M", "L", "XL");
    } else if (/XS/i.test(sStr) && /L/i.test(sStr)) {
      sizes.push("XS", "S", "M", "L");
    } else if (/XS/i.test(sStr) && /M/i.test(sStr)) {
      sizes.push("XS", "S", "M");
    } else if (/S/i.test(sStr) && /L/i.test(sStr)) {
      sizes.push("S", "M", "L");
    } else if (/104/i.test(sStr) || /см/i.test(sStr)) {
      sizes.push("104-110", "116-122", "128-134", "140-146", "152-158");
    } else {
      // Split by comma
      const parts = sStr.split(/[,/]/).map((s) => s.trim().toUpperCase());
      for (const p of parts) {
        if (p.length > 0 && p.length < 8) sizes.push(p);
      }
    }
  }
  if (sizes.length === 0) {
    sizes.push("XS", "S", "M", "L");
  }

  // 4. Fabric
  let fabric = null;
  const fabricMatch = text.match(/✂️\s*([^\n\r]+)/);
  const fText = (fabricMatch ? fabricMatch[1] : "") + " " + text;
  if (/бавовн|хлопок|фланель|льон/i.test(fText)) {
    fabric = "cotton";
  } else if (/біфлекс|спорт|бифлекс|рубчик|еластан/i.test(fText)) {
    fabric = "sport";
  } else {
    fabric = /спорт/i.test(text) ? "sport" : "cotton";
  }

  // 5. Sleeve
  let sleeve = null;
  if (/#рукав|довгим рукавом/i.test(text)) {
    sleeve = "long";
  } else if (/#майка|без рукава|відкрита спинка|переплетінням/i.test(text)) {
    sleeve = "sleeveless";
  } else if (/#футболк|рукавом футболкою/i.test(text)) {
    sleeve = "short";
  } else if (/#velo|вело/i.test(text)) {
    sleeve = "velo";
  } else {
    sleeve = "sleeveless";
  }

  // 6. Colors
  const colors = [];
  const colorMatch = text.match(/🎨\s*([^\n\r]+)/);
  if (colorMatch) {
    const rawColors = colorMatch[1].toLowerCase().split(/[,;.\/]/);
    for (let c of rawColors) {
      c = c.replace(/кольори\s*:/g, "").trim();
      for (const [ukr, slug] of Object.entries(COLOR_TRANSLATE)) {
        if (c.includes(ukr)) {
          if (!colors.includes(slug)) colors.push(slug);
          break;
        }
      }
    }
  }
  if (colors.length === 0) {
    colors.push("black");
  }

  // 7. Shop & Category
  let shopPageSlug = "yoga";
  let category = "jumpsuit";

  if (/сорочк/i.test(text)) {
    shopPageSlug = "casual";
    category = "shirts";
  } else if (/худі|світшот/i.test(text)) {
    shopPageSlug = "casual";
    category = "hoodies";
  } else if (/джогер/i.test(text)) {
    shopPageSlug = "casual";
    category = "joggers";
  } else if (/дитяч|#kids|#мамадонька/i.test(text)) {
    shopPageSlug = "kids";
    category = "jumpsuit";
  } else if (/топ/i.test(text)) {
    shopPageSlug = fabric === "cotton" ? "yoga" : "sport";
    category = "tops";
  } else if (/лосин|легінс/i.test(text)) {
    shopPageSlug = fabric === "cotton" ? "yoga" : "sport";
    category = "leggings";
  } else if (/вело/i.test(text)) {
    shopPageSlug = fabric === "cotton" ? "yoga" : "sport";
    category = "velo";
  } else {
    // Default jumpsuits
    shopPageSlug = fabric === "cotton" ? "yoga" : "sport";
    category = "jumpsuit";
  }

  // 8. Description: clean out emoji lines & hashtags & delivery references
  const cleanDescription = text
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("📌") &&
        !line.startsWith("✂️") &&
        !line.startsWith("🎨") &&
        !line.startsWith("💵") &&
        !line.startsWith("#") &&
        !line.includes("Ціна:") &&
        !line.includes("доставка") &&
        !line.includes("партії")
    )
    .join("\n")
    .trim();

  return {
    postId: item.postId,
    date: item.date,
    name,
    price,
    shopPageSlug,
    category,
    fabric,
    sleeve,
    sizes,
    colors,
    cleanDescription,
    photoCount: item.allPhotos.length,
    photos: item.allPhotos,
  };
}

const parsed = rawProducts.map(parseItem);

// Deduplicate by name & price
const dedupMap = new Map();
for (const p of parsed) {
  const key = `${p.name}_${p.price}`;
  if (!dedupMap.has(key)) {
    dedupMap.set(key, p);
  } else {
    // Merge photos
    const existing = dedupMap.get(key);
    for (const ph of p.photos) {
      if (!existing.photos.includes(ph)) existing.photos.push(ph);
    }
    existing.photoCount = existing.photos.length;
  }
}

const finalProducts = Array.from(dedupMap.values()).filter((p) => p.price > 0 && p.photoCount > 0);

console.log(`\n=================== PARSED & DEDUPLICATED CATALOG ===================`);
console.log(`Total unique high-quality products: ${finalProducts.length}`);

// Group by Shop & Category
const stats = {};
for (const p of finalProducts) {
  const k = `${p.shopPageSlug} / ${p.category}`;
  stats[k] = (stats[k] || 0) + 1;
}

console.log("\nDistribution by Category:");
console.table(stats);

fs.writeFileSync("scratch/tg_parsed_catalog.json", JSON.stringify(finalProducts, null, 2), "utf8");
console.log("\nSaved parsed catalog to scratch/tg_parsed_catalog.json");
