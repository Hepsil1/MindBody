import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testUpsert() {
    const id = "prod_1";
    const name = "Test Name";
    const description = "Test Desc";
    const price = 2400;
    const comparePrice = 2800;
    const sku = "prod_1";
    const status = "active";
    const stock = 10;
    const category = "leggings";
    const shopPageSlug = "women";
    const images = "[]";
    const colors = "[\"black\"]";
    const sizes = "[\"M\"]";
    const inventory = "{}";
    const now = new Date().toISOString();

    try {
        await prisma.$executeRawUnsafe(`
            INSERT INTO "Product" (id, name, description, price, "comparePrice", sku, status, stock, category, "shopPageSlug", images, colors, sizes, inventory, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::timestamp, $16::timestamp)
            ON CONFLICT(id) DO UPDATE SET
                name=EXCLUDED.name,
                description=EXCLUDED.description,
                price=EXCLUDED.price,
                "comparePrice"=EXCLUDED."comparePrice",
                sku=EXCLUDED.sku,
                status=EXCLUDED.status,
                stock=EXCLUDED.stock,
                category=EXCLUDED.category,
                "shopPageSlug"=EXCLUDED."shopPageSlug",
                images=EXCLUDED.images,
                colors=EXCLUDED.colors,
                sizes=EXCLUDED.sizes,
                inventory=EXCLUDED.inventory,
                "updatedAt"=EXCLUDED."updatedAt"
        `, id, name, description, price, comparePrice, sku, status, stock, category, shopPageSlug, images, colors, sizes, inventory, now, now);
        console.log("Upsert Success");
    } catch (e) {
        console.error("Upsert Failed", e);
    }
}

testUpsert().catch(console.error).finally(() => prisma.$disconnect());
