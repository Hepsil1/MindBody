// check-db.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findFirst({
      select: { images: true }
  });
  console.log("Images array format:", p.images);
}
main().finally(() => prisma.$disconnect());
