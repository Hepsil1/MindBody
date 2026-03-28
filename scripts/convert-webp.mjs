/**
 * Convert all JPG/PNG images in /public to WebP format.
 * Quality: 95 (visually lossless)
 * Originals are NOT deleted.
 */
import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

const PUBLIC_DIR = './public';
const QUALITY = 95;
const EXTENSIONS = ['.jpg', '.jpeg', '.png'];

let converted = 0;
let skipped = 0;
let totalSaved = 0;

async function walkDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkDir(fullPath);
        } else if (EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
            await convertToWebP(fullPath);
        }
    }
}

async function convertToWebP(filePath) {
    const webpPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    
    // Skip if WebP already exists
    try {
        await stat(webpPath);
        skipped++;
        return;
    } catch { /* doesn't exist, proceed */ }

    try {
        const originalStats = await stat(filePath);
        const originalSize = originalStats.size;

        await sharp(filePath)
            .webp({ quality: QUALITY, effort: 4 })
            .toFile(webpPath);

        const newStats = await stat(webpPath);
        const newSize = newStats.size;
        const saved = originalSize - newSize;
        const pct = Math.round((saved / originalSize) * 100);

        totalSaved += saved;
        converted++;
        console.log(`✓ ${basename(filePath)} → .webp  (${pct}% smaller, saved ${(saved/1024).toFixed(0)}KB)`);
    } catch (e) {
        console.error(`✗ ${basename(filePath)}: ${e.message}`);
    }
}

console.log('🖼️  Converting images to WebP (quality=95)...\n');
await walkDir(PUBLIC_DIR);
console.log(`\n✅ Done! Converted: ${converted}, Skipped: ${skipped}`);
console.log(`📦 Total saved: ${(totalSaved / 1024 / 1024).toFixed(1)} MB`);
