import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const products = await p.product.findMany();
console.log('TOTAL PRODUCTS:', products.length);
products.forEach(x => console.log(`  - ${x.name} | category: ${x.category} | status: ${x.status}`));
await p.$disconnect();
