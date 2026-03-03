import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function seed() {
    console.log('Seeding products...')
    const products = [
        {
            name: "SCHEMER WINTER Bell",
            description: "Стильний зимовий комбінезон з подвійною підкладкою.",
            price: 3490,
            sku: "MB-W-001",
            stock: 25,
            status: "active",
            category: "women",
            shopPageSlug: "women",
            images: '["/pics1cloths/IMG_6201.JPG", "/pics1cloths/IMG_6202.JPG"]',
            colors: '["black", "grey"]',
            sizes: '["XS", "S", "M", "L"]'
        },
        {
            name: "SCHEMER CLASSIC",
            description: "Класичний комбінезон для йоги та фітнесу.",
            price: 2990,
            sku: "MB-W-002",
            stock: 20,
            status: "active",
            category: "women",
            shopPageSlug: "women",
            images: '["/pics1cloths/IMG_6207.JPG", "/pics1cloths/IMG_6206.JPG"]'
        },
        {
            name: "MINI SCHEMER",
            description: "Дитячий комбінезон для гімнастики та акробатики.",
            price: 1890,
            sku: "MB-K-001",
            stock: 20,
            status: "active",
            category: "kids",
            shopPageSlug: "kids",
            images: '["/pics2cloths/IMG_5222.JPG", "/pics2cloths/IMG_5223.JPG"]'
        }
    ]

    for (const p of products) {
        await prisma.product.upsert({
            where: { sku: p.sku },
            update: p,
            create: p
        })
    }

    // Seeding filters
    const filterConfig = {
        categories: {
            women: ["Комбінезони", "Комплекти", "Легінси", "Топи"],
            kids: ["Гімнастика", "Акробатика", "Легінси", "Комплекти"]
        },
        colors: {
            black: { label: "Чорний", hex: "#000000" },
            white: { label: "Білий", hex: "#ffffff" }
        },
        priceRanges: [
            { min: 0, max: 1000, label: "До 1000 грн" },
            { min: 1000, max: 2000, label: "1000 - 2000 грн" },
            { min: 2000, max: null, label: "Від 2000 грн" }
        ]
    };

    await prisma.filterConfig.upsert({
        where: { id: "global" },
        update: { config: JSON.stringify(filterConfig) },
        create: { id: "global", config: JSON.stringify(filterConfig) }
    })

    console.log('Seeding done.')
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
