import sharp from "sharp";

const src = "public/pics/mind_body_logo.png";

/**
 * Build a TRULY white logo by:
 * 1. Extracting the alpha channel from the master PNG (shape mask)
 * 2. Creating a pure-white RGB canvas the same size
 * 3. Joining: white RGB + original alpha → fully-white pixels in
 *    the logo shape, transparent elsewhere.
 *
 * Earlier attempt used sharp.negate({alpha:false}) which inverted
 * RGB. But the source PNG has lossy anti-aliased edges (≈ rgb(120))
 * — invert produced ≈ rgb(135) = mid-gray that reads dark on a
 * dark hero background. This time we force RGB = pure 255 so the
 * pixels are guaranteed white.
 */
const meta = await sharp(src).metadata();
const { width, height } = meta;

// Extract alpha channel from the original (the logo's outline shape).
// .raw() is critical — without it sharp returns a re-encoded PNG buffer,
// not 1-byte-per-pixel alpha data, and joinChannel rejects it.
const alphaBuf = await sharp(src).extractChannel("alpha").raw().toBuffer();

// Create solid white RGB canvas of the same dimensions
const whiteRgb = await sharp({
    create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
    },
})
    .raw()
    .toBuffer();

// Combine: white RGB + original alpha = white-shape PNG
const combined = await sharp(whiteRgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alphaBuf, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

await sharp(combined).png().toFile("public/pics/mind_body_logo_white.png");
await sharp(combined)
    .webp({ quality: 95, alphaQuality: 100, lossless: false })
    .toFile("public/pics/mind_body_logo_white.webp");

// Verify the result has pure-white opaque pixels
const verify = await sharp("public/pics/mind_body_logo_white.png")
    .raw()
    .toBuffer({ resolveWithObject: true });
let pureWhite = 0,
    other = 0;
for (let i = 0; i < verify.data.length; i += verify.info.channels) {
    const a = verify.info.channels === 4 ? verify.data[i + 3] : 255;
    if (a < 32) continue;
    const r = verify.data[i],
        g = verify.data[i + 1],
        b = verify.data[i + 2];
    if (r > 240 && g > 240 && b > 240) pureWhite++;
    else other++;
}
console.log(`pure-white opaque: ${pureWhite}, other opaque: ${other}`);
