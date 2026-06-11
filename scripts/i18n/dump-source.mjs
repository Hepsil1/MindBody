// Read-only dump of translatable DB content → scripts/i18n/source.json
// Usage: node scripts/i18n/dump-source.mjs
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import "dotenv/config";

const prisma = new PrismaClient();

const [products, categories, shopPages] = await Promise.all([
    prisma.$queryRaw`SELECT "id", "name", "description" FROM "Product" ORDER BY "createdAt"`,
    prisma.$queryRaw`SELECT "id", "title", "subtitle", "buttonText" FROM "Category" ORDER BY "order"`,
    prisma.$queryRaw`SELECT "id", "slug", "title", "subtitle", "prefixLabel" FROM "ShopPage"`,
]);

writeFileSync(
    new URL("./source.json", import.meta.url),
    JSON.stringify({ products, categories, shopPages }, null, 2),
    "utf8",
);
console.info(
    `dumped: ${products.length} products, ${categories.length} categories, ${shopPages.length} shop pages`,
);
await prisma.$disconnect();
