import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSlides = [
    {
        name: "Teal Collection",
        type: "triptych",
        image1: "/generalpics/333_131123.jpg",
        image2: "/generalpics/374_131123.jpg",
        image3: "/generalpics/338_131123.jpg",
        order: 1,
        link: "/shop/women"
    },
    {
        name: "Cocoa Collection",
        type: "triptych",
        image1: "/pics2cloths/IMG_4971.JPG",
        image2: "/pics2cloths/IMG_4976.JPG",
        image3: "/pics2cloths/IMG_4980.JPG",
        order: 2,
        link: "/shop/women"
    },
    {
        name: "Black Collection",
        type: "triptych",
        image1: "/pics1cloths/IMG_6201.JPG",
        image2: "/pics1cloths/IMG_6203.JPG",
        image3: "/pics1cloths/IMG_6204.JPG",
        order: 3,
        link: "/shop/women"
    },
    {
        name: "Teal Variants",
        type: "triptych",
        image1: "/generalpics/348_131123.jpg",
        image2: "/generalpics/595_131123.jpg",
        image3: "/generalpics/602_131123.jpg",
        order: 4,
        link: "/shop/women"
    },
    {
        name: "Hero Banner",
        type: "single",
        image1: "/Slides/Example.png",
        image2: null,
        image3: null,
        order: 5,
        link: "/shop"
    },
];

async function main() {
    console.log("Seeding slides...");
    const count = await prisma.slide.count();

    if (count > 0) {
        console.log("Slides already exist in database. Skipping seed.");
        return;
    }

    for (const slide of defaultSlides) {
        await prisma.slide.create({
            data: {
                name: slide.name,
                type: slide.type,
                image1: slide.image1,
                image2: slide.image2,
                image3: slide.image3,
                order: slide.order,
                link: slide.link,
                isActive: true
            }
        });
    }
    console.log("Slides seeded successfully!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
