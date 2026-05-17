/**
 * Script to restore high-quality 4K/Retina WebP files from original JPG/PNG sources.
 * It reads the untouched original files and generates new WebP counterparts with quality 95 and max dimension 3500px.
 */

import sharp from "sharp";
import { readdir, stat } from "fs/promises";
import { join, extname, basename, dirname } from "path";

const PUBLIC_DIR = "c:/mindbody/public";

// Folders to process
const FOLDERS = [
    "pics1cloths",
    "pics2cloths",
    "generalpics",
    "uploads",
    "pics",
    "uploads/slides",
    "uploads/products",
    "uploads/shop-pages",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"];
const MAX_DIMENSION = 3500;
const WEBP_QUALITY = 95; // Maximum visible detail for eCommerce

let totalRestored = 0;
let errors = [];

async function getOriginalFiles(dir) {
    const files = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== "_originals_backup") {
                files.push(...(await getOriginalFiles(fullPath)));
            } else if (entry.isFile()) {
                const ext = extname(entry.name).toLowerCase();
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    } catch (e) {
        // folder doesn't exist, skip
    }
    return files;
}

async function restoreToWebp(filePath) {
    try {
        const ext = extname(filePath);
        const nameWithoutExt = basename(filePath, ext);
        const dir = dirname(filePath);
        const webpPath = join(dir, nameWithoutExt + ".webp");

        const image = sharp(filePath);
        const metadata = await image.metadata();

        // We overwrite the WebP unconditionally to restore its quality
        let pipeline = sharp(filePath);

        // Resize down ONLY if it exceeds safe iOS dimensions (~16.7MP max area, so 3500 max dimension)
        if (
            (metadata.width && metadata.width > MAX_DIMENSION) ||
            (metadata.height && metadata.height > MAX_DIMENSION)
        ) {
            pipeline = pipeline.resize({
                width: MAX_DIMENSION,
                height: MAX_DIMENSION,
                fit: "inside",
                withoutEnlargement: true,
            });
        }

        // Convert to top tier WebP (Quality 95 retains high-frequency texture details)
        const webpBuffer = await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();

        await sharp(webpBuffer).toFile(webpPath);

        totalRestored++;
        console.log(
            `✨ Restored 4K WebP: ${nameWithoutExt}.webp (${Math.round(webpBuffer.length / 1024)} KB)`,
        );
    } catch (e) {
        errors.push({ file: filePath, error: e.message });
    }
}

async function main() {
    console.log("💎 MindBody Retina WebP Restorer");
    console.log("=================================\n");

    let allFiles = [];
    for (const folder of FOLDERS) {
        const dirPath = join(PUBLIC_DIR, folder);
        const files = await getOriginalFiles(dirPath);
        allFiles.push(...files);
    }

    // Also check root public pics
    const rootFiles = await getOriginalFiles(join(PUBLIC_DIR, "pics"));
    allFiles.push(...rootFiles);
    allFiles = [...new Set(allFiles)];

    console.log(`Found ${allFiles.length} original RAW/JPG/PNG images to restore to HQ WebP.\n`);

    // Process in batches of 5 to avoid memory locks
    for (let i = 0; i < allFiles.length; i += 5) {
        const batch = allFiles.slice(i, i + 5);
        await Promise.all(batch.map((f) => restoreToWebp(f)));
    }

    console.log("\n=================================");
    console.log(`✅ Fully Restored: ${totalRestored} images`);

    if (errors.length > 0) {
        console.log(`\n⚠️  Errors (${errors.length}):`);
        errors.forEach((e) => console.log(`  - ${basename(e.file)}: ${e.error}`));
    }
}

main().catch(console.error);
