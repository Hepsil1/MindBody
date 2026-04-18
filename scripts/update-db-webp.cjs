const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting DB update to .webp...");

    // Update Products
    const products = await prisma.product.findMany();
    for (let p of products) {
        if (!p.images) continue;
        let images = JSON.parse(p.images);
        let updated = false;
        let newImages = images.map(img => {
            if (img.match(/\.(jpg|jpeg|png)$/i)) {
                updated = true;
                return img.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            }
            return img;
        });
        if (updated) {
            await prisma.product.update({
                where: { id: p.id },
                data: { images: JSON.stringify(newImages) }
            });
            console.log(`Updated product: ${p.name}`);
        }
    }

    // Update Slides
    const slides = await prisma.slide.findMany();
    for (let s of slides) {
        let updateData = {};
        if (s.image1 && s.image1.match(/\.(jpg|jpeg|png)$/i)) updateData.image1 = s.image1.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        if (s.image2 && s.image2.match(/\.(jpg|jpeg|png)$/i)) updateData.image2 = s.image2.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        if (s.image3 && s.image3.match(/\.(jpg|jpeg|png)$/i)) updateData.image3 = s.image3.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        
        if (Object.keys(updateData).length > 0) {
            await prisma.slide.update({
                where: { id: s.id },
                data: updateData
            });
            console.log(`Updated slide: ${s.name}`);
        }
    }

    // Update Shop Pages (Hero Image)
    const pages = await prisma.shopPage.findMany();
    for (let p of pages) {
        if (p.heroImage && p.heroImage.match(/\.(jpg|jpeg|png)$/i)) {
            await prisma.shopPage.update({
                where: { id: p.id },
                data: { heroImage: p.heroImage.replace(/\.(jpg|jpeg|png)$/i, '.webp') }
            });
            console.log(`Updated shop page: ${p.title}`);
        }
    }

    console.log("Done!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
