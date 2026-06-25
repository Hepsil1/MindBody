import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import sharp from "sharp";

/**
 * Upload-time responsive-variant generation.
 *
 * Historically variants (-400w/-800w/… .webp/.avif + LQIP) were produced
 * only by the manual `npm run build:images` script, which meant every
 * photo the owner added through the admin shipped as a single full-size
 * master: buildWebpSrcset()/buildAvifSrcset() emitted URLs that 404'd,
 * the browser fell back to the master, and "new material" was visibly
 * slower than the launch catalogue. This module closes that gap — the
 * admin upload path now produces the exact same artefacts the script
 * does, with the same quality settings, so future material is
 * indistinguishable from the optimized originals.
 *
 * Quality constants mirror scripts/generate-image-variants.mjs — keep
 * them in sync when tuning (the script remains the bulk/backfill tool).
 */

const WIDTHS = [400, 800, 1200, 1600, 2400];
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 80; // visually ≈ WebP q=85 at 25-30% smaller
const AVIF_EFFORT = 6;
// HERO/SLIDE tier. Slides are full-bleed showcases, often over smooth sky/skin
// gradients where AVIF q80 bands visibly. Bumping AVIF→90 / WebP→92 removes the
// banding; the size cost only applies to the handful of hero images, not the
// product catalogue (which stays on the standard tier above).
const HQ_AVIF_QUALITY = 90;
const HQ_WEBP_QUALITY = 92;
const HQ_AVIF_EFFORT = 7;
const LQIP_WIDTH = 20;
const LQIP_HEIGHT = 26; // 3:4 aspect — matches product photography
const LQIP_QUALITY = 30;
const LQIP_BLUR = 2;

/**
 * Generate AVIF master + responsive WebP/AVIF variants + LQIP entry for
 * a freshly-uploaded master .webp file.
 *
 * - `absWebpPath` — absolute path of the just-written master .webp
 * - `publicUrl`   — its public URL ("/uploads/upload_….webp"), used as
 *                   the LQIP map key (same key components pass to getLqip)
 *
 * Never throws: a variant-generation failure must not fail the upload —
 * the master alone is still a working (if heavier) image, which is the
 * pre-this-change status quo. Errors are logged for the operator.
 */
export async function generateUploadVariants(
    absWebpPath: string,
    publicUrl: string,
    opts: { hq?: boolean } = {},
) {
    try {
        const avifQuality = opts.hq ? HQ_AVIF_QUALITY : AVIF_QUALITY;
        const webpQuality = opts.hq ? HQ_WEBP_QUALITY : WEBP_QUALITY;
        const avifEffort = opts.hq ? HQ_AVIF_EFFORT : AVIF_EFFORT;

        const img = sharp(absWebpPath);
        const meta = await img.metadata();
        const naturalWidth = meta.width ?? 0;
        if (!naturalWidth) return;

        const base = absWebpPath.replace(/\.webp$/i, "");

        // AVIF master — <picture> lists AVIF first, so without this the
        // browser would pick a -2400w variant even on 4K screens.
        await sharp(absWebpPath)
            .avif({ quality: avifQuality, effort: avifEffort })
            .toFile(`${base}.avif`);

        // Width variants in both formats. withoutEnlargement: a 1200px
        // source must not fabricate a blurry 2400w "variant".
        for (const w of WIDTHS) {
            if (w >= naturalWidth) continue;
            await sharp(absWebpPath)
                .resize({ width: w, withoutEnlargement: true })
                .webp({ quality: webpQuality })
                .toFile(`${base}-${w}w.webp`);
            await sharp(absWebpPath)
                .resize({ width: w, withoutEnlargement: true })
                .avif({ quality: avifQuality, effort: avifEffort })
                .toFile(`${base}-${w}w.avif`);
        }

        await appendLqip(absWebpPath, publicUrl);
        console.log(`✅ Variants generated for ${publicUrl}`);
    } catch (e) {
        console.error(`⚠ Variant generation failed for ${publicUrl} (master still usable):`, e);
    }
}

/**
 * Append/refresh this image's LQIP entry in public/lqip.json.
 *
 * NOTE: app/utils/lqip.ts bundles the JSON at BUILD time, so entries
 * written here become visible to the storefront on the next deploy
 * build. Until then the image simply renders without a blur-up
 * placeholder (getLqip returns undefined — graceful). Writing eagerly
 * keeps the map complete so no manual script run is ever required.
 */
async function appendLqip(absWebpPath: string, publicUrl: string) {
    const lqipBuffer = await sharp(absWebpPath)
        .resize(LQIP_WIDTH, LQIP_HEIGHT, { fit: "cover" })
        .blur(LQIP_BLUR)
        .avif({ quality: LQIP_QUALITY })
        .toBuffer();
    const dataUrl = `data:image/avif;base64,${lqipBuffer.toString("base64")}`;

    const lqipPath = path.join(process.cwd(), "public", "lqip.json");
    let map: Record<string, string> = {};
    try {
        if (fs.existsSync(lqipPath)) {
            map = JSON.parse(await fsp.readFile(lqipPath, "utf8"));
        }
    } catch {
        // Corrupt/missing map — rebuild from this entry; the script can
        // backfill the rest.
        map = {};
    }
    map[publicUrl] = dataUrl;
    await fsp.writeFile(lqipPath, JSON.stringify(map, null, 0), "utf8");
}
