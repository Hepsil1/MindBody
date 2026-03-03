import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const resetScript = async () => {
    // 1. Delete all existing products, orders, categories
    await prisma.$executeRawUnsafe(`DELETE FROM "OrderItem"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Order"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Product"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Category"`);

    // 2. Insert standard categories for the Home page
    const categories = [
        {
            id: "cat_jumpsuits",
            title: "Комбінезони",
            subtitle: "Ідеальне облягання",
            image: "/pics1cloths/IMG_6201.JPG",
            imagePos: "center center",
            link: "/shop/women",
            buttonText: "Переглянути",
            order: 1
        },
        {
            id: "cat_sets",
            title: "Комплекти",
            subtitle: "Для яскравих тренувань",
            image: "/pics1cloths/IMG_5739.JPG",
            imagePos: "center 20%",
            link: "/shop/women",
            buttonText: "Переглянути все",
            order: 2
        }
    ];

    for (const cat of categories) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO "Category" (id, title, subtitle, image, "imagePos", link, "buttonText", "order", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, cat.id, cat.title, cat.subtitle, cat.image, cat.imagePos, cat.link, cat.buttonText, cat.order);
    }

    // 3. Insert Ukrainian Products matched to filters
    const products = [
        {
            id: "prod_1",
            name: "Комбінезон «WINGS» Чорний",
            description: "Відкрита спинка з витонченим плетінням. Ідеальний для йоги та гімнастики. Тканина дихає та не сковує рухів.",
            price: 2400,
            comparePrice: 2800,
            category: "jumpsuit",
            shopPageSlug: "women",
            images: '["/pics1cloths/IMG_6201.JPG", "/pics1cloths/IMG_6204.JPG"]',
            colors: '["black"]',
            sizes: '["S", "M"]',
            status: "active",
            stock: 20
        },
        {
            id: "prod_2",
            name: "Спортивний комплект «SCHEMER WINTER» Синій",
            description: "Зимовий топ зі штанами кльош. М'яка утеплена тканина. Ідеально підходить для розігріву перед тренуваннями.",
            price: 3200,
            comparePrice: null,
            category: "sets",
            shopPageSlug: "women",
            images: '["/pics1cloths/IMG_5728.JPG", "/pics1cloths/IMG_5730.JPG", "/pics1cloths/IMG_5736.JPG"]',
            colors: '["blue"]',
            sizes: '["M", "L"]',
            status: "active",
            stock: 15
        },
        {
            id: "prod_3",
            name: "Легінси «CLASSIC» Білі",
            description: "Базові класичні легінси з високою посадкою. Підкреслюють фігуру.",
            price: 1500,
            comparePrice: 1800,
            category: "leggings",
            shopPageSlug: "women",
            images: '["/pics1cloths/IMG_5739.JPG", "/pics1cloths/IMG_5742.JPG"]',
            colors: '["white"]',
            sizes: '["XS", "S"]',
            status: "active",
            stock: 30
        },
        {
            id: "prod_4",
            name: "Дитячий комбінезон «MINI SCHEMER»",
            description: "Зручний комбінезон для юних гімнасток. Дуже еластичний, безпечний для шкіри малюків.",
            price: 1200,
            comparePrice: null,
            category: "jumpsuit",
            shopPageSlug: "kids",
            images: '["/pics1cloths/IMG_5747.JPG"]',
            colors: '["pink", "white"]',
            sizes: '["34", "36", "38"]',
            status: "active",
            stock: 15
        },
        {
            id: "prod_5",
            name: "Дитячий топ «KIDS Flex»",
            description: "Базовий топ для дівчат. Ідеальний для акробатики.",
            price: 800,
            comparePrice: null,
            category: "tops",
            shopPageSlug: "kids",
            images: '["/pics1cloths/IMG_5730.JPG"]',
            colors: '["blue", "black"]',
            sizes: '["34", "36"]',
            status: "active",
            stock: 25
        }
    ];

    for (const p of products) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO "Product" (id, name, description, price, "comparePrice", sku, status, stock, category, "shopPageSlug", images, colors, sizes, inventory, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, p.id, p.name, p.description, p.price, p.comparePrice, p.id, p.status, p.stock, p.category, p.shopPageSlug, p.images, p.colors, p.sizes);
    }

    // 4. Force global filter configuration
    const defaultConfig = {
        categories: {
            "jumpsuit": "Комбінезони",
            "leggings": "Легінси",
            "tops": "Топи",
            "shorts": "Шорти",
            "jackets": "Куртки",
            "sets": "Комплекти"
        },
        colors: {
            "black": "Чорний",
            "white": "Білий",
            "blue": "Синій",
            "pink": "Рожевий",
            "green": "Зелений",
            "gray": "Сірий",
            "red": "Червоний",
            "other": "Інші"
        },
        priceRanges: [
            { id: "low", label: "До 1000 ₴", min: 0, max: 1000 },
            { id: "mid", label: "1000 - 3000 ₴", min: 1000, max: 3000 },
            { id: "high", label: "3000 - 5000 ₴", min: 3000, max: 5000 },
            { id: "premium", label: "Від 5000 ₴", min: 5000, max: 999999 }
        ],
        sizes: ["L", "M", "S", "XL", "XS", "XXS", "34", "36", "38", "40", "42"]
    };

    await prisma.$executeRawUnsafe(
        `INSERT INTO "FilterConfig" (id, config, "updatedAt") VALUES ('global', $1, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET config = $1, "updatedAt" = CURRENT_TIMESTAMP`,
        JSON.stringify(defaultConfig)
    );

    console.log("Database reset and seeded with Ukrainian data successfully!");
};

resetScript()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
