import fs from 'fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const catalog = JSON.parse(fs.readFileSync('scratch/tg_parsed_catalog.json', 'utf8'));
  const tgProducts = await prisma.product.findMany({
    where: { sku: { startsWith: 'TG-' } },
    select: { sku: true, name: true, slug: true, shopPageSlug: true, price: true }
  });
  const importedSkus = new Set(tgProducts.map(p => p.sku));
  
  console.log('--- Skipped items ---');
  for (const item of catalog) {
    const sku = `TG-${item.postId}`;
    if (!importedSkus.has(sku)) {
      console.log(`SKU: ${sku} | Post: ${item.postId} | Name: ${item.name} | Photos: ${item.photoCount}`);
    }
  }

  console.log('\n--- Imported items (19) ---');
  for (const p of tgProducts) {
    console.log(`[${p.shopPageSlug}] ${p.sku} | ${p.name} | ${p.price} ₴ | /p/${p.slug}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
