import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────────
// REAL IMAGE POOLS — from actual files in /public
// ────────────────────────────────────────────────────────────────

const WOMEN_IMGS = [
    '/pics1cloths/IMG_6201.JPG', '/pics1cloths/IMG_6202.JPG', '/pics1cloths/IMG_6203.JPG',
    '/pics1cloths/IMG_6204.JPG', '/pics1cloths/IMG_6205.JPG', '/pics1cloths/IMG_6206.JPG',
    '/pics1cloths/IMG_6207.JPG', '/pics1cloths/IMG_6209.JPG', '/pics1cloths/IMG_6210.JPG',
    '/pics1cloths/IMG_6212.JPG', '/pics1cloths/IMG_6215.JPG',
];

const KIDS_IMGS = [
    '/pics2cloths/IMG_4971.JPG', '/pics2cloths/IMG_4976.JPG', '/pics2cloths/IMG_4980.JPG',
    '/pics2cloths/IMG_4983.JPG', '/pics2cloths/IMG_4984.JPG', '/pics2cloths/IMG_4987.JPG',
    '/pics2cloths/IMG_4988.JPG', '/pics2cloths/IMG_4990.JPG', '/pics2cloths/IMG_5217.JPG',
    '/pics2cloths/IMG_5221.JPG', '/pics2cloths/IMG_5222.JPG', '/pics2cloths/IMG_5223.JPG',
    '/pics2cloths/IMG_5224.JPG', '/pics2cloths/IMG_5225.JPG', '/pics2cloths/IMG_5226.JPG',
    '/pics2cloths/IMG_5227.JPG', '/pics2cloths/IMG_5228.JPG', '/pics2cloths/IMG_5229.JPG',
];

const GENERAL_IMGS = [
    '/generalpics/333_131123.jpg', '/generalpics/338_131123.jpg', '/generalpics/347_131123.jpg',
    '/generalpics/348_131123.jpg', '/generalpics/374_131123.jpg', '/generalpics/585_131123.jpg',
    '/generalpics/588_131123.jpg', '/generalpics/595_131123.jpg', '/generalpics/602_131123.jpg',
    '/generalpics/IMG_20260110_111436_016.jpg', '/generalpics/IMG_20260110_111436_421.jpg',
    '/generalpics/IMG_20260110_111436_689.jpg', '/generalpics/IMG_20260110_111436_746.jpg',
];

// Counters per pool to cycle through images
const counters = { women: 0, kids: 0, general: 0 };

function pickImages(pool, counterKey, count = 2) {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(pool[counters[counterKey] % pool.length]);
        counters[counterKey]++;
    }
    return result;
}

// ────────────────────────────────────────────────────────────────
// SHOP PAGES
// ────────────────────────────────────────────────────────────────

const shopPages = [
    { slug: 'yoga',      title: 'YOGA',      subtitle: 'Для гармонії тіла та духу',   heroImage: '/pics1cloths/IMG_6201.JPG' },
    { slug: 'sport',     title: 'SPORT',     subtitle: 'Для активних тренувань',       heroImage: '/pics1cloths/IMG_6207.JPG' },
    { slug: 'dance',     title: 'DANCE',     subtitle: 'Для танців та свободи рухів',  heroImage: '/generalpics/595_131123.jpg' },
    { slug: 'casual',    title: 'CASUAL',    subtitle: 'Для повсякденного комфорту',   heroImage: '/generalpics/348_131123.jpg' },
    { slug: 'kids',      title: 'KIDS',      subtitle: 'Для наймолодших чемпіонів',    heroImage: '/pics2cloths/IMG_5222.JPG' },
    { slug: 'yogatools', title: 'YOGATOOLS', subtitle: 'Твій інвентар',                heroImage: '/generalpics/374_131123.jpg' },
];

// ────────────────────────────────────────────────────────────────
// CATEGORIES  (for homepage grid)
// ────────────────────────────────────────────────────────────────

const categories = [
    { title: 'YOGA',      subtitle: 'Для гармонії тіла та духу',  image: '/pics1cloths/IMG_6201.JPG', link: '/shop/yoga',      buttonText: 'Переглянути', order: 1 },
    { title: 'SPORT',     subtitle: 'Для активних тренувань',      image: '/pics1cloths/IMG_6210.JPG', link: '/shop/sport',     buttonText: 'Переглянути', order: 2 },
    { title: 'DANCE',     subtitle: 'Свобода рухів',               image: '/generalpics/595_131123.jpg', link: '/shop/dance',   buttonText: 'Переглянути', order: 3 },
    { title: 'CASUAL',    subtitle: 'Повсякденний комфорт',        image: '/generalpics/348_131123.jpg', link: '/shop/casual',  buttonText: 'Переглянути', order: 4 },
    { title: 'KIDS',      subtitle: 'Для наймолодших',             image: '/pics2cloths/IMG_5222.JPG',   link: '/shop/kids',    buttonText: 'Переглянути', order: 5 },
    { title: 'YOGATOOLS', subtitle: 'Аксесуари та інвентар',       image: '/generalpics/374_131123.jpg',  link: '/shop/yogatools', buttonText: 'Переглянути', order: 6 },
];

