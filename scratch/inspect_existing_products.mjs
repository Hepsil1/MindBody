import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const products = await prisma.product.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      status: true,
      shopPageSlug: true,
      category: true,
      fabric: true,
      sleeve: true,
      images: true,
      colors: true,
      colorImages: true,
      sizes: true,
      inventory: true,
    },
  });

  console.log("Sample products in DB:");
  for (const p of products) {
    console.log("-----------------------------------------");
    console.log("Name:", p.name);
    console.log("Slug:", p.slug);
    console.log("Price:", p.price);
    console.log("Shop / Category:", p.shopPageSlug, "/", p.category);
    console.log("Fabric / Sleeve:", p.fabric, "/", p.sleeve);
    console.log("Colors:", p.colors);
    console.log("Sizes:", p.sizes);
    console.log("Images:", p.images);
    console.log("ColorImages:", p.colorImages);
    console.log("Inventory:", p.inventory);
  }

  await prisma.$disconnect();
}

run();
