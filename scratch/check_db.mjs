import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tgProducts = await prisma.product.findMany({
    where: { sku: { startsWith: 'TG-' } },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total TG products in DB:', tgProducts.length);
  const byActivity = {};
  const byCategory = {};
  let totalStock = 0;
  let allStockOnePerVariant = true;
  let totalVariantItems = 0;

  for (const p of tgProducts) {
    byActivity[p.shopPageSlug] = (byActivity[p.shopPageSlug] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    totalStock += p.stock;
    const inv = JSON.parse(p.inventory || '[]');
    for (const v of inv) {
      totalVariantItems++;
      if (v.stock !== 1) allStockOnePerVariant = false;
    }
  }

  console.log('By activity (shopPageSlug):', JSON.stringify(byActivity, null, 2));
  console.log('By category:', JSON.stringify(byCategory, null, 2));
  console.log('Total aggregate stock across all TG items:', totalStock);
  console.log('Total individual variant combinations:', totalVariantItems);
  console.log('All variant combinations have stock === 1?', allStockOnePerVariant);
  console.log('All TG products status active?', tgProducts.every(p => p.status === 'active'));
  
  const originals = await prisma.product.count({ where: { NOT: { sku: { startsWith: 'TG-' } } } });
  console.log('Original products in DB:', originals);
}

main().catch(console.error).finally(() => prisma.$disconnect());
