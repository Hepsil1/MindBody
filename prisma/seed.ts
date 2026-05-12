import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------- demo product catalog (uses real photos from /public) ----------
// Sizes / colors stored as JSON strings (matches existing app code).
// Inventory format used by the storefront: array of { size, color, stock }.

const sizes = (arr: string[]) => JSON.stringify(arr);
const colors = (arr: string[]) => JSON.stringify(arr);
const imgs = (arr: string[]) => JSON.stringify(arr);
const inv = (rows: Array<{ size: string; color: string; stock: number }>) => JSON.stringify(rows);

const PRODUCTS = [
    {
        sku: "W-LEG-PRO-01",
        slug: "legginsy-pro",
        name: "Лосини PRO",
        category: "Лосини",
        shopPageSlug: "yoga",
        description:
            "Високі лосини з Premium Supplex. Тримають форму, відводять вологу, "
            + "дозволяють тілу дихати. Створені для йоги, акробатики та довгих практик.",
        metaTitle: "Лосини PRO Premium Supplex | MIND BODY",
        metaDescription:
            "Лосини PRO MIND BODY з преміум Supplex — для йоги, фітнесу, гімнастики. Створено в Україні.",
        price: 1490,
        comparePrice: 1790,
        status: "active",
        images: imgs(["/pics1cloths/IMG_6201.JPG", "/pics1cloths/IMG_6202.JPG", "/pics1cloths/IMG_6203.JPG"]),
        sizes: sizes(["XS", "S", "M", "L"]),
        colors: colors(["black", "navy", "marsala"]),
        inventory: inv([
            { size: "XS", color: "black", stock: 4 },
            { size: "S", color: "black", stock: 6 },
            { size: "M", color: "black", stock: 5 },
            { size: "L", color: "black", stock: 3 },
            { size: "S", color: "navy", stock: 2 },
            { size: "M", color: "marsala", stock: 4 },
        ]),
    },
    {
        sku: "W-TOP-MIRA-01",
        slug: "top-mira",
        name: "Топ MIRA",
        category: "Топи",
        shopPageSlug: "yoga",
        description:
            "Лаконічний топ з вбудованою підтримкою. М'яка тканина не стискає рух, "
            + "ідеальна посадка завдяки еластичній стрічці під грудьми.",
        price: 890,
        status: "active",
        images: imgs(["/pics1cloths/IMG_6204.JPG", "/pics1cloths/IMG_6205.JPG"]),
        sizes: sizes(["XS", "S", "M", "L"]),
        colors: colors(["black", "beige", "marsala"]),
        inventory: inv([
            { size: "XS", color: "black", stock: 6 },
            { size: "S", color: "black", stock: 8 },
            { size: "M", color: "beige", stock: 5 },
            { size: "L", color: "marsala", stock: 3 },
        ]),
    },
    {
        sku: "W-JUMP-SOLAR-01",
        slug: "kombinezon-solar",
        name: "Комбінезон SOLAR",
        category: "Комбінезони",
        shopPageSlug: "yoga",
        description:
            "Комбінезон на тонких бретелях, друга шкіра. Глибокий виріз на спині, "
            + "м'який пояс, який не врізається. Створено для тих, хто практикує перевернуті асани.",
        price: 2390,
        comparePrice: 2690,
        status: "active",
        images: imgs(["/pics1cloths/IMG_6206.JPG", "/pics1cloths/IMG_6207.JPG", "/pics1cloths/IMG_6209.JPG"]),
        sizes: sizes(["XS", "S", "M", "L"]),
        colors: colors(["black", "navy"]),
        inventory: inv([
            { size: "S", color: "black", stock: 3 },
            { size: "M", color: "black", stock: 4 },
            { size: "L", color: "navy", stock: 2 },
        ]),
    },
    {
        sku: "W-SHORTS-FLEX-01",
        slug: "shorty-flex",
        name: "Шорти FLEX",
        category: "Шорти",
        shopPageSlug: "yoga",
        description:
            "Шорти для гарячих практик і піляте. Дихаюча тканина, висока посадка, "
            + "не задираються в позах. Підходять і для повсякдення.",
        price: 790,
        status: "active",
        images: imgs(["/pics1cloths/IMG_6210.JPG", "/pics1cloths/IMG_6212.JPG"]),
        sizes: sizes(["XS", "S", "M", "L"]),
        colors: colors(["black", "marsala"]),
        inventory: inv([
            { size: "XS", color: "black", stock: 5 },
            { size: "S", color: "black", stock: 6 },
            { size: "M", color: "marsala", stock: 4 },
        ]),
    },
    {
        sku: "W-LONG-CALM-01",
        slug: "longsliv-calm",
        name: "Лонгслів CALM",
        category: "Лонгсліви",
        shopPageSlug: "yoga",
        description:
            "Легкий лонгслів для йоги в прохолодному залі або ранкових практик удома. "
            + "Сидить вільно у плечах, прилягає по талії.",
        price: 1190,
        status: "active",
        images: imgs(["/pics1cloths/IMG_6215.JPG", "/pics2cloths/IMG_5217.JPG"]),
        sizes: sizes(["S", "M", "L"]),
        colors: colors(["beige", "black"]),
        inventory: inv([
            { size: "S", color: "beige", stock: 4 },
            { size: "M", color: "beige", stock: 5 },
            { size: "L", color: "black", stock: 2 },
        ]),
    },
    {
        sku: "W-LEG-SPORT-01",
        slug: "legginsy-sport",
        name: "Лосини SPORT",
        category: "Лосини",
        shopPageSlug: "sport",
        description:
            "Для бігу, тренажерки та інтенсивних кардіо. Компресійна посадка, "
            + "потаємна кишеня під ключик або карту.",
        price: 1290,
        status: "active",
        images: imgs(["/generalpics/333_131123.jpg", "/generalpics/338_131123.jpg"]),
        sizes: sizes(["XS", "S", "M", "L"]),
        colors: colors(["black", "navy"]),
        inventory: inv([
            { size: "S", color: "black", stock: 5 },
            { size: "M", color: "black", stock: 6 },
            { size: "L", color: "navy", stock: 3 },
        ]),
    },
    {
        sku: "W-VELO-AERA-01",
        slug: "velo-aera",
        name: "VELO AERA",
        category: "VELO",
        shopPageSlug: "sport",
        description:
            "Велосипедні шорти середньої довжини. Анатомічний крій, силіконова стрічка "
            + "знизу — не з'їжджають.",
        price: 990,
        status: "active",
        images: imgs(["/generalpics/347_131123.jpg", "/generalpics/348_131123.jpg"]),
        sizes: sizes(["XS", "S", "M", "L"]),
        colors: colors(["black"]),
        inventory: inv([
            { size: "S", color: "black", stock: 4 },
            { size: "M", color: "black", stock: 5 },
            { size: "L", color: "black", stock: 3 },
        ]),
    },
    {
        sku: "W-DANCE-MESH-01",
        slug: "komplekt-mesh",
        name: "Комплект MESH",
        category: "Моделі із сітки",
        shopPageSlug: "dance",
        description:
            "Комплект для пілону та контемпорарі: топ + лосини зі вставками із дихаючої сітки. "
            + "Дозволяє рухатись вільно і ефектно виглядати на сцені.",
        price: 2890,
        comparePrice: 3190,
        status: "active",
        images: imgs(["/generalpics/374_131123.jpg", "/generalpics/585_131123.jpg", "/generalpics/588_131123.jpg"]),
        sizes: sizes(["S", "M", "L"]),
        colors: colors(["black", "marsala"]),
        inventory: inv([
            { size: "S", color: "black", stock: 2 },
            { size: "M", color: "black", stock: 3 },
            { size: "M", color: "marsala", stock: 2 },
        ]),
    },
    {
        sku: "W-DANCE-PILON-01",
        slug: "komplekt-pilon",
        name: "Комплект для пілону",
        category: "Комплекти пілон",
        shopPageSlug: "dance",
        description:
            "Високі шорти + укорочений топ. Тканина з ефектом «другої шкіри», "
            + "не сповзає на перевернутих фігурах.",
        price: 1990,
        status: "active",
        images: imgs(["/generalpics/595_131123.jpg", "/generalpics/602_131123.jpg"]),
        sizes: sizes(["XS", "S", "M"]),
        colors: colors(["black", "marsala"]),
        inventory: inv([
            { size: "S", color: "black", stock: 3 },
            { size: "M", color: "marsala", stock: 2 },
        ]),
    },
    {
        sku: "C-HOODIE-EASE-01",
        slug: "hudi-ease",
        name: "Худі EASE",
        category: "Худі/світшоти",
        shopPageSlug: "casual",
        description:
            "М'яке худі з петлями для довгих ранків і повільних днів. "
            + "Зовні softstretch — всередині брашований трикотаж.",
        price: 1890,
        status: "active",
        images: imgs(["/pics2cloths/IMG_4971.JPG", "/pics2cloths/IMG_4976.JPG"]),
        sizes: sizes(["S", "M", "L"]),
        colors: colors(["beige", "black"]),
        inventory: inv([
            { size: "S", color: "beige", stock: 4 },
            { size: "M", color: "beige", stock: 6 },
            { size: "L", color: "black", stock: 3 },
        ]),
    },
    {
        sku: "C-JOGGER-FLOW-01",
        slug: "dzhogery-flow",
        name: "Джогери FLOW",
        category: "Джогери",
        shopPageSlug: "casual",
        description:
            "Зручні джогери з еластичним поясом і манжетами. Висока посадка, "
            + "м'який трикотаж — для дому, прогулянок та подорожей.",
        price: 1390,
        status: "active",
        images: imgs(["/pics2cloths/IMG_4980.JPG", "/pics2cloths/IMG_4983.JPG"]),
        sizes: sizes(["S", "M", "L"]),
        colors: colors(["black", "beige"]),
        inventory: inv([
            { size: "S", color: "black", stock: 5 },
            { size: "M", color: "black", stock: 5 },
            { size: "L", color: "beige", stock: 3 },
        ]),
    },
    {
        sku: "K-JUMP-MINI-01",
        slug: "kombinezon-mini",
        name: "Дитячий комбінезон MINI",
        category: "Комбінезони",
        shopPageSlug: "kids",
        description:
            "Для маленьких гімнасток і танцівниць. Тканина, що тягнеться у 4 напрямках. "
            + "Не врізається в плечі, не натирає шкіру.",
        price: 1290,
        status: "active",
        images: imgs(["/pics2cloths/IMG_5221.JPG", "/pics2cloths/IMG_5222.JPG", "/pics2cloths/IMG_5223.JPG"]),
        sizes: sizes(["XS", "S", "M"]),
        colors: colors(["pink", "marsala", "navy"]),
        inventory: inv([
            { size: "XS", color: "pink", stock: 4 },
            { size: "S", color: "pink", stock: 5 },
            { size: "M", color: "marsala", stock: 3 },
        ]),
    },
];

