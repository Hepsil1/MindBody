// Publish-readiness checks for a product. A product may be saved as a DRAFT in
// any state, but it can only go LIVE (status=active) once it's complete. Shared
// by the admin product form (to show a checklist + gate the button) and the save
// action (the server is the source of truth). fabric/sleeve are required only
// when the chosen (shop, category) pair actually offers them per the taxonomy.

import { fabricsFor, sleevesFor } from "./taxonomy";

export interface QualityInput {
    price: number;
    imagesCount: number;
    category: string;
    shopPageSlug: string;
    stock: number;
    fabric: string;
    sleeve: string;
}

export interface QualityCheck {
    ok: boolean;
    label: string;
}

export function publishChecklist(i: QualityInput): QualityCheck[] {
    const pairChosen = Boolean(i.shopPageSlug && i.category);
    const fabricApplies = pairChosen && fabricsFor(i.shopPageSlug, i.category).length > 0;
    const sleeveApplies = pairChosen && sleevesFor(i.shopPageSlug, i.category).length > 0;

    const checks: QualityCheck[] = [
        { ok: Number.isFinite(i.price) && i.price > 0, label: "Ціна вказана" },
        { ok: i.imagesCount > 0, label: "Є хоча б одне фото" },
        { ok: Boolean(i.category), label: "Обрана категорія" },
        { ok: i.stock > 0, label: "Залишок більше 0" },
    ];
    if (fabricApplies) checks.push({ ok: Boolean(i.fabric), label: "Вказана тканина" });
    if (sleeveApplies) checks.push({ ok: Boolean(i.sleeve), label: "Вказаний тип рукава" });
    return checks;
}

/** Human-readable reasons a product can't be published (empty = ready). */
export function publishBlockers(i: QualityInput): string[] {
    return publishChecklist(i)
        .filter((c) => !c.ok)
        .map((c) => c.label);
}
