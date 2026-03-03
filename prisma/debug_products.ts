
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Use raw SQL to see actual columns, ignoring Prisma Client schema
    const products: any[] = await prisma.$queryRawUnsafe("SELECT id, name, category, shopPageSlug, images FROM Product");

    console.log(`Found ${products.length} products (Raw SQL).`);

    products.forEach(p => {
        console.log(`Product [${p.id}]: Name="${p.name}", Category="${p.category}", ShopPageSlug="${p.shopPageSlug}", Images="${p.images}"`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
