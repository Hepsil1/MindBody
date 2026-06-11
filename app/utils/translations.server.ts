/**
 * Entity-translation server I/O — raw SQL on purpose (the moodType /
 * SiteSetting pattern): works against any generated Prisma client, and
 * degrades to "no translations" (Ukrainian everywhere) if the column is
 * missing (pre-migration) or the query fails. The storefront never breaks.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import type { Locale } from "../i18n/config";
import { localizeFields, parseTranslations, type EntityTranslations } from "./translations";

type TranslatableTable = "Product" | "Category" | "ShopPage";

const TABLE_SQL: Record<TranslatableTable, Prisma.Sql> = {
    Product: Prisma.sql`"Product"`,
    Category: Prisma.sql`"Category"`,
    ShopPage: Prisma.sql`"ShopPage"`,
};

/** id → parsed translations for the given rows. {} on any failure. */
export async function fetchTranslationsMap(
    table: TranslatableTable,
    ids: string[],
): Promise<Record<string, EntityTranslations>> {
    if (ids.length === 0) return {};
    try {
        const rows = await prisma.$queryRaw<Array<{ id: string; translations: string | null }>>(
            Prisma.sql`SELECT "id", "translations" FROM ${TABLE_SQL[table]} WHERE "id" IN (${Prisma.join(ids)})`,
        );
        const map: Record<string, EntityTranslations> = {};
        for (const row of rows) {
            if (row.translations) map[row.id] = parseTranslations(row.translations);
        }
        return map;
    } catch {
        // Column not migrated yet / transient failure → Ukrainian fallback.
        return {};
    }
}

/**
 * Localize entities (each must carry `id`) by overwriting `fields` with their
 * `locale` translations where present. One batched query; uk is a no-op.
 */
export async function localizeEntities<T extends { id: string }>(
    table: TranslatableTable,
    entities: T[],
    locale: Locale,
    fields: string[],
): Promise<T[]> {
    if (locale === "uk" || entities.length === 0) return entities;
    const map = await fetchTranslationsMap(
        table,
        entities.map((e) => e.id),
    );
    return entities.map((e) => localizeFields(e, map[e.id] ?? {}, locale, fields));
}

/** Persist a translations blob (admin save). Validated JSON in, raw SQL out. */
export async function saveTranslations(
    table: TranslatableTable,
    id: string,
    translations: EntityTranslations,
): Promise<void> {
    const json = JSON.stringify(translations);
    await prisma.$executeRaw(
        Prisma.sql`UPDATE ${TABLE_SQL[table]} SET "translations" = ${json} WHERE "id" = ${id}`,
    );
}
