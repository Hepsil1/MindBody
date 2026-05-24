#!/usr/bin/env node
/**
 * Image variant generator — produces responsive 400w/800w/1200w/1600w/2000w
 * webp variants from the HIGHEST-RESOLUTION source available (.JPG > .webp).
 *
 * Why .JPG-first: most product photos were shot at 4284×5712 (camera native).
 * The initial webp masters were downsized to ~2000-2625w during early upload
 * — losing detail on retina desktop / 4K displays. Using the .JPG as
 * source restores the full pixel budget for high-DPR rendering.
 *
 * For each photo, this script:
 * 1. Picks the largest source between sibling .JPG/.JPEG and .webp
 * 2. Regenerates the .webp master from that source at min(natural, 2400w)
 *    so the no-suffix file is high-quality even on retina desktop
 * 3. Generates -400/-800/-1200/-1600/-2000w variants when source supports
 *
 * Usage:
 *   npm run build:images              # generate missing variants only
 *   npm run build:images -- --force   # regenerate all (use after raising widths)
 *
 * Output naming:  IMG_6201.JPG  →  IMG_6201.webp (master, regenerated)
 *                                  IMG_6201-400w.webp
 *                                  IMG_6201-800w.webp
 *                                  IMG_6201-1200w.webp
 *                                  IMG_6201-1600w.webp
 *                                  IMG_6201-2000w.webp
 *
 * Skipped paths:
 *  - existing -NNNw.webp (don't recurse into ourselves)
 *  - decorative artwork without variants needed (logos, icons in /pics/)
 */

import { readdir, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const TARGET_DIRS = ["pics", "pics1cloths", "pics2cloths", "generalpics", "uploads"];
const WIDTHS = [400, 800, 1200, 1600, 2000];
const MASTER_MAX_WIDTH = 2400; // keep master file size reasonable; covers 4K retina @50vw
const QUALITY = 82; // slight bump from 80 — perceptible quality gain at ~5% size cost

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");

// Pattern matches an already-generated variant — skip when walking.
const VARIANT_RE = /-\d{3,4}w\.webp$/;
const MASTER_WEBP_RE = /\.webp$/i;
const JPG_RE = /\.(jpe?g)$/i;

async function* walk(dir) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
        if (err.code === "ENOENT") return;
        throw err;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* walk(p);
        } else if (e.isFile()) {
            // Yield both master .webp (no -NNNw suffix) and .JPG/.JPEG.
            // We'll dedupe by base path later — JPG wins if both exist.
            if (MASTER_WEBP_RE.test(e.name) && !VARIANT_RE.test(e.name)) yield p;
            else if (JPG_RE.test(e.name)) yield p;
        }
    }
}

async function fileExists(p) {
    try {
        await access(p, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function isUpToDate(srcPath, dstPath) {
    if (FORCE) return false;
    try {
        const [src, dst] = await Promise.all([stat(srcPath), stat(dstPath)]);
        return dst.mtimeMs >= src.mtimeMs;
    } catch {
        return false;
    }
}

/**
 * For a master path (either .JPG or .webp), pick the largest source
 * available (sibling .JPG wins over downsized .webp). Returns:
 *   { sourcePath, sourceWidth, basePath }
 * where basePath is the path WITHOUT extension (used to build output names).
 */
async function pickSource(filePath) {
    const isJpg = JPG_RE.test(filePath);
    const base = filePath.replace(/\.(webp|jpe?g)$/i, "");

    // Try both candidates
    const jpgCandidates = [`${base}.JPG`, `${base}.jpg`, `${base}.jpeg`, `${base}.JPEG`];
    const webpMaster = `${base}.webp`;

    let bestPath = null;
    let bestWidth = 0;

    for (const candidate of [...jpgCandidates, webpMaster]) {
        if (!(await fileExists(candidate))) continue;
        try {
            const meta = await sharp(candidate).metadata();
            if (meta.width && meta.width > bestWidth) {
                bestWidth = meta.width;
                bestPath = candidate;
            }
        } catch {
            // skip unreadable
        }
    }

    // If JPG exists with same or larger width, prefer it (it's the original).
    return bestPath ? { sourcePath: bestPath, sourceWidth: bestWidth, basePath: base } : null;
}

async function processBase(filePath) {
    // De-dupe: only process the JPG candidate if both .JPG and .webp exist.
    // Skip the .webp visit when .JPG sibling exists.
    if (MASTER_WEBP_RE.test(filePath)) {
        const base = filePath.replace(/\.webp$/i, "");
        for (const ext of [".JPG", ".jpg", ".jpeg", ".JPEG"]) {
            if (await fileExists(`${base}${ext}`)) {
                return { skipped: true, reason: "JPG sibling preferred" };
            }
        }
    }

    const pick = await pickSource(filePath);
    if (!pick) return { skipped: true, reason: "no readable source" };

    const { sourcePath, sourceWidth, basePath } = pick;
    let generated = 0;
    const actions = [];

    // 1. Don't overwrite existing webp master — on Windows + PM2 serving the
    // file, it's often locked. Existing master is fine because srcset's 2400w
    // slot uses it. Generating wider variants (below) covers the quality gap.
    // If a fresh master is needed, delete the .webp manually and rerun.
    const masterDst = `${basePath}.webp`;
    if (sourcePath !== masterDst && !(await fileExists(masterDst))) {
        // Source is JPG and no webp master exists yet — produce one.
        await sharp(sourcePath)
            .resize({ width: MASTER_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: QUALITY })
            .toFile(masterDst);
        generated++;
        actions.push(`master ${Math.min(sourceWidth, MASTER_MAX_WIDTH)}w`);
    }

    // 2. Generate width variants from the high-resolution source.
    for (const w of WIDTHS) {
        if (sourceWidth <= w) continue; // don't upscale
        const dst = `${basePath}-${w}w.webp`;
        if (await isUpToDate(sourcePath, dst)) continue;
        await sharp(sourcePath)
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: QUALITY })
            .toFile(dst);
        generated++;
        actions.push(`${w}w`);
    }

    return { source: sourcePath, sourceWidth, generated, actions };
}

(async () => {
    console.log(
        `Image variants — widths: ${WIDTHS.join("/")}w + master ≤${MASTER_MAX_WIDTH}w  quality=${QUALITY}`,
    );
    let total = 0;
    let generated = 0;
    const seenBases = new Set();

    for (const dirName of TARGET_DIRS) {
        const dir = path.join(PUBLIC_DIR, dirName);
        for await (const srcPath of walk(dir)) {
            const base = srcPath.replace(/\.(webp|jpe?g)$/i, "");
            if (seenBases.has(base)) continue;
            seenBases.add(base);
            total++;
            const r = await processBase(srcPath);
            if (r.skipped) continue;
            generated += r.generated;
            if (r.generated > 0) {
                const rel = path.relative(PUBLIC_DIR, r.source);
                console.log(
                    `  ✓ ${rel.padEnd(45)} (src ${r.sourceWidth}w) → ${r.actions.join(", ")}`,
                );
            }
        }
    }
    console.log(
        `\nDone. Processed ${total} masters, generated ${generated} files (.webp master + variants).`,
    );
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
