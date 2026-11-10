import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const MASTERS = [
    {
        src: "scratch/retina_masters/hero_v1_desktop_master.png",
        destBase: "public/Slides/hero-v1-desktop",
        widths: [400, 800, 1200, 1600, 2400],
        masterWidth: 3840,
    },
    {
        src: "scratch/retina_masters/hero_v1_mobile_master.png",
        destBase: "public/Slides/hero-v1-mobile",
        widths: [400, 800, 1200, 1600],
        masterWidth: 2160,
    },
    {
        src: "scratch/retina_masters/hero_v2_desktop_master.png",
        destBase: "public/Slides/hero-v2-desktop",
        widths: [400, 800, 1200, 1600, 2400],
        masterWidth: 3840,
    },
    {
        src: "scratch/retina_masters/hero_v2_mobile_master.png",
        destBase: "public/Slides/hero-v2-mobile",
        widths: [400, 800, 1200, 1600],
        masterWidth: 2160,
    },
    {
        src: "scratch/retina_masters/hero_v3_desktop_master.png",
        destBase: "public/Slides/hero-v3-desktop",
        widths: [400, 800, 1200, 1600, 2400],
        masterWidth: 3840,
    },
    {
        src: "scratch/retina_masters/hero_v3_mobile_master.png",
        destBase: "public/Slides/hero-v3-mobile",
        widths: [400, 800, 1200, 1600],
        masterWidth: 2160,
    },
];

// Load existing LQIP
const lqipPath = "public/lqip.json";
const lqipData = JSON.parse(fs.readFileSync(lqipPath, "utf-8"));

async function exportAll() {
    console.log("Starting Retina 8K Sharp export pipeline (AVIF 4:4:4 + WebP q94)...");

    for (const m of MASTERS) {
        console.log(`\nProcessing ${m.src} -> ${m.destBase}...`);

        // 1. Export Master at full resolution
        const masterPipeline = sharp(m.src)
            .sharpen({ sigma: 0.6, m1: 0.35, m2: 1.4 })
            .toColourspace("srgb");

        const masterAvif = `${m.destBase}.avif`;
        const masterWebp = `${m.destBase}.webp`;

        await masterPipeline
            .clone()
            .avif({ quality: 78, effort: 6, chromaSubsampling: "4:4:4" })
            .toFile(masterAvif);

        await masterPipeline
            .clone()
            .webp({ quality: 94, smartSubsample: true, effort: 6 })
            .toFile(masterWebp);

        console.log(`  Master AVIF: ${(fs.statSync(masterAvif).size / 1024).toFixed(1)} KB`);
        console.log(`  Master WebP: ${(fs.statSync(masterWebp).size / 1024).toFixed(1)} KB`);

        // 2. Export responsive variants
        for (const w of m.widths) {
            const varPipeline = sharp(m.src)
                .resize(w, null, { kernel: "lanczos3", withoutEnlargement: true })
                .sharpen({ sigma: 0.65, m1: 0.4, m2: 1.5 })
                .toColourspace("srgb");

            const varAvif = `${m.destBase}-${w}w.avif`;
            const varWebp = `${m.destBase}-${w}w.webp`;

            await varPipeline
                .clone()
                .avif({ quality: 76, effort: 5, chromaSubsampling: "4:4:4" })
                .toFile(varAvif);

            await varPipeline
                .clone()
                .webp({ quality: 93, smartSubsample: true, effort: 5 })
                .toFile(varWebp);

            console.log(
                `    ${w}w: AVIF ${(fs.statSync(varAvif).size / 1024).toFixed(1)} KB | WebP ${(fs.statSync(varWebp).size / 1024).toFixed(1)} KB`,
            );
        }

        // 3. Generate micro LQIP in AVIF (16x9 for desktop, 12x15 for mobile)
        const isMob = m.destBase.includes("mobile");
        const lqipBuf = await sharp(m.src)
            .resize(isMob ? 16 : 24, isMob ? 20 : 14, { fit: "fill" })
            .avif({ quality: 20 })
            .toBuffer();

        const lqipBase64 = `data:image/avif;base64,${lqipBuf.toString("base64")}`;
        const key = `/${m.destBase}.webp`.replace(/\\/g, "/").replace(/^\/public/, "");
        lqipData[key] = lqipBase64;
    }

    fs.writeFileSync(lqipPath, JSON.stringify(lqipData, null, 2) + "\n", "utf-8");
    console.log("\nLQIP updated successfully.");
    console.log("All Retina 8K assets generated!");
}

exportAll().catch((err) => {
    console.error(err);
    process.exit(1);
});
