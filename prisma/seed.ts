import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Create some customers
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

    const customer2 = await prisma.customer.upsert({
        where: { email: "mark@example.com" },
        update: {},
        create: {
            firstName: "Марк",
            lastName: "Шевченко",
            email: "mark@example.com",
            phone: "+380679876543",
        },
    });

    // Create products
    await prisma.product.upsert({
        where: { sku: "W-BELL-S" },
        update: {},
        create: {
            name: "SCHEMER WINTER Bell",
            description: "Преміальний комбінезон для йоги",
            price: 3490,
            sku: "W-BELL-S",
            stock: 15,
            status: "active",
            category: "Жінкам",
        },
    });

    await prisma.product.upsert({
        where: { sku: "K-MINI-S" },
        update: {},
        create: {
            name: "MINI SCHEMER",
            description: "Дитячий комбінезон для гімнастики",
            price: 1890,
            sku: "K-MINI-S",
            stock: 20,
            status: "active",
            category: "Дітям",
        },
    });

    // Create an order for 1st customer
    await prisma.order.create({
        data: {
            orderNumber: 1001,
            customerId: customer1.id,
            status: "delivered",
            paymentStatus: "paid",
            total: 3490,
            items: {
                create: {
                    productId: (await prisma.product.findFirst({ where: { sku: "W-BELL-S" } }))!.id,
                    quantity: 1,
                    price: 3490,
                },
            },
        },
    });

    console.log("✅ Seeding complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
