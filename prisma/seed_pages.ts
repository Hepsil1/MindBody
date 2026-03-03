
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Checking ShopPages...");

    const pages = await prisma.shopPage.findMany();
    console.log("Current ShopPages:", pages);

    console.log("Upserting default ShopPages...");

    // Ensure 'women' exists
    await prisma.shopPage.upsert({
        where: { slug: "women" },
        update: { title: "Жіноча", prefixLabel: "For active life" },
        create: {
            slug: "women",
            title: "Жіноча",
            prefixLabel: "For active life",
            heroImage: "/uploads/hero-women.jpg", // Placeholder
            heroImagePos: "50% 50% 1"
        }
    });

    // Ensure 'kids' exists
    await prisma.shopPage.upsert({
        where: { slug: "kids" },
        update: {
            title: "Дитяча",
            prefixLabel: "For little stars",
            heroImage: "/uploads/1770211683749-20260129_1638_Image_Generation_remix_01kg530k7gfd3v530d61a6qqwd.png"
        },
        create: {
            slug: "kids",
            title: "Дитяча",
            prefixLabel: "For little stars",
            heroImage: "/uploads/1770211683749-20260129_1638_Image_Generation_remix_01kg530k7gfd3v530d61a6qqwd.png", // Valid placeholder
            heroImagePos: "50% 50% 1"
        }
    });

    const updatedPages = await prisma.shopPage.findMany();
    console.log("Updated ShopPages:", updatedPages);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
