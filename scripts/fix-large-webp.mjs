import sharp from "sharp";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const PUBLIC_DIR = "c:/mindbody/public";
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

const MAX_DIMENSION = 1920;

async function getWebpFiles(dir) {
    const files = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== "_originals_backup") {
                files.push(...(await getWebpFiles(fullPath)));
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".webp")) {
                files.push(fullPath);
            }
        }
    } catch (e) {
        // folder doesn't exist, skip
    }
    return files;
}

async function resizeWebp(filePath) {
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();

        // Check if image is too large (either width or height > MAX_DIMENSION)
        if (
            (metadata.width && metadata.width > MAX_DIMENSION) ||
            (metadata.height && metadata.height > MAX_DIMENSION)
        ) {
            console.log(`Resizing: ${filePath} (${metadata.width}x${metadata.height})`);

            const buffer = await sharp(filePath)
                .resize({
                    width: MAX_DIMENSION,
                    height: MAX_DIMENSION,
                    fit: "inside", // Ensure largest dimension is MAX_DIMENSION
                    withoutEnlargement: true,
                })
                .webp({ quality: 80, effort: 4 })
                .toBuffer();

            await sharp(buffer).toFile(filePath);
            console.log(`✓ Done: ${filePath}`);
        }
    } catch (e) {
        console.error(`Error with ${filePath}:`, e.message);
    }
}

async function main() {
    console.log("Fixing large WebP files...");
    let allFiles = [];
    for (const folder of FOLDERS) {
        const dirPath = join(PUBLIC_DIR, folder);
        const files = await getWebpFiles(dirPath);
        allFiles.push(...files);
    }

    // Root pics
    const rootFiles = await getWebpFiles(join(PUBLIC_DIR, "pics"));
    allFiles.push(...rootFiles);

    // De-duplicate
    allFiles = [...new Set(allFiles)];

    console.log(`Found ${allFiles.length} WebP files to check.`);

    for (let i = 0; i < allFiles.length; i += 5) {
        const batch = allFiles.slice(i, i + 5);
        await Promise.all(batch.map((f) => resizeWebp(f)));
    }
    console.log("Finished resizing large WebP images!");
}

main().catch(console.error);
