const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.siteSetting.findMany();
  console.log('SiteSetting rows count:', rows.length);
  for (const r of rows) {
    console.log('--- Key:', r.key);
    console.log(r.value.slice(0, 200));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