// ────────────────────────────────────────────────────────────────
// PRODUCTS
// ────────────────────────────────────────────────────────────────

const mockProducts = [];

function addProduct(name, shopPage, category, price, imgPool, imgKey, imgCount = 2) {
    const imgs = pickImages(imgPool, imgKey, imgCount);
    const sizes = shopPage === 'yogatools' ? null : JSON.stringify(['XS', 'S', 'M', 'L', 'XL']);
    const colors = shopPage === 'yogatools' ? null : JSON.stringify(['black', 'white']);

    // Build inventory array with realistic stock
    let inventory = null;
    if (sizes && colors) {
        const sizeArr = JSON.parse(sizes);
        const colorArr = JSON.parse(colors);
        const inv = [];
        for (const s of sizeArr) {
            for (const c of colorArr) {
                inv.push({ size: s, color: c, stock: Math.floor(Math.random() * 8) + 2 });
            }
        }
        inventory = JSON.stringify(inv);
    }

    const totalStock = inventory
        ? JSON.parse(inventory).reduce((sum, v) => sum + v.stock, 0)
        : Math.floor(Math.random() * 20) + 5;

    mockProducts.push({
        name,
        description: 'Преміальна якість від українського бренду MIND BODY. Створено з любов\'ю в Україні. Тканина Supplex® + Lycra® забезпечує ідеальну посадку та 4-way stretch.',
        price,
        comparePrice: Math.random() > 0.5 ? price + 400 + Math.floor(Math.random() * 300) : null,
        status: 'active',
        shopPageSlug: shopPage,
        category,
        images: JSON.stringify(imgs),
        colors,
        sizes,
        inventory,
        stock: totalStock,
    });
}

// ── YOGA (women's images) ──
addProduct('Комбінезон Yoga Sport Рукав',   'yoga', 'Комбінезони', 2500, WOMEN_IMGS, 'women', 3);
addProduct('Комбінезон Yoga Cotton Рукав',  'yoga', 'Комбінезони', 2600, WOMEN_IMGS, 'women', 3);
addProduct('Лосини Yoga Sport',              'yoga', 'Лосини',     1500, WOMEN_IMGS, 'women', 2);
addProduct('Лосини Yoga Cotton',             'yoga', 'Лосини',     1600, WOMEN_IMGS, 'women', 2);
addProduct('VELO Yoga Sport',                'yoga', 'VELO',       1400, GENERAL_IMGS, 'general', 2);
addProduct('Топ Yoga Sport',                 'yoga', 'Топи',       900,  WOMEN_IMGS, 'women', 2);
addProduct('Шорти Yoga Cotton',              'yoga', 'Шорти',      1200, GENERAL_IMGS, 'general', 2);
addProduct('Лонгслів Yoga Sport',            'yoga', 'Лонгсліви',  1300, WOMEN_IMGS, 'women', 2);
addProduct('Футболка Yoga',                  'yoga', 'Футболки, майки', 800, GENERAL_IMGS, 'general', 2);

// ── SPORT (mix women + general) ──
addProduct('Комбінезон Sport Рукав',          'sport', 'Комбінезони', 2400, WOMEN_IMGS, 'women', 3);
addProduct('Комбінезон Sport без рукава',     'sport', 'Комбінезони', 2300, GENERAL_IMGS, 'general', 2);
addProduct('Лосини Sport',                    'sport', 'Лосини',     1500, WOMEN_IMGS, 'women', 2);
addProduct('VELO Sport',                      'sport', 'VELO',       1400, GENERAL_IMGS, 'general', 2);
addProduct('Топ Sport',                       'sport', 'Топи',       900,  WOMEN_IMGS, 'women', 2);
addProduct('Шорти Sport',                     'sport', 'Шорти',      1100, GENERAL_IMGS, 'general', 2);
addProduct('Лонгслів Sport',                  'sport', 'Лонгсліви',  1400, WOMEN_IMGS, 'women', 2);
addProduct('Комплект Dance Sport',            'sport', 'Dance',      2900, GENERAL_IMGS, 'general', 2);

