import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("public/hero");
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

const WIDTHS = [400, 800, 1200, 1600, 2400];

async function exportVariants(sharpStream, baseName) {
    // Save uncompressed buffer for resizing
    const buffer = await sharpStream.toBuffer();
    const meta = await sharp(buffer).metadata();
    console.log(`Exporting ${baseName} (${meta.width}x${meta.height})...`);

    // Master exports
    await sharp(buffer)
        .avif({ quality: 72, chromaSubsampling: "4:4:4", effort: 6 })
        .toFile(path.join(OUT_DIR, `${baseName}.avif`));

    await sharp(buffer)
        .webp({ quality: 92, smartSubsample: false })
        .toFile(path.join(OUT_DIR, `${baseName}.webp`));

    // Responsive widths
    for (const w of WIDTHS) {
        if (w > meta.width) continue;
        const h = Math.round((w * meta.height) / meta.width);

        await sharp(buffer)
            .resize(w, h, { kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 })
            .avif({ quality: 68, chromaSubsampling: "4:4:4", effort: 6 })
            .toFile(path.join(OUT_DIR, `${baseName}-${w}w.avif`));

        await sharp(buffer)
            .resize(w, h, { kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 })
            .webp({ quality: 90, smartSubsample: false })
            .toFile(path.join(OUT_DIR, `${baseName}-${w}w.webp`));
    }
}

async function main() {
    console.log("Starting Fable Editorial Hero asset generation...");

    // 1. Black Jumpsuit (IMG_6201.JPG: 4284 x 5712)
    const blackSrc = path.resolve("public/pics1cloths/IMG_6201.JPG");
    // Desktop 4:5 portrait (centered, full model)
    const blackDesktop = sharp(blackSrc)
        .rotate()
        .resize(1800, 2250, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(blackDesktop, "hero-black-desktop");

    // Mobile 9:16 portrait (focus on upper body & full figure)
    const blackMobile = sharp(blackSrc)
        .rotate()
        .extract({ left: 342, top: 400, width: 2800, height: 4977 })
        .resize(1080, 1920, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(blackMobile, "hero-black-mobile");

    // Black Macro Detail 1:1 (zipper & thumbhole)
    const blackDetail = sharp(blackSrc)
        .rotate()
        .extract({ left: 1342, top: 1199, width: 1600, height: 1600 })
        .resize(1200, 1200, { fit: "cover" })
        .sharpen({ sigma: 0.65, m1: 0.9, m2: 2.2 });
    await exportVariants(blackDetail, "hero-black-detail");

    // 2. Chocolate Jumpsuit (IMG_4971.JPG: 4284 x 5712)
    const chocoSrc = path.resolve("public/pics2cloths/IMG_4971.JPG");
    const chocoDesktop = sharp(chocoSrc)
        .rotate()
        .resize(1800, 2250, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(chocoDesktop, "hero-choco-desktop");

    const chocoMobile = sharp(chocoSrc)
        .rotate()
        .extract({ left: 342, top: 400, width: 2800, height: 4977 })
        .resize(1080, 1920, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(chocoMobile, "hero-choco-mobile");

    // Choco Macro Detail 1:1 (open back lace straps)
    const chocoDetail = sharp(chocoSrc)
        .rotate()
        .extract({ left: 1342, top: 1142, width: 1600, height: 1600 })
        .resize(1200, 1200, { fit: "cover" })
        .sharpen({ sigma: 0.65, m1: 0.9, m2: 2.2 });
    await exportVariants(chocoDetail, "hero-choco-detail");

    // 3. Teal Jumpsuit (374_131123.jpg: 2000 x 3000)
    const tealSrc = path.resolve("public/generalpics/374_131123.jpg");
    const tealDesktop = sharp(tealSrc)
        .rotate()
        .resize(1800, 2250, { fit: "cover", position: "bottom" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(tealDesktop, "hero-teal-desktop");

    const tealMobile = sharp(tealSrc)
        .rotate()
        .extract({ left: 156, top: 500, width: 1406, height: 2500 })
        .resize(1080, 1920, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(tealMobile, "hero-teal-mobile");

    // 4. Ruby Jumpsuit (588_131123.jpg: 2000 x 3000)
    const rubySrc = path.resolve("public/generalpics/588_131123.jpg");
    const rubyDesktop = sharp(rubySrc)
        .rotate()
        .resize(1800, 2250, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(rubyDesktop, "hero-ruby-desktop");

    const rubyMobile = sharp(rubySrc)
        .rotate()
        .extract({ left: 156, top: 200, width: 1406, height: 2500 })
        .resize(1080, 1920, { fit: "cover", position: "center" })
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });
    await exportVariants(rubyMobile, "hero-ruby-mobile");

    console.log("All Fable Editorial Hero assets successfully built!");
}

main().catch(console.error);
