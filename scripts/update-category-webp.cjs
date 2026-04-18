const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Updating Category table to .webp...");
    try {
        const categories = await prisma.category.findMany();
        for (let c of categories) {
            if (c.image && c.image.match(/\.(jpg|jpeg|png)$/i)) {
                await prisma.category.update({
                    where: { id: c.id },
                    data: { image: c.image.replace(/\.(jpg|jpeg|png)$/i, '.webp') }
                });
                console.log(`Updated category: ${c.title}`);
            }
        }
        console.log("Category update done!");
    } catch (e) {
        console.log("Category table might not exist or error:", e.message);
    }
}

main().finally(() => prisma.$disconnect());
