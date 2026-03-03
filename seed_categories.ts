
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.category.count();
    if (count === 0) {
        await prisma.category.createMany({
            data: [
                {
                    title: "Жінкам",
                    subtitle: "Колекція для неї",
                    image: "/pics1cloths/IMG_6201.JPG",
                    link: "/shop/women",
                    buttonText: "Переглянути все",
                    order: 1
                },
                {
                    title: "Дітям",
                    subtitle: "Для малечі",
                    image: "/pics2cloths/IMG_5222.JPG",
                    link: "/shop/kids",
                    buttonText: "Дивитись товари",
                    order: 2
                }
            ]
        });
        console.log("Categories seeded!");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
