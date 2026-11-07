import fs from "fs";

/**
 * Crawl Telegram public channel web preview
 * URL: https://t.me/s/mindbody_sportwear
 */

async function fetchPage(before = null) {
  const url = before
    ? `https://t.me/s/mindbody_sportwear?before=${before}`
    : `https://t.me/s/mindbody_sportwear`;

  console.log(`Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  return await res.text();
}

function parsePostsFromHtml(html) {
  const posts = [];
  // Split messages by wrap
  const messageBlocks = html.split('<div class="tgme_widget_message_wrap');

  for (let i = 1; i < messageBlocks.length; i++) {
    const block = messageBlocks[i];

    // Post ID
    const postIdMatch = block.match(/data-post="mindbody_sportwear\/(\d+)"/);
    if (!postIdMatch) continue;
    const postId = parseInt(postIdMatch[1], 10);

    // Date
    const dateMatch = block.match(/<time datetime="([^"]+)"/);
    const date = dateMatch ? dateMatch[1] : null;

    // Text content
    const textMatch = block.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    let text = "";
    if (textMatch) {
      text = textMatch[1]
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#036;/g, "$")
        .replace(/<[^>]+>/g, "")
        .trim();
    }

    // Photos
    const photoUrls = [];
    const photoMatches = block.matchAll(/background-image:url\('([^']+)'\)/g);
    for (const pm of photoMatches) {
      const u = pm[1];
      if (!u.includes("telegram.org/img/emoji")) {
        photoUrls.push(u);
      }
    }

    // Video preview / doc thumb if any
    const videoMatches = block.matchAll(/class="tgme_widget_message_video_thumb"[^>]*background-image:url\('([^']+)'\)/g);
    for (const vm of videoMatches) {
      if (!vm[1].includes("telegram.org/img/emoji")) {
        photoUrls.push(vm[1]);
      }
    }

    // Grouped message ID
    const isGrouped = block.includes("tgme_widget_message_grouped");

    posts.push({
      postId,
      date,
      text,
      photoUrls,
      isGrouped,
    });
  }

  // Extract 'before' link for older posts
  const beforeMatch = html.match(/href="[^"]*before=(\d+)[^"]*"/);
  const nextBefore = beforeMatch ? parseInt(beforeMatch[1], 10) : null;

  return { posts, nextBefore };
}

async function run() {
  const allPosts = new Map();
  let currentBefore = null;
  const maxPages = 15; // Scrape up to 15 pages of catalog

  for (let page = 0; page < maxPages; page++) {
    try {
      const html = await fetchPage(currentBefore);
      const { posts, nextBefore } = parsePostsFromHtml(html);

      console.log(`Page ${page + 1}: found ${posts.length} messages, nextBefore: ${nextBefore}`);

      for (const p of posts) {
        if (!allPosts.has(p.postId)) {
          allPosts.set(p.postId, p);
        } else {
          // Merge photos if duplicate ID
          const existing = allPosts.get(p.postId);
          for (const pu of p.photoUrls) {
            if (!existing.photoUrls.includes(pu)) {
              existing.photoUrls.push(pu);
            }
          }
          if (!existing.text && p.text) {
            existing.text = p.text;
          }
        }
      }

      if (!nextBefore || nextBefore === currentBefore) {
        console.log("No more pages available.");
        break;
      }

      currentBefore = nextBefore;
      // Friendly delay
      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      console.error("Error crawling page:", e);
      break;
    }
  }

  // Merge grouped album messages (Telegram splits multi-photo posts into consecutive messages where only one has text)
  const sortedPosts = Array.from(allPosts.values()).sort((a, b) => a.postId - b.postId);
  
  // Consolidate albums
  const consolidated = [];
  let currentProduct = null;

  for (const post of sortedPosts) {
    const hasProductIndicators =
      post.text &&
      (post.text.includes("Модель") ||
        post.text.includes("грн") ||
        post.text.includes("💵") ||
        post.text.includes("📌") ||
        post.text.includes("🎨"));

    if (hasProductIndicators) {
      if (currentProduct) {
        consolidated.push(currentProduct);
      }
      currentProduct = {
        ...post,
        allPhotos: [...post.photoUrls],
        relatedPostIds: [post.postId],
      };
    } else if (currentProduct && post.photoUrls.length > 0 && !post.text) {
      // Album attachment to current product
      currentProduct.allPhotos.push(...post.photoUrls);
      currentProduct.relatedPostIds.push(post.postId);
    } else if (hasProductIndicators === false && post.text) {
      // Standalone non-product message (announcement, discount etc)
      if (currentProduct) {
        consolidated.push(currentProduct);
        currentProduct = null;
      }
      consolidated.push({
        ...post,
        allPhotos: [...post.photoUrls],
        relatedPostIds: [post.postId],
      });
    }
  }

  if (currentProduct) {
    consolidated.push(currentProduct);
  }

  console.log(`Total raw posts: ${sortedPosts.length}`);
  console.log(`Total consolidated items: ${consolidated.length}`);

  const productItems = consolidated.filter(
    (c) =>
      c.text &&
      (c.text.includes("грн") || c.text.includes("💵")) &&
      c.allPhotos.length > 0
  );

  console.log(`Verified product items with price & photo: ${productItems.length}`);

  fs.writeFileSync(
    "scratch/tg_products_scraped.json",
    JSON.stringify(productItems, null, 2),
    "utf8"
  );
  console.log("Saved verified products to scratch/tg_products_scraped.json");
}

run();
