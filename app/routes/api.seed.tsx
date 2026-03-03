import { prisma } from "../db.server";

const SAMPLE_PRODUCTS = [
    // === WOMEN ===
    {
        name: "SCHEMER WINTER Bell",
        description: "Стильний зимовий комбінезон з подвійною підкладкою. Ідеально підходить для тренувань у прохолодну погоду. Тканина з 4-way stretch забезпечує максимальну свободу рухів.",
        price: 3490,
        comparePrice: 3990,
        sku: "MB-W-001",
        stock: 25,
        status: "active",
        category: "women",
        images: JSON.stringify(["/pics1cloths/IMG_6201.JPG", "/pics1cloths/IMG_6202.JPG"]),
        colors: JSON.stringify(["black", "grey"]),
        sizes: JSON.stringify(["XS", "S", "M", "L"]),
        inventory: JSON.stringify([
            { size: "XS", color: "black", stock: 3 },
            { size: "S", color: "black", stock: 5 },
            { size: "M", color: "black", stock: 5 },
            { size: "L", color: "black", stock: 4 },
            { size: "S", color: "grey", stock: 3 },
            { size: "M", color: "grey", stock: 3 },
            { size: "L", color: "grey", stock: 2 },
        ]),
        shopPageSlug: "women",
    },
    {
        name: "SCHEMER CLASSIC",
        description: "Класичний комбінезон для йоги та фітнесу. Дихаюча тканина преміум-класу забезпечує комфорт протягом усього тренування.",
        price: 2990,
        sku: "MB-W-002",
        stock: 20,
        status: "active",
        category: "women",
        images: JSON.stringify(["/pics1cloths/IMG_6207.JPG", "/pics1cloths/IMG_6206.JPG"]),
        colors: JSON.stringify(["black", "navy"]),
        sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
        inventory: JSON.stringify([
            { size: "XS", color: "black", stock: 2 },
            { size: "S", color: "black", stock: 4 },
            { size: "M", color: "black", stock: 5 },
            { size: "L", color: "black", stock: 4 },
            { size: "XL", color: "black", stock: 2 },
            { size: "S", color: "navy", stock: 1 },
            { size: "M", color: "navy", stock: 1 },
            { size: "L", color: "navy", stock: 1 },
        ]),
        shopPageSlug: "women",
    },
    {
        name: "MIND Yoga Set",
        description: "Комплект для йоги: топ + легінси. Спеціальна технологія відведення вологи зберігає комфорт під час інтенсивних практик.",
        price: 2790,
        sku: "MB-W-003",
        stock: 18,
        status: "active",
        category: "women",
        images: JSON.stringify(["/pics1cloths/IMG_6209.JPG", "/pics1cloths/IMG_6210.JPG"]),
        colors: JSON.stringify(["black"]),
        sizes: JSON.stringify(["S", "M", "L"]),
        inventory: JSON.stringify([
            { size: "S", color: "black", stock: 6 },
            { size: "M", color: "black", stock: 7 },
            { size: "L", color: "black", stock: 5 },
        ]),
        shopPageSlug: "women",
    },
    {
        name: "BODY Leggings Pro",
        description: "Високі легінси з компресійним ефектом. Ідеальна посадка та підтримка під час будь-яких фізичних активностей.",
        price: 1690,
        sku: "MB-W-004",
        stock: 30,
        status: "active",
        category: "women",
        images: JSON.stringify(["/pics1cloths/IMG_6212.JPG", "/pics1cloths/IMG_6215.JPG"]),
        colors: JSON.stringify(["black", "grey"]),
        sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
        inventory: JSON.stringify([
            { size: "XS", color: "black", stock: 3 },
            { size: "S", color: "black", stock: 5 },
            { size: "M", color: "black", stock: 6 },
            { size: "L", color: "black", stock: 5 },
            { size: "XL", color: "black", stock: 3 },
            { size: "S", color: "grey", stock: 3 },
            { size: "M", color: "grey", stock: 3 },
            { size: "L", color: "grey", stock: 2 },
        ]),
        shopPageSlug: "women",
    },
    {
        name: "FLEX Crop Top",
        description: "Укорочений топ для фітнесу з вбудованою підтримкою. Легка, дихаюча тканина ідеально підходить для кардіо та силових тренувань.",
        price: 990,
        sku: "MB-W-005",
        stock: 22,
        status: "active",
        category: "women",
        images: JSON.stringify(["/pics1cloths/IMG_6203.JPG", "/pics1cloths/IMG_6204.JPG"]),
        colors: JSON.stringify(["black", "white"]),
        sizes: JSON.stringify(["XS", "S", "M", "L"]),
        inventory: JSON.stringify([
            { size: "XS", color: "black", stock: 3 },
            { size: "S", color: "black", stock: 4 },
            { size: "M", color: "black", stock: 4 },
            { size: "L", color: "black", stock: 3 },
            { size: "S", color: "white", stock: 3 },
            { size: "M", color: "white", stock: 3 },
            { size: "L", color: "white", stock: 2 },
        ]),
        shopPageSlug: "women",
    },
    {
        name: "POWER Training Set",
        description: "Тренувальний комплект: спортивний бра + шорти. Максимальна підтримка для високоінтенсивних тренувань.",
        price: 2290,
        sku: "MB-W-006",
        stock: 15,
        status: "active",
        category: "women",
        images: JSON.stringify(["/pics1cloths/IMG_6205.JPG"]),
        colors: JSON.stringify(["black"]),
        sizes: JSON.stringify(["S", "M", "L"]),
        inventory: JSON.stringify([
            { size: "S", color: "black", stock: 5 },
            { size: "M", color: "black", stock: 5 },
            { size: "L", color: "black", stock: 5 },
        ]),
        shopPageSlug: "women",
    },

    // === KIDS ===
    {
        name: "MINI SCHEMER",
        description: "Дитячий комбінезон для гімнастики та акробатики. Еластична тканина не сковує рухи юного спортсмена.",
        price: 1890,
        sku: "MB-K-001",
        stock: 20,
        status: "active",
        category: "kids",
        images: JSON.stringify(["/pics2cloths/IMG_5222.JPG", "/pics2cloths/IMG_5223.JPG"]),
        colors: JSON.stringify(["black", "pink"]),
        sizes: JSON.stringify(["110", "120", "130", "140"]),
        inventory: JSON.stringify([
            { size: "110", color: "black", stock: 3 },
            { size: "120", color: "black", stock: 4 },
            { size: "130", color: "black", stock: 4 },
            { size: "140", color: "black", stock: 3 },
            { size: "110", color: "pink", stock: 2 },
            { size: "120", color: "pink", stock: 2 },
            { size: "130", color: "pink", stock: 1 },
            { size: "140", color: "pink", stock: 1 },
        ]),
        shopPageSlug: "kids",
    },
    {
        name: "KIDS Gymnastic Pro",
        description: "Комбінезон для гімнастики з посиленими швами. Спеціальна конструкція для максимальної свободи рухів.",
        price: 2190,
        sku: "MB-K-002",
        stock: 18,
        status: "active",
        category: "kids",
        images: JSON.stringify(["/pics2cloths/IMG_5225.JPG", "/pics2cloths/IMG_5226.JPG"]),
        colors: JSON.stringify(["black"]),
        sizes: JSON.stringify(["110", "120", "130", "140", "150"]),
        inventory: JSON.stringify([
            { size: "110", color: "black", stock: 3 },
            { size: "120", color: "black", stock: 4 },
            { size: "130", color: "black", stock: 4 },
            { size: "140", color: "black", stock: 4 },
            { size: "150", color: "black", stock: 3 },
        ]),
        shopPageSlug: "kids",
    },
    {
        name: "LITTLE BODY Set",
        description: "Комплект для маленьких спортсменів: топ + легінси. Комфортна та безпечна тканина для дитячої шкіри.",
        price: 1590,
        sku: "MB-K-003",
        stock: 15,
        status: "active",
        category: "kids",
        images: JSON.stringify(["/pics2cloths/IMG_5217.JPG", "/pics2cloths/IMG_5221.JPG"]),
        colors: JSON.stringify(["black", "blue"]),
        sizes: JSON.stringify(["110", "120", "130"]),
        inventory: JSON.stringify([
            { size: "110", color: "black", stock: 3 },
            { size: "120", color: "black", stock: 3 },
            { size: "130", color: "black", stock: 2 },
            { size: "110", color: "blue", stock: 2 },
            { size: "120", color: "blue", stock: 3 },
            { size: "130", color: "blue", stock: 2 },
        ]),
        shopPageSlug: "kids",
    },
    {
        name: "MINI Yoga Bell",
        description: "Дитячий комбінезон-кльош для йоги. М'яка та приємна до тіла тканина для комфортних занять.",
        price: 1790,
        sku: "MB-K-004",
        stock: 16,
        status: "active",
        category: "kids",
        images: JSON.stringify(["/pics2cloths/IMG_5227.JPG", "/pics2cloths/IMG_5228.JPG"]),
        colors: JSON.stringify(["black"]),
        sizes: JSON.stringify(["110", "120", "130", "140"]),
        inventory: JSON.stringify([
            { size: "110", color: "black", stock: 4 },
            { size: "120", color: "black", stock: 4 },
            { size: "130", color: "black", stock: 4 },
            { size: "140", color: "black", stock: 4 },
        ]),
        shopPageSlug: "kids",
    },
    {
        name: "ACRO Junior",
        description: "Комбінезон для акробатики з гіпоалергенної тканини. Ідеальна посадка для тренувань та виступів.",
        price: 1990,
        sku: "MB-K-005",
        stock: 12,
        status: "active",
        category: "kids",
        images: JSON.stringify(["/pics2cloths/IMG_5229.JPG", "/pics2cloths/IMG_5224.JPG"]),
        colors: JSON.stringify(["black", "white"]),
        sizes: JSON.stringify(["120", "130", "140", "150"]),
        inventory: JSON.stringify([
            { size: "120", color: "black", stock: 2 },
            { size: "130", color: "black", stock: 2 },
            { size: "140", color: "black", stock: 2 },
            { size: "150", color: "black", stock: 2 },
            { size: "120", color: "white", stock: 1 },
            { size: "130", color: "white", stock: 1 },
            { size: "140", color: "white", stock: 1 },
            { size: "150", color: "white", stock: 1 },
        ]),
        shopPageSlug: "kids",
    },
    {
        name: "FLEXY Kids Leggings",
        description: "Дитячі легінси для будь-якого виду спорту. Еластична тканина з яскравим дизайном.",
        price: 890,
        sku: "MB-K-006",
        stock: 25,
        status: "active",
        category: "kids",
        images: JSON.stringify(["/pics2cloths/IMG_4971.JPG", "/pics2cloths/IMG_4976.JPG"]),
        colors: JSON.stringify(["black"]),
        sizes: JSON.stringify(["110", "120", "130", "140"]),
        inventory: JSON.stringify([
            { size: "110", color: "black", stock: 6 },
            { size: "120", color: "black", stock: 7 },
            { size: "130", color: "black", stock: 6 },
            { size: "140", color: "black", stock: 6 },
        ]),
        shopPageSlug: "kids",
    },
];

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        let created = 0;
        let skipped = 0;

        for (const product of SAMPLE_PRODUCTS) {
            // Check if SKU already exists
            const existing = await prisma.$queryRaw`
                SELECT id FROM "Product" WHERE sku = ${product.sku} LIMIT 1
            ` as any[];

            if (existing.length > 0) {
                skipped++;
                continue;
            }

            await prisma.$executeRawUnsafe(`
                INSERT INTO "Product" (id, name, description, price, "comparePrice", sku, stock, status, category, images, colors, sizes, inventory, "shopPageSlug", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
                crypto.randomUUID(),
                product.name,
                product.description,
                product.price,
                product.comparePrice || null,
                product.sku,
                product.stock,
                product.status,
                product.category,
                product.images,
                product.colors,
                product.sizes,
                product.inventory,
                product.shopPageSlug
            );
            created++;
        }

        return Response.json({
            success: true,
            message: `Створено ${created} товарів, пропущено ${skipped} (вже існують)`,
            created,
            skipped,
            total: SAMPLE_PRODUCTS.length,
        });
    } catch (error) {
        console.error("Seed error:", error);
        return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
}
