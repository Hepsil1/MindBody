#!/usr/bin/env node
/**
 * Image variant generator — produces responsive WebP + AVIF variants
 * (400/800/1200/1600/2400w) + a 3200w master from the HIGHEST-RESOLUTION
 * source available (.JPG > .webp).
 *
 * Why .JPG-first: most product photos were shot at 4284×5712 (camera
 * native). The initial webp masters were downsized to ~2000-2625w during
 * early upload — losing detail on retina desktop / 4K displays. Using
 * the .JPG as source restores the full pixel budget for high-DPR
 * rendering.
 *
 * Why AVIF (Batch 40): AVIF gives 25-30% smaller files than WebP at
 * the same visual quality. q=80 AVIF visually equals q=85 WebP per
 * Cuyana/Polène benchmarks. 96%+ of modern browsers support AVIF
 * (caniuse), so we serve AVIF first via <picture><source type="image/avif">
 * and fall back to WebP for the rest.
 *
 * Why 3200w master (Batch 40): retina desktop (1920×2 DPR = 3840 phys
 * px) and 4K iMac need ≥3200w master to avoid upscaling.
 *
 * Why LQIP (Batch 40): low-quality image placeholders eliminate the
 * blank cream rect that's visible 200-500ms while the real image
 * decodes on slow 4G.  A 20×26 AVIF blob at q=30 (~80-200 bytes per
 * image) is base64-encoded and stored in public/lqip.json.  Components
 * read this map and inject it as `background-image` on the wrapper
 * div — when the real <img> finishes loading it covers the blur with
 * a smooth premium fade.
 *
 * For each photo, this script:
 * 1. Picks the largest source between sibling .JPG/.JPEG and .webp
 * 2. Regenerates the .webp master from that source at min(natural, 3200w)
 * 3. Generates -400/-800/-1200/-1600/-2400w variants in WebP AND AVIF
 *    when source supports the width
 * 4. Generates a tiny LQIP placeholder, base64-encoded into a JSON map
 *
 * Usage:
 *   npm run build:images              # generate missing variants only
 *   npm run build:images -- --force   # regenerate all (use after raising widths or changing quality)
 *
 * Output naming:
 *   IMG_6201.JPG  →  IMG_6201.webp        (master ≤3200w)
 *                    IMG_6201.avif        (master ≤3200w)
 *                    IMG_6201-{400|800|1200|1600|2400}w.webp
 *                    IMG_6201-{400|800|1200|1600|2400}w.avif
 *
 * LQIP map:
 *   public/lqip.json  →  { "/pics1cloths/IMG_6201.webp": "data:image/avif;base64,..." }
 *
 * Skipped paths:
 *  - existing -NNNw.{webp,avif} (don't recurse into ourselves)
 *  - decorative artwork without variants needed (logos, icons in /pics/)
 */

