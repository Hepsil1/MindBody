// Server-side load/save of the editable shop taxonomy + fabric/sleeve vocabulary
// (TaxonomyConfig table).
//
// The TaxonomyConfig column lives OUTSIDE the generated Prisma client until a
// clean `prisma generate` (PM2 holds the engine DLL), so it's read/written via
// raw SQL — same pattern as Order.locale / Product.colorImages.
//
// Stored JSON is an ENVELOPE: { shops, fabricLabels?, sleeveLabels? }. Older rows
// stored the bare shop tree (no envelope) — readTaxonomyConfig accepts BOTH.
// Everything degrades to the hardcoded defaults: a missing table, an empty row,
// or malformed JSON all fall back, so the menu/filters never break.

import { prisma } from "../db.server";
import {
    setActiveTaxonomy,
    setVocabLabels,
    TAXONOMY,
    FABRIC_LABELS,
    SLEEVE_LABELS,
    SHOP_SLUGS,
    DEFAULT_FABRIC_LABELS,
    DEFAULT_SLEEVE_LABELS,
    type ShopTaxonomy,
} from "./taxonomy";

/** Persisted shape. `shops` is the category tree; the label maps are the
    editable fabric/sleeve vocabulary (code → display label). */
export interface TaxonomyEnvelope {
    shops: ShopTaxonomy;
    fabricLabels?: Record<string, string>;
    sleeveLabels?: Record<string, string>;
}

/** Vocabulary maps (fabric/sleeve code → label) for the client. */
export interface VocabLabels {
    fabricLabels: Record<string, string>;
    sleeveLabels: Record<string, string>;
}

let loaded = false;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validate + sanitize one label map (code → non-empty label). Codes must be
    slug-format; labels are trimmed and capped. Returns the cleaned map. */
function cleanLabelMap(
    raw: unknown,
    which: string,
): { ok: true; map: Record<string, string> } | { ok: false; error: string } {
    if (raw === null || raw === undefined) return { ok: true, map: {} };
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, error: `Словник «${which}» має бути об'єктом.` };
    }
    const map: Record<string, string> = {};
    for (const [code, labelRaw] of Object.entries(raw as Record<string, unknown>)) {
        if (!SLUG_RE.test(code)) {
            return {
                ok: false,
                error: `Неприпустимий код «${code}» у словнику «${which}» — лише латиниця, цифри, дефіс.`,
            };
        }
        const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
        if (!label) {
            return { ok: false, error: `Порожня назва для коду «${code}» у словнику «${which}».` };
        }
        map[code] = label.slice(0, 40);
    }
    return { ok: true, map };
}

/**
 * Validate + sanitize an admin-submitted taxonomy ENVELOPE (or legacy bare tree)
 * before persist. Only known shops, URL-safe category slugs, non-empty labels,
 * and fabric/sleeve codes that exist in the (default ∪ submitted) vocabulary
 * survive. Returns the cleaned envelope so a malformed payload can't rot the menu.
 */
