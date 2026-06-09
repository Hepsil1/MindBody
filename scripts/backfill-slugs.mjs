// Backfill Product.slug for rows that don't have one. The public PDP now lives
// at /p/<slug>, and /product/<id> 404s an active product with no slug — so every
// product needs a slug. New products get one on save (admin ensureUniqueSlug);
// this fills legacy/seeded rows. Run once per environment (DATABASE_URL).
//
//   node -r dotenv/config scripts/backfill-slugs.mjs
//
// Mirrors app/utils/slugify.ts (kept inline so the script runs under plain node).
import { PrismaClient } from "@prisma/client";

const TRANSLIT = {
    а: "a",
    б: "b",
    в: "v",
    г: "h",
    ґ: "g",
    д: "d",
    е: "e",
    є: "ie",
    ж: "zh",
    з: "z",
    и: "y",
    і: "i",
    ї: "i",
    й: "i",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ь: "",
    ю: "iu",
    я: "ia",
    ё: "e",
    ы: "y",
    э: "e",
    ъ: "",
};
function slugify(input) {
    let out = "";
    for (const ch of (input || "").toLowerCase()) {
        out += Object.prototype.hasOwnProperty.call(TRANSLIT, ch) ? TRANSLIT[ch] : ch;
    }
    return out
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
}

const prisma = new PrismaClient();

async function main() {
    const missing = await prisma.product.findMany({
        where: { OR: [{ slug: null }, { slug: "" }] },
        select: { id: true, name: true },
    });
    const taken = new Set(
        (
            await prisma.product.findMany({
                where: { slug: { not: null } },
                select: { slug: true },
            })
        ).map((p) => p.slug),
    );

    let updated = 0;
    for (const p of missing) {
        const base = slugify(p.name) || "tovar";
        let candidate = base;
        for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
        taken.add(candidate);
        await prisma.product.update({ where: { id: p.id }, data: { slug: candidate } });
        updated++;
    }

    console.log(`Backfilled ${updated} slug(s) (${missing.length} were missing).`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
