import sharp from "sharp";
import path from "path";
import fs from "fs";

const baseDir = "C:/Users/tgmbo/.gemini/antigravity/scratch/MindBody";
const artifactDir = "C:/Users/tgmbo/.gemini/antigravity/brain/678229c0-0337-4392-95a2-0345912060d1";
const outDir = path.join(baseDir, "public/hero/masters");

const widths = [400, 800, 1080, 1200, 1600];

const mobileSlides = [
    { id: "slide1_trio_mobile", src: `${artifactDir}/scratch/slide1_trio_mobile_master.png` },
    { id: "slide2_cocoa_mobile", src: `${artifactDir}/scratch/slide2_cocoa_mobile_master.png` },
    { id: "slide3_harmony_mobile", src: `${artifactDir}/scratch/slide3_harmony_mobile_master.png` },
    { id: "slide4_black_mobile", src: `${artifactDir}/scratch/slide4_black_mobile_master.png` },
];

async function run() {
    for (const slide of mobileSlides) {
        console.log(`Exporting mobile slide: ${slide.id}...`);
        const srcBuffer = fs.readFileSync(slide.src);

        // 1. Master WebP & AVIF (1600x2844)
        await sharp(srcBuffer)
            .webp({ quality: 90, effort: 4 })
            .toFile(path.join(outDir, `${slide.id}.webp`));

        await sharp(srcBuffer)
            .avif({ quality: 85, effort: 4 })
            .toFile(path.join(outDir, `${slide.id}.avif`));

        // 2. Responsive widths
        for (const w of widths) {
            await sharp(srcBuffer)
                .resize({ width: w, withoutEnlargement: true })
                .webp({ quality: 90, effort: 4 })
                .toFile(path.join(outDir, `${slide.id}-${w}w.webp`));

            await sharp(srcBuffer)
                .resize({ width: w, withoutEnlargement: true })
                .avif({ quality: 85, effort: 4 })
                .toFile(path.join(outDir, `${slide.id}-${w}w.avif`));
        }
        console.log(`  -> Done ${slide.id}`);
    }
    console.log("All mobile masters exported successfully!");
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
