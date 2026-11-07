import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function run() {
  const sample = await p.product.findFirst({ select: { id: true, fabric: true, sleeve: true, translations: true } });
  console.log("Fields accessible via Prisma client:", sample);
  await p.$disconnect();
}
run();