import { readdir, stat, access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const TARGET_DIRS = ["pics", "pics1cloths", "pics2cloths", "generalpics", "uploads", "lifestyle"];
const WIDTHS = [400, 800, 1200, 1600, 2400];
const MASTER_MAX_WIDTH = 3200; // 4K retina desktop / iMac 5K @100vw
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 80; // visually ≈ WebP q=85 at 25-30% smaller
const AVIF_EFFORT = 6; // 0-9; 6 = sane balance of compression ratio vs encode time
const LQIP_WIDTH = 20;
const LQIP_HEIGHT = 26; // 3:4 aspect
const LQIP_QUALITY = 30;
const LQIP_BLUR = 2;

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const SKIP_AVIF = args.has("--no-avif"); // escape hatch if AVIF encode is slow on a CI host

// Pattern matches an already-generated variant — skip when walking.
const VARIANT_RE = /-\d{3,4}w\.(webp|avif)$/;
const MASTER_WEBP_RE = /\.webp$/i;
const JPG_RE = /\.(jpe?g)$/i;

// In-memory LQIP map: collected during walk, written to disk at end.
const lqipMap = {};

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

/**
 * Produce a tiny blurred AVIF, base64-encode it, register in lqipMap.
 * Key is the public URL path (what components pass to buildWebpSrcset)
 * — so map lookup matches whatever the .tsx files reference.
 */
async function generateLqip(sourcePath, basePath) {
    // Public URL key: strip PUBLIC_DIR prefix, normalize to forward slashes.
    const rel = path.relative(PUBLIC_DIR, `${basePath}.webp`).replace(/\\/g, "/");
    const urlKey = `/${rel}`;

    // Already have it and not forcing? Keep cached value if present in map
    // (we re-collect on every run, so a previous run won't carry over —
    // but skip the compute if the same image was already done in THIS run).
    if (lqipMap[urlKey] && !FORCE) return;

    try {
        const buf = await sharp(sourcePath)
            .resize(LQIP_WIDTH, LQIP_HEIGHT, { fit: "cover", position: "centre" })
            .blur(LQIP_BLUR)
            .avif({ quality: LQIP_QUALITY, effort: AVIF_EFFORT })
            .toBuffer();
        lqipMap[urlKey] = `data:image/avif;base64,${buf.toString("base64")}`;
    } catch (err) {
        // Some sources (transparent PNGs) may fail AVIF encode in tiny
        // sizes — fall back to a WebP LQIP. Cheaper than re-encoding the
        // whole pipeline.
        try {
            const buf = await sharp(sourcePath)
                .resize(LQIP_WIDTH, LQIP_HEIGHT, { fit: "cover" })
                .blur(LQIP_BLUR)
                .webp({ quality: LQIP_QUALITY })
                .toBuffer();
            lqipMap[urlKey] = `data:image/webp;base64,${buf.toString("base64")}`;
        } catch {
            // Not all images are photos (e.g. logos with transparent backgrounds
            // in /pics/) — those don't need LQIP. Silently skip.
        }
    }
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

    // 1. WebP master — don't overwrite if it exists (often locked by PM2 on
    // Windows). Existing master is fine because srcset's master slot uses
    // it. If a fresh master is needed, delete the .webp manually and rerun.
    const masterWebpDst = `${basePath}.webp`;
    if (sourcePath !== masterWebpDst && !(await fileExists(masterWebpDst))) {
        await sharp(sourcePath)
            .resize({ width: MASTER_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toFile(masterWebpDst);
        generated++;
        actions.push(`master ${Math.min(sourceWidth, MASTER_MAX_WIDTH)}w (webp)`);
    }

    // 2. AVIF master — separate file, can always (re)generate without touching
    // the WebP master that may be locked.
    if (!SKIP_AVIF) {
        const masterAvifDst = `${basePath}.avif`;
        if (FORCE || !(await fileExists(masterAvifDst))) {
            await sharp(sourcePath)
                .resize({ width: MASTER_MAX_WIDTH, withoutEnlargement: true })
                .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
                .toFile(masterAvifDst);
            generated++;
            actions.push(`master (avif)`);
        }
    }

    // 3. Width variants — WebP + AVIF from the high-resolution source.
    for (const w of WIDTHS) {
        if (sourceWidth <= w) continue; // don't upscale

        const webpDst = `${basePath}-${w}w.webp`;
        if (!(await isUpToDate(sourcePath, webpDst))) {
            await sharp(sourcePath)
                .resize({ width: w, withoutEnlargement: true })
                .webp({ quality: WEBP_QUALITY })
                .toFile(webpDst);
            generated++;
            actions.push(`${w}w (webp)`);
        }

        if (!SKIP_AVIF) {
            const avifDst = `${basePath}-${w}w.avif`;
            if (!(await isUpToDate(sourcePath, avifDst))) {
                await sharp(sourcePath)
                    .resize({ width: w, withoutEnlargement: true })
                    .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
                    .toFile(avifDst);
                generated++;
                actions.push(`${w}w (avif)`);
            }
        }
    }

    // 4. LQIP — always (re)generate. Cheap, and keys are referenced by
    // components at runtime so we want the map to be complete.
    await generateLqip(sourcePath, basePath);

    return { source: sourcePath, sourceWidth, generated, actions };
}

(async () => {
    console.log(`Image variants — widths: ${WIDTHS.join("/")}w + master ≤${MASTER_MAX_WIDTH}w`);
    console.log(
        `  WebP q=${WEBP_QUALITY}  |  AVIF q=${AVIF_QUALITY} effort=${AVIF_EFFORT}${SKIP_AVIF ? " (skipped)" : ""}  |  LQIP ${LQIP_WIDTH}×${LQIP_HEIGHT} blur=${LQIP_BLUR}`,
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

    // 5. Write LQIP map. Components import this JSON at build time.
    const lqipPath = path.join(PUBLIC_DIR, "lqip.json");
    await writeFile(lqipPath, JSON.stringify(lqipMap, null, 0), "utf8");
    const lqipKb = (JSON.stringify(lqipMap).length / 1024).toFixed(1);

    console.log(`\nDone. Processed ${total} masters, generated ${generated} files.`);
    console.log(
        `LQIP map: ${Object.keys(lqipMap).length} entries, ${lqipKb} KB at public/lqip.json`,
    );
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
