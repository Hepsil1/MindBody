import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function backup() {
  const products = await prisma.product.findMany();
  fs.writeFileSync('scratch/backup_products_post_tg.json', JSON.stringify(products, null, 2));
  console.log('Saved snapshot of', products.length, 'products to scratch/backup_products_post_tg.json');
}

backup().catch(console.error).finally(() => prisma.$disconnect());
