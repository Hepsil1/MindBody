const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const defaultSlides = [
    {
        id: "default-1-" + Date.now(),
        name: "Teal Collection",
        type: "triptych",
        page: "home",
        image1: "/generalpics/333_131123.webp",
        image2: "/generalpics/374_131123.webp",
        image3: "/generalpics/338_131123.webp",
        image1Pos: "center center",
        image2Pos: "center center",
        image3Pos: "center center",
        order: 1,
        isActive: true,
    },
    {
        id: "default-2-" + Date.now(),
        name: "Cocoa Collection",
        type: "triptych",
        page: "home",
        image1: "/pics2cloths/IMG_4971.webp",
        image2: "/pics2cloths/IMG_4976.webp",
        image3: "/pics2cloths/IMG_4980.webp",
        image1Pos: "center center",
        image2Pos: "center center",
        image3Pos: "center center",
        order: 2,
        isActive: true,
    },
    {
        id: "default-3-" + Date.now(),
        name: "Black Collection",
        type: "triptych",
        page: "home",
        image1: "/pics1cloths/IMG_6201.webp",
        image2: "/pics1cloths/IMG_6203.webp",
        image3: "/pics1cloths/IMG_6204.webp",
        image1Pos: "center center",
        image2Pos: "center center",
        image3Pos: "center center",
        order: 3,
        isActive: true,
    },
    {
        id: "default-4-" + Date.now(),
        name: "Teal Variants",
        type: "triptych",
        page: "home",
        image1: "/generalpics/348_131123.webp",
        image2: "/generalpics/595_131123.webp",
        image3: "/generalpics/602_131123.webp",
        image1Pos: "center center",
        image2Pos: "center center",
        image3Pos: "center center",
        order: 4,
        isActive: true,
    },
    {
        id: "default-5-" + Date.now(),
        name: "Hero Banner",
        type: "triptych",
        page: "home",
        image1: "/generalpics/585_131123.webp",
        image2: "/generalpics/588_131123.webp",
        image3: "/generalpics/602_131123.webp",
        image1Pos: "center center",
        image2Pos: "center center",
        image3Pos: "center center",
        order: 5,
        isActive: true,
    },
];

async function main() {
    const slideCount = await prisma.slide.count();

    if (slideCount === 0) {
        console.log("No slides in database. Seeding default slides directly to DB...");

        for (const slide of defaultSlides) {
            await prisma.slide.create({
                data: slide,
            });
        }

        console.log("Seeded 5 default slides. They will now appear in the Admin Panel!");
    } else {
        console.log(`Database already has ${slideCount} slides. Skipping seed.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
