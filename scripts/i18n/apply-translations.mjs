// Apply scripts/i18n/translations.json into the per-entity `translations`
// JSON columns (Product / Category / ShopPage).
//
// Prerequisite: the 20260611140000_i18n_translations migration is applied.
// Idempotent: merges over whatever is already stored, so admin-edited
// translations survive re-runs (file values win only for fields they define).
//
// Usage: node scripts/i18n/apply-translations.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import "dotenv/config";

const prisma = new PrismaClient();
const data = JSON.parse(readFileSync(new URL("./translations.json", import.meta.url), "utf8"));

// Products without an explicit description translation get the boilerplate
// (44 of 47 products share the same Ukrainian template description).
const BOILERPLATE = data.boilerplate;

function mergeLocale(existing = {}, incoming = {}) {
    return { ...existing, ...incoming };
}

async function applyTable(table, entries, withBoilerplate) {
    let n = 0;
    for (const [id, tr] of Object.entries(entries)) {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT "translations" FROM "${table}" WHERE "id" = $1`,
            id,
        );
        if (rows.length === 0) {
            console.warn(`[skip] ${table} ${id} — row not found`);
            continue;
        }
        let existing = {};
        try {
            existing = rows[0].translations ? JSON.parse(rows[0].translations) : {};
        } catch {
            existing = {};
        }
        const en = mergeLocale(existing.en, tr.en);
        const ru = mergeLocale(existing.ru, tr.ru);
        if (withBoilerplate) {
            if (!en.description) en.description = BOILERPLATE.en;
            if (!ru.description) ru.description = BOILERPLATE.ru;
        }
        const json = JSON.stringify({ en, ru });
        await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "translations" = $1 WHERE "id" = $2`,
            json,
            id,
        );
        n++;
    }
    console.info(`${table}: updated ${n}/${Object.keys(entries).length}`);
}

await applyTable("Product", data.products, true);
await applyTable("Category", data.categories, false);
await applyTable("ShopPage", data.shopPages, false);
await prisma.$disconnect();
console.info("done");
