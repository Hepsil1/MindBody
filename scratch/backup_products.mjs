import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function run() {
  const products = await prisma.product.findMany();
  fs.writeFileSync("scratch/backup_products_pre_tg.json", JSON.stringify(products, null, 2), "utf8");
  console.log(`Successfully backed up ${products.length} products to scratch/backup_products_pre_tg.json`);
  await prisma.$disconnect();
}

run();
