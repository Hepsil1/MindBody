import sharp from "sharp";

const src = "public/pics/mind_body_logo.png";

await sharp(src).negate({ alpha: false }).toFile("public/pics/mind_body_logo_white.png");

await sharp(src)
    .negate({ alpha: false })
    .webp({ quality: 92 })
    .toFile("public/pics/mind_body_logo_white.webp");

console.log("white variants written");
