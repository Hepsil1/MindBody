/**
 * Telegram Catalog Importer & Cleanup Tool
 * MindBody Sportswear
 *
 * Usage:
 *   node scripts/tg-import.mjs --dry-run
 *   node scripts/tg-import.mjs --apply --limit 1
 *   node scripts/tg-import.mjs --apply
 *   node scripts/tg-import.mjs --cleanup --dry-run
 *   node scripts/tg-import.mjs --cleanup
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { slugify } from "../app/utils/slugify.js";
import { generateUploadVariants } from "../app/utils/image-variants.server.js";
import { publishBlockers } from "../app/utils/productQuality.js";

// Avoid Windows file locking
sharp.cache(false);

const prisma = new PrismaClient();
const CATALOG_PATH = path.join(process.cwd(), "scratch", "tg_parsed_catalog.json");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const LQIP_PATH = path.join(process.cwd(), "public", "lqip.json");

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isApply = args.includes("--apply");
const isCleanup = args.includes("--cleanup");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
// --only 2757,3188 → import just these Telegram post ids (keeps already-imported products untouched)
const onlyIdx = args.indexOf("--only");
const onlyIds =
    onlyIdx !== -1
        ? new Set(args[onlyIdx + 1].split(",").map((s) => parseInt(s.trim(), 10)))
        : null;

async function cleanup() {
    console.log(`\n=================== CLEANUP TG PRODUCTS ===================`);
    console.log(`Mode: ${isDryRun ? "DRY-RUN (no changes will be made)" : "LIVE APPLY"}`);

    // Find all TG products
    const tgProducts = await prisma.product.findMany({
        where: { sku: { startsWith: "TG-" } },
        select: { id: true, name: true, sku: true, slug: true, images: true },
    });

    console.log(`Found ${tgProducts.length} TG products in database.`);

    const filesToDelete = new Set();
    const lqipKeysToDelete = new Set();

    for (const p of tgProducts) {
        let imgs = [];
        try {
            imgs = p.images ? JSON.parse(p.images) : [];
        } catch {
            /* ignore */
        }

        for (const imgUrl of imgs) {
            lqipKeysToDelete.add(imgUrl);
            const filename = path.basename(imgUrl);
            const baseName = filename.replace(/\.webp$/i, "");

            // Match master .webp, .avif, and all variants
            if (fs.existsSync(UPLOADS_DIR)) {
                const matchingFiles = fs
                    .readdirSync(UPLOADS_DIR)
                    .filter((f) => f.startsWith(baseName));
                for (const mf of matchingFiles) {
                    filesToDelete.add(path.join(UPLOADS_DIR, mf));
                }
            }
        }
    }

    console.log(`Found ${filesToDelete.size} associated image/variant files on disk.`);

    if (isDryRun) {
        console.log("Dry-run complete. Products that would be deleted:");
        tgProducts.forEach((p) => console.log(`  - [${p.sku}] ${p.name} (/p/${p.slug})`));
        console.log(`Image files that would be deleted: ${filesToDelete.size}`);
        return;
    }

    // Delete from DB
    const deleteRes = await prisma.product.deleteMany({
        where: { sku: { startsWith: "TG-" } },
    });
    console.log(`Deleted ${deleteRes.count} products from database.`);

    // Delete files from disk
    let deletedFiles = 0;
    for (const f of filesToDelete) {
        try {
            if (fs.existsSync(f)) {
                fs.unlinkSync(f);
                deletedFiles++;
            }
        } catch (e) {
            console.warn(`Could not delete ${f}:`, e.message);
        }
    }
    console.log(`Deleted ${deletedFiles} image/variant files from public/uploads.`);

    // Clean LQIP entries
    if (fs.existsSync(LQIP_PATH)) {
        try {
            const lqipMap = JSON.parse(fs.readFileSync(LQIP_PATH, "utf8"));
            let lqipCleaned = 0;
            for (const k of lqipKeysToDelete) {
                if (k in lqipMap) {
                    delete lqipMap[k];
                    lqipCleaned++;
                }
            }
            fs.writeFileSync(LQIP_PATH, JSON.stringify(lqipMap, null, 2), "utf8");
            console.log(`Removed ${lqipCleaned} entries from public/lqip.json.`);
        } catch (e) {
            console.warn("Could not clean lqip.json:", e.message);
        }
    }

    console.log("Cleanup complete!");
}

async function downloadAndProcessImage(url, filenameBase, index) {
    const filename = `${filenameBase}_${index}.webp`;
    const absWebpPath = path.join(UPLOADS_DIR, filename);
    const publicUrl = `/uploads/${filename}`;

    // If already exists, return publicUrl
    if (fs.existsSync(absWebpPath)) {
        return publicUrl;
    }

    // Fetch from Telegram CDN
    const res = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to download image ${url}: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Resize and save master WebP
    await sharp(buffer)
        .resize({ width: 1600, height: 2133, withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 85, effort: 4 })
        .toFile(absWebpPath);

    // Generate AVIF master, responsive variants (-400w, -800w, -1200w, etc) and LQIP
    await generateUploadVariants(absWebpPath, publicUrl);

    return publicUrl;
}

