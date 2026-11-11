import sharp from "sharp";
import fs from "fs";
import path from "path";

const MASTER_DIR = path.resolve("scratch/masterpiece_masters");
const OUT_DIR = path.resolve("public/Slides");

const WIDTHS = [400, 800, 1200, 1600, 2400];

async function exportSet(srcPath, baseName) {
    console.log(`Processing ${baseName} from ${srcPath}...`);
    const buf = await fs.promises.readFile(srcPath);
    const meta = await sharp(buf).metadata();

    // Master AVIF & WebP
    await sharp(buf)
        .avif({ quality: 78, chromaSubsampling: "4:4:4", effort: 6 })
        .toFile(path.join(OUT_DIR, `${baseName}.avif`));

    await sharp(buf)
        .webp({ quality: 94, smartSubsample: false })
        .toFile(path.join(OUT_DIR, `${baseName}.webp`));

    // Variants
    for (const w of WIDTHS) {
        if (w > meta.width) continue;
        const h = Math.round((w * meta.height) / meta.width);

        await sharp(buf)
            .resize(w, h, { kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 0.65, m1: 0.8, m2: 2.0 })
            .avif({ quality: 74, chromaSubsampling: "4:4:4", effort: 6 })
            .toFile(path.join(OUT_DIR, `${baseName}-${w}w.avif`));

        await sharp(buf)
            .resize(w, h, { kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 0.65, m1: 0.8, m2: 2.0 })
            .webp({ quality: 92, smartSubsample: false })
            .toFile(path.join(OUT_DIR, `${baseName}-${w}w.webp`));
    }
}

async function main() {
    console.log("Starting All 4 Flagship Retina 8K exports...");

    await exportSet(path.join(MASTER_DIR, "master_v1_desktop_3840.png"), "hero-v1-desktop");
    await exportSet(path.join(MASTER_DIR, "master_v1_mobile_2160.png"), "hero-v1-mobile");

    await exportSet(path.join(MASTER_DIR, "master_v2_desktop_3840.png"), "hero-v2-desktop");
    await exportSet(path.join(MASTER_DIR, "master_v2_mobile_2160.png"), "hero-v2-mobile");

    await exportSet(path.join(MASTER_DIR, "master_v3_desktop_3840.png"), "hero-v3-desktop");
    await exportSet(path.join(MASTER_DIR, "master_v3_mobile_2160.png"), "hero-v3-mobile");

    await exportSet(path.join(MASTER_DIR, "master_v4_desktop_3840.png"), "hero-v4-desktop");
    await exportSet(path.join(MASTER_DIR, "master_v4_mobile_2160.png"), "hero-v4-mobile");

    console.log("All 4 Flagship Retina 8K variants successfully exported!");
}

main().catch(console.error);
