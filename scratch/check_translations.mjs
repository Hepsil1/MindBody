import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const products = await prisma.$queryRawUnsafe(`
    SELECT id, name, translations FROM "Product" LIMIT 3;
  `);
  console.log("Translations samples:", products);
  await prisma.$disconnect();
}

run();
