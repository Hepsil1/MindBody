import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const shopPages = [
    { slug: 'yoga', title: 'YOGA', subtitle: 'Для гармонії тіла та духу', heroImage: '/uploads/example-hero.jpg' },
    { slug: 'sport', title: 'SPORT', subtitle: 'Для активних тренувань', heroImage: '/uploads/example-hero.jpg' },
    { slug: 'dance', title: 'DANCE', subtitle: 'Для танців та свободи рухів', heroImage: '/uploads/example-hero.jpg' },
    { slug: 'casual', title: 'CASUAL', subtitle: 'Для повсякденного комфорту', heroImage: '/uploads/example-hero.jpg' },
    { slug: 'kids', title: 'KIDS', subtitle: 'Для наймолодших чемпіонів', heroImage: '/uploads/example-hero.jpg' },
    { slug: 'yogatools', title: 'YOGATOOLS', subtitle: 'Твій інвентар', heroImage: '/uploads/example-hero.jpg' }
];

const mockProducts = [];
let imgCounter = 0;

// Example images to use
const images = [
    '/uploads/IMG_4980.JPG',
    '/uploads/348_131123.jpg',
    '/uploads/595_131123.jpg',
    '/uploads/602_131123.jpg',
    '/uploads/IMG_6201.JPG'
];

function getImg() {
    const img = images[imgCounter % images.length];
    imgCounter++;
    return JSON.stringify([img]);
}

// Generate products based on user schema
function addProduct(name, shopPage, category, price) {
    mockProducts.push({
        name,
        description: 'Преміальна якість від українського бренду. Створено з любов\'ю.',
        price,
        comparePrice: price + 500,
        status: 'active',
        shopPageSlug: shopPage,
        category: category,
        images: getImg(),
        colors: JSON.stringify(['black', 'white']),
        sizes: JSON.stringify(['S', 'M', 'L'])
    });
}

// --- YOGA ---
addProduct('Комбінезон Yoga Sport Рукав', 'yoga', 'Комбінезони', 2500);
addProduct('Комбінезон Yoga Cotton Рукав', 'yoga', 'Комбінезони', 2600);
addProduct('Лосини Yoga Sport', 'yoga', 'Лосини', 1500);
addProduct('Лосини Yoga Cotton', 'yoga', 'Лосини', 1600);
addProduct('VELO Yoga Sport', 'yoga', 'VELO', 1400);
addProduct('Топ Yoga Sport', 'yoga', 'Топи', 900);
addProduct('Шорти Yoga Cotton', 'yoga', 'Шорти', 1200);
addProduct('Лонгслів Yoga Sport', 'yoga', 'Лонгсліви', 1300);
addProduct('Футболка Yoga', 'yoga', 'Футболки, майки', 800);

// --- SPORT ---
addProduct('Комбінезон Sport з коротким рукавом', 'sport', 'Комбінезони', 2400);
addProduct('Комбінезон Sport без рукава', 'sport', 'Комбінезони', 2300);
addProduct('Лосини Sport', 'sport', 'Лосини', 1500);
addProduct('VELO Sport', 'sport', 'VELO', 1400);
addProduct('Топ Sport', 'sport', 'Топи', 900);
addProduct('Шорти Sport', 'sport', 'Шорти', 1100);
addProduct('Лонгслів Sport', 'sport', 'Лонгсліви', 1400);
addProduct('Комплект Dance Sport', 'sport', 'Dance', 2900);

// --- DANCE ---
addProduct('Комбінезон Dance', 'dance', 'Комбінезони', 2500);
addProduct('Модель із сітки Dance', 'dance', 'Моделі із сітки', 1800);
addProduct('Комплект для пілону', 'dance', 'Комплекти пілон', 1900);

// --- CASUAL ---
addProduct('Костюм Casual', 'casual', 'Костюми', 3500);
addProduct('Сорочка Casual', 'casual', 'Сорочки', 1700);
addProduct('Футболка Casual', 'casual', 'Футболки', 900);
addProduct('Майка Casual', 'casual', 'Майки', 800);
addProduct('Шорти Casual', 'casual', 'Шорти', 1200);
addProduct('Термобілизна', 'casual', 'Термо', 2100);
addProduct('Худі Casual', 'casual', 'Худі/світшоти', 2500);
addProduct('Джогери Casual', 'casual', 'Джогери', 2200);

// --- KIDS ---
addProduct('Дитячий комбінезон рукав', 'kids', 'Комбінезони', 1800);
addProduct('Дитячий комбінезон без рукава', 'kids', 'Комбінезони', 1700);
addProduct('Дитячі VELO', 'kids', 'Комбінезони', 1500);

// --- YOGATOOLS ---
addProduct('Килимок для йоги PRO', 'yogatools', 'Інвентар', 1800);
addProduct('Блок для йоги корковий', 'yogatools', 'Інвентар', 400);
addProduct('Ремінь для розтяжки', 'yogatools', 'Інвентар', 300);

async function main() {
    console.log('Clearing old products/shoppages...');
    await prisma.product.deleteMany({});
    await prisma.shopPage.deleteMany({});
    
    console.log('Seeding Shop Pages...');
    for (const sp of shopPages) {
        await prisma.shopPage.create({ data: sp });
    }

    console.log(`Seeding ${mockProducts.length} Products...`);
    for (const p of mockProducts) {
        await prisma.product.create({ data: p });
    }
    
    // Create global filter config to map subcategories dynamically
    const filterConfig = {
        categories: {
            "Комбінезони": "Комбінезони",
            "Лосини": "Лосини",
            "VELO": "VELO",
            "Топи": "Топи",
            "Шорти": "Шорти",
            "Лонгсліви": "Лонгсліви",
            "Футболки, майки": "Футболки, майки",
            "Dance": "Dance",
            "Моделі із сітки": "Моделі із сітки",
            "Комплекти пілон": "Комплекти пілон",
            "Костюми": "Костюми",
            "Сорочки": "Сорочки",
            "Футболки": "Футболки",
            "Майки": "Майки",
            "Термо": "Термо",
            "Худі/світшоти": "Худі/світшоти",
            "Джогери": "Джогери",
            "Інвентар": "Інвентар"
        },
        colors: {
            "black": "Чорний",
            "white": "Білий"
        },
        sizes: ["S", "M", "L"]
    };
    
    await prisma.filterConfig.upsert({
        where: { id: 'global' },
        update: { config: JSON.stringify(filterConfig) },
        create: { id: 'global', config: JSON.stringify(filterConfig) }
    });

    console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
