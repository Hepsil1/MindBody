import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({ select: { id: true, name: true, category: true, shopPageSlug: true } });
    console.log(products);
}

main().catch(console.error).finally(() => prisma.$disconnect());