const REVIEWS_BY_SLUG: Record<string, Array<{ author: string; rating: number; text: string }>> = {
    "legginsy-pro": [
        { author: "Олена К.", rating: 5, text: "Найкращі лосини, які тільки тримала в руках. Тканина не просвічує, тримає форму після десяти прань. Дякую за якість!" },
        { author: "Юлія Б.", rating: 5, text: "Ношу на йогу і просто з худі — універсальні. Висока посадка дуже зручна." },
        { author: "Анастасія", rating: 4, text: "Дуже добре сидять, але в порівнянні з минулою серією колір трохи темніший. Все одно щаслива :)" },
    ],
    "top-mira": [
        { author: "Марина", rating: 5, text: "Топ для йоги, в якому не треба думати про підтримку. Сидить як друга шкіра." },
    ],
    "kombinezon-solar": [
        { author: "Катерина", rating: 5, text: "Купила для акробатичного класу. Не сповзає, навіть у перевернутих позах. Колір розкішний." },
        { author: "Софія", rating: 5, text: "Це любов. Якість і посадка — на рівні західних брендів за втричі дорожче." },
    ],
    "komplekt-mesh": [
        { author: "Лана", rating: 5, text: "Сидить ідеально, у залі всі питали де купила. Дякую!" },
    ],
    "hudi-ease": [
        { author: "Іра", rating: 4, text: "М'яке і затишне. Розмір трохи більший — беріть на розмір менше якщо хочете oversize-fit." },
    ],
    "kombinezon-mini": [
        { author: "Тетяна Г.", rating: 5, text: "Донька в захваті. Каже — найзручніший комбез для гімнастики. Якість справді преміум." },
    ],
};

