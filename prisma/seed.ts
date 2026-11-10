import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------- demo product catalog (uses real photos from /public) ----------
// Sizes / colors stored as JSON strings (matches existing app code).
// Inventory format used by the storefront: array of { size, color, stock }.

const sizes = (arr: string[]) => JSON.stringify(arr);
const colors = (arr: string[]) => JSON.stringify(arr);
const imgs = (arr: string[]) => JSON.stringify(arr);
const inv = (rows: Array<{ size: string; color: string; stock: number }>) => JSON.stringify(rows);

// Products are managed dynamically via Telegram catalog / Admin panel.
// Dummy products are omitted so running seed never reintroduces placeholders.
const PRODUCTS: Array<{
    sku: string;
    slug: string;
    name: string;
    category: string;
    shopPageSlug: string;
    description: string;
    price: number;
    comparePrice?: number;
    status: string;
    images: string;
    sizes: string;
    colors: string;
    inventory: string;
    metaTitle?: string;
    metaDescription?: string;
}> = [];

const REVIEWS_BY_SLUG: Record<string, Array<{ author: string; rating: number; text: string }>> = {
    "legginsy-pro": [
        {
            author: "Олена К.",
            rating: 5,
            text: "Найкращі лосини, які тільки тримала в руках. Тканина не просвічує, тримає форму після десяти прань. Дякую за якість!",
        },
        {
            author: "Юлія Б.",
            rating: 5,
            text: "Ношу на йогу і просто з худі — універсальні. Висока посадка дуже зручна.",
        },
        {
            author: "Анастасія",
            rating: 4,
            text: "Дуже добре сидять, але в порівнянні з минулою серією колір трохи темніший. Все одно щаслива :)",
        },
    ],
    "top-mira": [
        {
            author: "Марина",
            rating: 5,
            text: "Топ для йоги, в якому не треба думати про підтримку. Сидить як друга шкіра.",
        },
    ],
    "kombinezon-solar": [
        {
            author: "Катерина",
            rating: 5,
            text: "Купила для акробатичного класу. Не сповзає, навіть у перевернутих позах. Колір розкішний.",
        },
        {
            author: "Софія",
            rating: 5,
            text: "Це любов. Якість і посадка — на рівні західних брендів за втричі дорожче.",
        },
    ],
    "komplekt-mesh": [
        { author: "Лана", rating: 5, text: "Сидить ідеально, у залі всі питали де купила. Дякую!" },
    ],
    "hudi-ease": [
        {
            author: "Іра",
            rating: 4,
            text: "М'яке і затишне. Розмір трохи більший — беріть на розмір менше якщо хочете oversize-fit.",
        },
    ],
    "kombinezon-mini": [
        {
            author: "Тетяна Г.",
            rating: 5,
            text: "Донька в захваті. Каже — найзручніший комбез для гімнастики. Якість справді преміум.",
        },
    ],
};

async function main() {
    console.log("🌱 Seeding database…");

    // ---------- demo customers ----------
    const customer1 = await prisma.customer.upsert({
        where: { email: "olena@example.com" },
        update: {},
        create: {
            firstName: "Олена",
            lastName: "Коваль",
            email: "olena@example.com",
            phone: "+380501234567",
        },
    });
    await prisma.customer.upsert({
        where: { email: "mark@example.com" },
        update: {},
        create: {
            firstName: "Марк",
            lastName: "Шевченко",
            email: "mark@example.com",
            phone: "+380679876543",
        },
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
        {
            code: "WELCOME10",
            discountType: "percent",
            discountValue: 10,
            minOrder: 0,
            maxUses: null as number | null,
            isActive: true,
        },
        {
            code: "MINDBODY15",
            discountType: "percent",
            discountValue: 15,
            minOrder: 1500,
            maxUses: 100,
            isActive: true,
        },
        {
            code: "FREESHIP",
            discountType: "fixed",
            discountValue: 100,
            minOrder: 1000,
            maxUses: null as number | null,
            isActive: true,
        },
    ];
    for (const p of promos) {
        await prisma.promoCode.upsert({
            where: { code: p.code },
            update: {
                discountType: p.discountType,
                discountValue: p.discountValue,
                minOrder: p.minOrder,
                maxUses: p.maxUses ?? undefined,
                isActive: p.isActive,
            },
            create: { ...p, maxUses: p.maxUses ?? undefined },
        });
    }

    // ---------- one historical order (so customer profile isn't empty) ----------
    const firstProduct = await prisma.product.findFirst({ where: { status: "active" } });
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

    console.log(
        `✅ Seeded ${PRODUCTS.length} products, ${Object.keys(REVIEWS_BY_SLUG).length} review sets, 3 promo codes.`,
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
