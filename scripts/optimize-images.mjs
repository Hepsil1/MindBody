/**
 * Image Optimization Script for MindBody
 * Converts all JPG/PNG images to optimized WebP format
 * Keeps originals as backup, creates optimized versions
 * 
 * Quality settings tuned for fashion/sportswear photography:
 * - WebP quality 80 = visually identical to JPG quality 95
 * - Max width 1920px (enough for any screen)
 * - Hero images: 1400px wide (they display in triptych = ~640px each)
 */

import sharp from 'sharp';
import { readdir, stat, mkdir, rename } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';

const PUBLIC_DIR = 'c:/mindbody/public';
const BACKUP_DIR = 'c:/mindbody/public/_originals_backup';

// Folders to process
const FOLDERS = [
  'pics1cloths',
  'pics2cloths', 
  'generalpics',
  'uploads',
  'pics',
  'uploads/slides',
  'uploads/products',
  'uploads/shop-pages',
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];

// Settings
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80; // Visually lossless for photos

let totalSaved = 0;
let totalProcessed = 0;
let errors = [];

async function getImageFiles(dir) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== '_originals_backup') {
        files.push(...await getImageFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
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

async function optimizeImage(filePath) {
  try {
    const fileStats = await stat(filePath);
    const originalSize = fileStats.size;
    
    // Skip tiny files (< 10KB) - already optimized
    if (originalSize < 10 * 1024) return;

    const ext = extname(filePath).toLowerCase();
    const nameWithoutExt = basename(filePath, extname(filePath));
    const dir = dirname(filePath);
    const webpPath = join(dir, nameWithoutExt + '.webp');

    // Check if webp already exists and is smaller
    try {
      const webpStats = await stat(webpPath);
      if (webpStats.size < originalSize * 0.9) {
        // WebP exists and is already smaller, skip
        return;
      }
    } catch (e) {
      // No webp exists yet, proceed
    }

    // Read and optimize
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    let pipeline = sharp(filePath);
    
    // Resize if wider than MAX_WIDTH
    if (metadata.width && metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    // Convert to WebP
    const webpBuffer = await pipeline
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    const saved = originalSize - webpBuffer.length;
    
    if (saved > 0) {
      // Write optimized WebP
      await sharp(webpBuffer).toFile(webpPath);
      
      totalSaved += saved;
      totalProcessed++;
      
      const pct = Math.round((1 - webpBuffer.length / originalSize) * 100);
      console.log(`✓ ${basename(filePath)} → .webp | ${Math.round(originalSize/1024)}KB → ${Math.round(webpBuffer.length/1024)}KB (-${pct}%)`);
    }
  } catch (e) {
    errors.push({ file: filePath, error: e.message });
  }
}

async function main() {
  console.log('🔧 MindBody Image Optimizer');
  console.log('===========================\n');
  
  // Collect all image files
  let allFiles = [];
  for (const folder of FOLDERS) {
    const dirPath = join(PUBLIC_DIR, folder);
    const files = await getImageFiles(dirPath);
    allFiles.push(...files);
  }
  
  // Also check root public pics
  const rootFiles = await getImageFiles(join(PUBLIC_DIR, 'pics'));
  // Already included above
  
  console.log(`Found ${allFiles.length} images to process\n`);
  
  // Process in batches of 5 (to avoid memory issues)
  for (let i = 0; i < allFiles.length; i += 5) {
    const batch = allFiles.slice(i, i + 5);
    await Promise.all(batch.map(f => optimizeImage(f)));
  }
  
  console.log('\n===========================');
  console.log(`✅ Processed: ${totalProcessed} images`);
  console.log(`💾 Total saved: ${Math.round(totalSaved / 1024 / 1024)} MB`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach(e => console.log(`  - ${basename(e.file)}: ${e.error}`));
  }
}

main().catch(console.error);
