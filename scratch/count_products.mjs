import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function run() {
  const count = await p.product.count();
  const byStatus = await p.product.groupBy({ by: ['status'], _count: true });
  console.log('Total products in DB:', count);
  console.log('By status:', byStatus);
  await p.$disconnect();
}
run();