async function main() {
    console.log("🌱 Seeding database…");

    // ---------- demo customers ----------
    const customer1 = await prisma.customer.upsert({
        where: { email: "olena@example.com" },
        update: {},
        create: { firstName: "Олена", lastName: "Коваль", email: "olena@example.com", phone: "+380501234567" },
    });
    await prisma.customer.upsert({
        where: { email: "mark@example.com" },
        update: {},
        create: { firstName: "Марк", lastName: "Шевченко", email: "mark@example.com", phone: "+380679876543" },
    });

    // ---------- demo products ----------
    for (const p of PRODUCTS) {
        await prisma.product.upsert({
            where: { sku: p.sku },
            update: {
                name: p.name,
                description: p.description,
                price: p.price,
                comparePrice: p.comparePrice,
                category: p.category,
                shopPageSlug: p.shopPageSlug,
                images: p.images,
                sizes: p.sizes,
                colors: p.colors,
                inventory: p.inventory,
                status: p.status,
                slug: p.slug,
                metaTitle: p.metaTitle,
                metaDescription: p.metaDescription,
            },
            create: {
                sku: p.sku,
                slug: p.slug,
                name: p.name,
                description: p.description,
                price: p.price,
                comparePrice: p.comparePrice,
                stock: 50,
                status: p.status,
                category: p.category,
                shopPageSlug: p.shopPageSlug,
                images: p.images,
                sizes: p.sizes,
                colors: p.colors,
                inventory: p.inventory,
                metaTitle: p.metaTitle,
                metaDescription: p.metaDescription,
            },
        });
        console.log(`  • ${p.name} (${p.shopPageSlug}/${p.category})`);
    }

    // ---------- demo reviews (approved) ----------
    for (const [slug, reviews] of Object.entries(REVIEWS_BY_SLUG)) {
        const product = await prisma.product.findUnique({ where: { slug } });
        if (!product) continue;

        // Clear previous demo reviews for this product (idempotent)
        await prisma.review.deleteMany({ where: { productId: product.id, isVerified: false } });

        for (const r of reviews) {
            await prisma.review.create({
                data: {
                    productId: product.id,
                    authorName: r.author,
                    rating: r.rating,
                    text: r.text,
                    isApproved: true,
                    isVerified: false,
                },
            });
        }
    }

    // ---------- demo promo codes ----------
    const promos = [
        { code: "WELCOME10", discountType: "percent", discountValue: 10, minOrder: 0, maxUses: null as number | null, isActive: true },
        { code: "MINDBODY15", discountType: "percent", discountValue: 15, minOrder: 1500, maxUses: 100, isActive: true },
        { code: "FREESHIP", discountType: "fixed", discountValue: 100, minOrder: 1000, maxUses: null as number | null, isActive: true },
    ];
    for (const p of promos) {
        await prisma.promoCode.upsert({
            where: { code: p.code },
            update: { discountType: p.discountType, discountValue: p.discountValue, minOrder: p.minOrder, maxUses: p.maxUses ?? undefined, isActive: p.isActive },
            create: { ...p, maxUses: p.maxUses ?? undefined },
        });
    }

    // ---------- one historical order (so customer profile isn't empty) ----------
    const firstProduct = await prisma.product.findFirst({ where: { sku: PRODUCTS[0].sku } });
    if (firstProduct) {
        await prisma.order.upsert({
            where: { orderNumber: 1001 },
            update: {},
            create: {
                orderNumber: 1001,
                customerId: customer1.id,
                status: "delivered",
                paymentStatus: "paid",
                total: Number(firstProduct.price),
                items: {
                    create: {
                        productId: firstProduct.id,
                        quantity: 1,
                        price: Number(firstProduct.price),
                        size: "M",
                        color: "black",
                    },
                },
            },
        });
    }

    console.log(`✅ Seeded ${PRODUCTS.length} products, ${Object.keys(REVIEWS_BY_SLUG).length} review sets, 3 promo codes.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
