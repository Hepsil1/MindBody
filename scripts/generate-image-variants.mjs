#!/usr/bin/env node
/**
 * Image variant generator — produces responsive 400w/800w/1200w webp
 * variants from the masters in public/pics*, public/generalpics, etc.
 * Mobile users on 4G LTE load ~400w (200 KB) instead of the 4284×5712
 * master (~3 MB) — that's the real LCP win Atom F promised but didn't
 * deliver (it added `sizes` without `srcset` widths).
 *
 * Usage:
 *   npm run build:images           # generate any missing variants
 *   npm run build:images -- --force  # regenerate all
 *
 * Idempotent by default: skips a variant if it exists AND is newer
 * than the source.  Safe to run on every deploy.
 *
 * Output naming:  IMG_6201.webp  →  IMG_6201-400w.webp
 *                                    IMG_6201-800w.webp
 *                                    IMG_6201-1200w.webp
 *
 * Skipped paths:
 *  - existing -NNNw.webp (don't recurse into ourselves)
 *  - the master itself (the no-suffix .webp is the high-res original
 *    used as `src` fallback for non-srcset browsers)
 *  - png decorative artwork (logos, icons) — only product photography
 *    benefits from variants
 */

import { readdir, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const TARGET_DIRS = ["pics", "pics1cloths", "pics2cloths", "generalpics", "uploads"];
const WIDTHS = [400, 800, 1200];
const QUALITY = 80;

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");

// Pattern matches an already-generated variant (or someone-else's
// hand-named -NNNw file).  We don't want to recurse on those.
const VARIANT_RE = /-\d{3,4}w\.webp$/;

async function* walk(dir) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
        if (err.code === "ENOENT") return; // tolerate missing dirs
        throw err;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walk(p);
        } else if (e.isFile() && /\.webp$/i.test(e.name) && !VARIANT_RE.test(e.name)) {
            yield p;
        }
    }
}

async function isUpToDate(srcPath, dstPath) {
    if (FORCE) return false;
    try {
        const [src, dst] = await Promise.all([stat(srcPath), stat(dstPath)]);
        return dst.mtimeMs >= src.mtimeMs;
    } catch {
        return false; // dst doesn't exist
    }
}

async function generateVariants(srcPath) {
    const base = srcPath.replace(/\.webp$/i, "");
    const meta = await sharp(srcPath).metadata();
    if (!meta.width) return { src: srcPath, generated: 0, reason: "no width" };

    let generated = 0;
    for (const w of WIDTHS) {
        // Skip if master is narrower than target width — would just
        // upscale, no benefit.
        if (meta.width <= w) continue;
        const dst = `${base}-${w}w.webp`;
        if (await isUpToDate(srcPath, dst)) continue;
        await sharp(srcPath)
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: QUALITY })
            .toFile(dst);
        generated++;
    }
    return { src: srcPath, generated, masterWidth: meta.width };
}

(async () => {
    console.log(`Image variants — widths: ${WIDTHS.join("/")}w  quality=${QUALITY}`);
    let total = 0;
    let generated = 0;
    for (const dirName of TARGET_DIRS) {
        const dir = path.join(PUBLIC_DIR, dirName);
        for await (const srcPath of walk(dir)) {
            total++;
            const r = await generateVariants(srcPath);
            generated += r.generated;
            if (r.generated > 0) {
                const rel = path.relative(PUBLIC_DIR, srcPath);
                console.log(`  ✓ ${rel.padEnd(40)} (master ${r.masterWidth}w) → +${r.generated}`);
            }
        }
    }
    console.log(`\nDone. Scanned ${total} masters, generated ${generated} variants.`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
