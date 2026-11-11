/**
 * Fable Luxury Fashion Hero Asset Builder (Retina 8K)
 * Real high-res studio camera masters with zero artificial cutouts.
 * - S1: Signature Plum Catsuit with Open Laced Back (602_131123.jpg)
 * - S2: Real Studio Duo: 2 Models in one frame (IMG_6215.JPG - 4284x5712)
 * - S3: Tricolor Triad (Black Hooded IMG_6201.JPG + Teal 333_131123.jpg + Plum Portrait 588_131123.jpg)
 * - S4: Tactile Macro Dual-Focus Lens: Anatomy of Lacing (348_131123.jpg)
 * - S5: Haute Couture Runway: Espresso Catsuit with Fur Coat & Boots (IMG_5217.JPG - 4284x5712)
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.resolve("public");
const OUT_DIR = path.resolve("public/hero");

fs.mkdirSync(OUT_DIR, { recursive: true });

const WIDTHS = [640, 960, 1440, 1920, 2560, 3200];

const PHOTO_MANIFEST = [
    // Slide 1: Solo Plum Open Laced Back (1 Model)
    {
        id: "fable-s1-plum-back",
        src: path.join(PUBLIC_DIR, "generalpics/602_131123.jpg"),
    },

    // Slide 2: Real Studio Duo (2 Models in one frame)
    {
        id: "fable-s2-duo-models",
        src: path.join(PUBLIC_DIR, "pics1cloths/IMG_6215.JPG"),
    },

    // Slide 3: Triad (3 Colors / 3 Models)
    {
        id: "fable-s3-black",
        src: path.join(PUBLIC_DIR, "pics1cloths/IMG_6201.JPG"),
    },
    {
        id: "fable-s3-teal",
        src: path.join(PUBLIC_DIR, "generalpics/333_131123.jpg"),
    },
    {
        id: "fable-s3-plum",
        src: path.join(PUBLIC_DIR, "generalpics/588_131123.jpg"),
    },

    // Slide 4: Tactile Macro Lacing (Dual-Focus Lens 2.4x)
    {
        id: "fable-s4-macro-lacing",
        src: path.join(PUBLIC_DIR, "generalpics/348_131123.jpg"),
    },

    // Slide 5: Haute Couture Runway Chocolate & Fur
    {
        id: "fable-s5-espresso-fur",
        src: path.join(PUBLIC_DIR, "pics2cloths/IMG_5217.JPG"),
    },
];

async function processPhoto(item) {
    console.log(`Processing ${item.id} from ${item.src}...`);
    if (!fs.existsSync(item.src)) {
        throw new Error(`Source not found: ${item.src}`);
    }

    const buf = await fs.promises.readFile(item.src);
    const meta = await sharp(buf).metadata();
    console.log(`  Source meta: ${meta.width}x${meta.height}, format: ${meta.format}`);

    // 1. Full Master AVIF & WebP (Retina 8K target)
    await sharp(buf)
        .rotate()
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 })
        .avif({ quality: 84, effort: 6, chromaSubsampling: "4:4:4" })
        .toFile(path.join(OUT_DIR, `${item.id}.avif`));

    await sharp(buf)
        .rotate()
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 })
        .webp({ quality: 94, smartSubsample: false })
        .toFile(path.join(OUT_DIR, `${item.id}.webp`));

    // 2. Responsive Breakpoints
    for (const w of WIDTHS) {
        if (w > (meta.width || 3840) + 400) continue;

        const basePipeline = sharp(buf)
            .rotate()
            .resize({ width: w, kernel: sharp.kernel.lanczos3, withoutEnlargement: true })
            .sharpen({ sigma: 0.6, m1: 0.8, m2: 2.0 });

        await basePipeline
            .clone()
            .avif({ quality: 80, effort: 6, chromaSubsampling: "4:4:4" })
            .toFile(path.join(OUT_DIR, `${item.id}-${w}w.avif`));

        await basePipeline
            .clone()
            .webp({ quality: 92, smartSubsample: false })
            .toFile(path.join(OUT_DIR, `${item.id}-${w}w.webp`));

        await basePipeline
            .clone()
            .jpeg({ quality: 90, mozjpeg: true })
            .toFile(path.join(OUT_DIR, `${item.id}-${w}w.jpg`));
    }
}

async function main() {
    console.log("=== FABLE WORLD-CLASS HERO ASSET BUILDER STARTING ===");
    for (const item of PHOTO_MANIFEST) {
        await processPhoto(item);
    }
    console.log("=== ALL RETINA 8K ASSETS GENERATED SUCCESSFULLY ===");
}

main().catch((err) => {
    console.error("Error generating hero assets:", err);
    process.exit(1);
});
