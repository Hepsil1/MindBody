import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany();

    for (const p of products) {
        let newCat = "sets";
        const name = p.name.toLowerCase();
        if (name.includes("top") || name.includes("топ")) newCat = "tops";
        else if (name.includes("legging") || name.includes("легінси")) newCat = "leggings";
        else if (name.includes("jumpsuit") || name.includes("комбінезон") || name.includes("wings")) newCat = "jumpsuit";
        else if (name.includes("short") || name.includes("шорти")) newCat = "shorts";
        else if (name.includes("jacket") || name.includes("куртка")) newCat = "jackets";

        // Map colors (JSON string -> array -> mapped array -> JSON string)
        let newColorsList = ["black"];
        try {
            if (p.colors) {
                const oldColors = JSON.parse(p.colors);
                if (Array.isArray(oldColors) && oldColors.length > 0) {
                    newColorsList = oldColors.map(c => {
                        const cl = c.toLowerCase();
                        if (cl.includes("чорн") || cl.includes("black")) return "black";
                        if (cl.includes("біл") || cl.includes("white")) return "white";
                        if (cl.includes("син") || cl.includes("blue")) return "blue";
                        if (cl.includes("рож") || cl.includes("pink")) return "pink";
                        if (cl.includes("зелен") || cl.includes("green")) return "green";
                        if (cl.includes("сір") || cl.includes("gray") || cl.includes("grey")) return "gray";
                        if (cl.includes("черв") || cl.includes("red")) return "red";
                        return "other";
                    });
                }
            }
        } catch (e) { }

        // Ensure sizes are from the configured list: ["L", "M", "S", "XL", "XS", "XXS", "34", "36", "38", "40", "42"]
        let newSizesList = ["M", "S"];
        try {
            if (p.sizes && p.sizes !== "[]") {
                const oldSizes = JSON.parse(p.sizes);
                if (Array.isArray(oldSizes) && oldSizes.length > 0) {
                    newSizesList = oldSizes;
                }
            }
        } catch (e) { }

        await prisma.product.update({
            where: { id: p.id },
            data: {
                category: newCat,
                colors: JSON.stringify([...new Set(newColorsList)]),
                sizes: JSON.stringify(newSizesList)
            }
        });
    }

    console.log("Updated products to match dynamic filters!");

    // Also, reset FilterConfig to sane defaults from the UI just in case it got corrupted
    const defaultConfig = {
        categories: {
            "jumpsuit": "Комбінезони",
            "leggings": "Легінси",
            "tops": "Топи",
            "shorts": "Шорти",
            "jackets": "Куртки",
            "sets": "Комплекти"
        },
        colors: {
            "black": "Чорний",
            "white": "Білий",
            "blue": "Синій",
            "pink": "Рожевий",
            "green": "Зелений",
            "gray": "Сірий",
            "red": "Червоний",
            "other": "Інші"
        },
        priceRanges: [
            { id: "low", label: "До 1000 ₴", min: 0, max: 1000 },
            { id: "mid", label: "1000 - 3000 ₴", min: 1000, max: 3000 },
            { id: "high", label: "3000 - 5000 ₴", min: 3000, max: 5000 },
            { id: "premium", label: "Від 5000 ₴", min: 5000, max: 999999 }
        ],
        sizes: ["L", "M", "S", "XL", "XS", "XXS", "34", "36", "38", "40", "42"]
    };

    await prisma.$executeRawUnsafe(
        `UPDATE "FilterConfig" SET config = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = 'global'`,
        JSON.stringify(defaultConfig)
    );

    console.log("Reset FilterConfig to standard sane defaults");
}

main().catch(console.error).finally(() => prisma.$disconnect());