// ── DANCE (general images) ──
addProduct('Комбінезон Dance',                'dance', 'Комбінезони',      2500, GENERAL_IMGS, 'general', 3);
addProduct('Модель із сітки Dance',           'dance', 'Моделі із сітки', 1800, GENERAL_IMGS, 'general', 2);
addProduct('Комплект для пілону',             'dance', 'Комплекти пілон', 1900, GENERAL_IMGS, 'general', 2);

// ── CASUAL (general + women) ──
addProduct('Костюм Casual',                   'casual', 'Костюми',        3500, GENERAL_IMGS, 'general', 3);
addProduct('Сорочка Casual',                   'casual', 'Сорочки',        1700, GENERAL_IMGS, 'general', 2);
addProduct('Футболка Casual',                  'casual', 'Футболки',       900,  WOMEN_IMGS, 'women', 2);
addProduct('Майка Casual',                     'casual', 'Майки',          800,  WOMEN_IMGS, 'women', 2);
addProduct('Шорти Casual',                     'casual', 'Шорти',          1200, GENERAL_IMGS, 'general', 2);
addProduct('Термобілизна',                     'casual', 'Термо',          2100, WOMEN_IMGS, 'women', 2);
addProduct('Худі Casual',                      'casual', 'Худі/світшоти',  2500, GENERAL_IMGS, 'general', 2);
addProduct('Джогери Casual',                   'casual', 'Джогери',        2200, GENERAL_IMGS, 'general', 2);

// ── KIDS (kids images) ──
addProduct('Дитячий комбінезон рукав',         'kids', 'Комбінезони', 1800, KIDS_IMGS, 'kids', 3);
addProduct('Дитячий комбінезон без рукава',    'kids', 'Комбінезони', 1700, KIDS_IMGS, 'kids', 3);
addProduct('Дитячі VELO',                      'kids', 'Комбінезони', 1500, KIDS_IMGS, 'kids', 3);

// ── YOGATOOLS (general images, no sizes/colors) ──
addProduct('Килимок для йоги PRO',             'yogatools', 'Інвентар', 1800, GENERAL_IMGS, 'general', 2);
addProduct('Блок для йоги корковий',           'yogatools', 'Інвентар', 400,  GENERAL_IMGS, 'general', 2);
addProduct('Ремінь для розтяжки',              'yogatools', 'Інвентар', 300,  GENERAL_IMGS, 'general', 2);

// ────────────────────────────────────────────────────────────────
// FILTER CONFIG
// ────────────────────────────────────────────────────────────────

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
        "Інвентар": "Інвентар",
    },
    colors: {
        "black": "Чорний",
        "white": "Білий",
        "blue": "Синій",
        "pink": "Рожевий",
        "green": "Зелений",
        "gray": "Сірий",
        "red": "Червоний",
        "purple": "Фіолетовий",
        "marsala": "Марсала",
        "brown": "Коричневий",
        "beige": "Бежевий",
    },
    priceRanges: [
        { label: "До 1000 ₴", min: 0, max: 1000 },
        { label: "1000 – 2000 ₴", min: 1000, max: 2000 },
        { label: "2000 – 3000 ₴", min: 2000, max: 3000 },
        { label: "Від 3000 ₴", min: 3000, max: 99999 },
    ],
};

// ────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────

async function main() {
    console.log('🗑️  Clearing old data...');
    await prisma.product.deleteMany({});
    await prisma.shopPage.deleteMany({});
    await prisma.category.deleteMany({});

    console.log('📄 Seeding Shop Pages...');
    for (const sp of shopPages) {
        await prisma.shopPage.create({ data: sp });
    }

    console.log('🏷️  Seeding Categories...');
    for (const cat of categories) {
        await prisma.category.create({ data: cat });
    }

    console.log(`📦 Seeding ${mockProducts.length} Products...`);
    for (const p of mockProducts) {
        await prisma.product.create({ data: p });
    }

    console.log('⚙️  Upserting Filter Config...');
    await prisma.filterConfig.upsert({
        where: { id: 'global' },
        update: { config: JSON.stringify(filterConfig) },
        create: { id: 'global', config: JSON.stringify(filterConfig) },
    });

    const count = await prisma.product.count();
    console.log(`\n✅ Done! ${count} products seeded with real images.`);
    console.log('   Shop Pages: yoga, sport, dance, casual, kids, yogatools');
    console.log('   Categories: 6 homepage tiles');
    console.log('   Filter Config: global');
}

main()
    .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