async function importCatalog() {
    if (!fs.existsSync(CATALOG_PATH)) {
        console.error(`Catalog file not found: ${CATALOG_PATH}`);
        process.exit(1);
    }

    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    console.log(`Loaded ${catalog.length} items from ${CATALOG_PATH}`);

    const itemsToProcess = (onlyIds ? catalog.filter((c) => onlyIds.has(c.postId)) : catalog).slice(
        0,
        limit,
    );
    console.log(`Processing ${itemsToProcess.length} items (limit: ${limit})`);
    console.log(`Mode: ${isDryRun ? "DRY-RUN (validation only)" : "LIVE APPLY"}\n`);

    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const summary = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        const sku = `TG-${item.postId}`;
        let baseSlug = slugify(item.name);
        if (!baseSlug) baseSlug = `tg-product-${item.postId}`;

        // Ensure unique slug
        let finalSlug = baseSlug;
        let collisionCount = 1;
        while (true) {
            const existing = await prisma.product.findUnique({
                where: { slug: finalSlug },
                select: { id: true, sku: true },
            });
            if (!existing || existing.sku === sku) {
                break;
            }
            collisionCount++;
            finalSlug = `${baseSlug}-${collisionCount}`;
        }

        // Build inventory: 1 item per (size x color)
        const inventory = [];
        for (const size of item.sizes) {
            for (const color of item.colors) {
                inventory.push({ size, color, stock: 1 });
            }
        }
        const totalStock = inventory.length;

        // Quality gate validation
        const qualityInput = {
            price: item.price,
            imagesCount: item.photoCount,
            category: item.category,
            shopPageSlug: item.shopPageSlug,
            stock: totalStock,
            fabric: item.fabric || "",
            sleeve: item.sleeve || "",
        };

        const blockers = publishBlockers(qualityInput);
        const isQualityOk = blockers.length === 0;

        summary.push({
            post: item.postId,
            name: item.name,
            slug: finalSlug,
            price: `${item.price} ₴`,
            shop: `${item.shopPageSlug} / ${item.category}`,
            fabric: item.fabric || "none",
            sleeve: item.sleeve || "none",
            sizes: item.sizes.join(","),
            colors: item.colors.join(","),
            variantsCount: totalStock,
            photosCount: item.photoCount,
            qualityStatus: isQualityOk ? "READY" : `BLOCKED (${blockers.join("; ")})`,
        });

        if (isDryRun) {
            continue;
        }

        // APPLY: Download images (up to 6 per product)
        console.log(
            `[${i + 1}/${itemsToProcess.length}] Processing "${item.name}" (SKU: ${sku})...`,
        );
        const imageUrls = [];
        const maxPhotos = Math.min(item.photos.length, 6);
        const filenameBase = `tg_${item.postId}`;

        for (let pIdx = 0; pIdx < maxPhotos; pIdx++) {
            const photoUrl = item.photos[pIdx];
            try {
                const publicUrl = await downloadAndProcessImage(photoUrl, filenameBase, pIdx + 1);
                imageUrls.push(publicUrl);
            } catch (err) {
                console.warn(`  Warning: failed to process photo ${pIdx + 1}:`, err.message);
            }
        }

        if (imageUrls.length === 0) {
            console.error(`  Error: No images downloaded for ${sku}, skipping product.`);
            continue;
        }

        // Translations blob (uk is native in fields; provide clean en/ru)
        const translations = JSON.stringify({
            en: {
                name: item.name
                    .replace("Комбінезон", "Jumpsuit")
                    .replace("Дитячий комбінезон", "Kids Jumpsuit")
                    .replace("Сорочка", "Shirt"),
                description: item.cleanDescription,
            },
            ru: {
                name: item.name
                    .replace("Комбінезон", "Комбинезон")
                    .replace("Дитячий комбінезон", "Детский комбинезон")
                    .replace("Сорочка", "Рубашка"),
                description: item.cleanDescription,
            },
        });

        // Upsert to DB
        const productData = {
            name: item.name,
            description: item.cleanDescription,
            price: item.price,
            sku,
            slug: finalSlug,
            stock: totalStock,
            status: "active",
            shopPageSlug: item.shopPageSlug,
            category: item.category,
            fabric: item.fabric,
            sleeve: item.sleeve,
            colors: JSON.stringify(item.colors),
            sizes: JSON.stringify(item.sizes),
            inventory: JSON.stringify(inventory),
            images: JSON.stringify(imageUrls),
            translations,
        };

        const record = await prisma.product.upsert({
            where: { sku },
            update: productData,
            create: productData,
        });

        console.log(`  Saved to DB: ID ${record.id}, slug /p/${record.slug}, stock: ${totalStock}`);
    }

    console.log(`\n=================== IMPORT SUMMARY TABLE ===================`);
    console.table(summary);
}

async function main() {
    try {
        if (isCleanup) {
            await cleanup();
        } else {
            await importCatalog();
        }
    } catch (err) {
        console.error("Fatal error:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