export function validateTaxonomy(
    input: unknown,
): { ok: true; value: TaxonomyEnvelope } | { ok: false; error: string } {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { ok: false, error: "Структура має бути об'єктом." };
    }
    // Envelope vs legacy bare tree.
    const hasEnvelope = "shops" in (input as Record<string, unknown>);
    const treeRaw = hasEnvelope ? (input as Record<string, unknown>).shops : input;
    const fabricRaw = hasEnvelope ? (input as Record<string, unknown>).fabricLabels : undefined;
    const sleeveRaw = hasEnvelope ? (input as Record<string, unknown>).sleeveLabels : undefined;

    const fabricClean = cleanLabelMap(fabricRaw, "тканина");
    if (!fabricClean.ok) return fabricClean;
    const sleeveClean = cleanLabelMap(sleeveRaw, "рукав");
    if (!sleeveClean.ok) return sleeveClean;

    // The submitted vocabulary is authoritative: allowed codes = its keys (so a
    // freshly-added code passes AND a deleted one is stripped from categories).
    // Only when NO vocabulary is submitted do we fall back to the built-ins.
    const allowedFabrics = Object.keys(fabricClean.map).length
        ? new Set(Object.keys(fabricClean.map))
        : new Set(Object.keys(DEFAULT_FABRIC_LABELS));
    const allowedSleeves = Object.keys(sleeveClean.map).length
        ? new Set(Object.keys(sleeveClean.map))
        : new Set(Object.keys(DEFAULT_SLEEVE_LABELS));

    if (!treeRaw || typeof treeRaw !== "object" || Array.isArray(treeRaw)) {
        return { ok: false, error: "Структура розділів має бути об'єктом." };
    }
    const shops: ShopTaxonomy = {};
    for (const [shop, subsRaw] of Object.entries(treeRaw as Record<string, unknown>)) {
        if (!SHOP_SLUGS.includes(shop)) {
            return { ok: false, error: `Невідомий розділ "${shop}".` };
        }
        if (!subsRaw || typeof subsRaw !== "object" || Array.isArray(subsRaw)) {
            return { ok: false, error: `Розділ "${shop}" має містити категорії.` };
        }
        const subs: ShopTaxonomy[string] = {};
        for (const [slug, defRaw] of Object.entries(subsRaw as Record<string, unknown>)) {
            if (!SLUG_RE.test(slug)) {
                return {
                    ok: false,
                    error: `Неприпустимий код категорії "${slug}" — лише латиниця, цифри й дефіс (напр. leggings).`,
                };
            }
            if (!defRaw || typeof defRaw !== "object") {
                return { ok: false, error: `Категорія "${slug}" задана некоректно.` };
            }
            const d = defRaw as { label?: unknown; fabrics?: unknown; sleeves?: unknown };
            const label = typeof d.label === "string" ? d.label.trim() : "";
            if (!label) {
                return { ok: false, error: `Категорія "${slug}" має мати назву.` };
            }
            const fabrics = Array.isArray(d.fabrics)
                ? [
                      ...new Set(
                          d.fabrics.filter((f): f is string => allowedFabrics.has(f as string)),
                      ),
                  ]
                : undefined;
            const sleeves = Array.isArray(d.sleeves)
                ? [
                      ...new Set(
                          d.sleeves.filter((s): s is string => allowedSleeves.has(s as string)),
                      ),
                  ]
                : undefined;
            subs[slug] = {
                label,
                ...(fabrics && fabrics.length ? { fabrics } : {}),
                ...(sleeves && sleeves.length ? { sleeves } : {}),
            };
        }
        shops[shop] = subs;
    }
    return {
        ok: true,
        value: {
            shops,
            ...(Object.keys(fabricClean.map).length ? { fabricLabels: fabricClean.map } : {}),
            ...(Object.keys(sleeveClean.map).length ? { sleeveLabels: sleeveClean.map } : {}),
        },
    };
}

/** Read + parse the TaxonomyConfig row into an envelope. null on absent/malformed.
    Accepts the legacy bare-tree shape (no `shops` key) for back-compat. */
async function readTaxonomyConfig(): Promise<TaxonomyEnvelope | null> {
    try {
        const rows = await prisma.$queryRaw<Array<{ config: string | null }>>`
            SELECT "config" FROM "TaxonomyConfig" WHERE "id" = 'default' LIMIT 1
        `;
        const raw = rows[0]?.config;
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        if ("shops" in parsed) {
            const env = parsed as Partial<TaxonomyEnvelope>;
            return {
                shops: (env.shops && typeof env.shops === "object"
                    ? env.shops
                    : {}) as ShopTaxonomy,
                fabricLabels: env.fabricLabels,
                sleeveLabels: env.sleeveLabels,
            };
        }
        // Legacy: the whole object IS the shop tree.
        return { shops: parsed as ShopTaxonomy };
    } catch {
        return null;
    }
}

/** Load the active taxonomy + vocabulary from the DB once per process (or force).
    Best-effort — falls back to the hardcoded defaults on any failure. */
export async function loadActiveTaxonomy(force = false): Promise<void> {
    if (loaded && !force) return;
    const cfg = await readTaxonomyConfig();
    await setActiveTaxonomy(cfg?.shops ?? null);
    setVocabLabels(cfg?.fabricLabels, cfg?.sleeveLabels);
    loaded = true;
}

/** Active shop tree as a plain object — passed to the client via the root loader
    (the client can't import this .server module). */
export async function getActiveTaxonomyForClient(): Promise<ShopTaxonomy> {
    await loadActiveTaxonomy();
    return TAXONOMY;
}

/** Active fabric/sleeve vocabulary — passed to the client so the menu + editor
    render the edited labels (and any custom codes). */
export async function getActiveVocabForClient(): Promise<VocabLabels> {
    await loadActiveTaxonomy();
    return { fabricLabels: FABRIC_LABELS, sleeveLabels: SLEEVE_LABELS };
}

/** Persist a new taxonomy envelope + refresh the in-process active taxonomy/vocab. */
export async function saveTaxonomyConfig(envelope: TaxonomyEnvelope): Promise<void> {
    const json = JSON.stringify(envelope);
    await prisma.$executeRaw`
        INSERT INTO "TaxonomyConfig" ("id", "config", "updatedAt")
        VALUES ('default', ${json}, NOW())
        ON CONFLICT ("id") DO UPDATE SET "config" = ${json}, "updatedAt" = NOW()
    `;
    await setActiveTaxonomy(envelope.shops);
    setVocabLabels(envelope.fabricLabels, envelope.sleeveLabels);
    loaded = true;
}
