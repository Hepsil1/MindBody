import { useState, useEffect, useRef, Fragment, type ReactNode, type CSSProperties } from "react";
import { useFetcher, type FetcherWithComponents } from "react-router";
import type { ShopPage, FilterConfig } from "@prisma/client";
import { parseAndMergeFilterConfig, type MergedFilterConfig } from "../../utils/filters";
import { useTaxonomy, useVocab, useShopMeta, useSiteSettings } from "../../utils/site-settings";
import {
    SHOP_SLUGS,
    fabricLabel,
    sleeveLabel,
    DEFAULT_FABRIC_LABELS,
    DEFAULT_SLEEVE_LABELS,
    type ShopTaxonomy,
    type SubcategoryDef,
} from "../../utils/taxonomy";
import { FilePickerField } from "./FilePickerField";
import { ConfirmDialog } from "./ConfirmDialog";
import { useModalA11y } from "./useModalA11y";

/**
 * «Меню та фільтри магазину» — master-detail editor for the whole storefront menu
 * and product filters, all in one place.
 *
 *   LEFT RAIL: the 6 top-level sections (reorder / rename the nav word / hide) +
 *   «Загальні фільтри» + «Словник» (fabric/sleeve vocabulary).
 *   DETAIL: for a section — its mega-menu featured card, its menu categories
 *   (with fabric/sleeve pills), and its product filters; for «Загальні» — the
 *   default colors/sizes/prices; for «Словник» — editable fabric/sleeve labels.
 *
 * Structural keys (shop slug, category slug, fabric/sleeve code) are immutable —
 * only display values change — so edits can never orphan a product or a URL.
 */

type FacetCounts = {
    categories: Record<string, number>;
    colors: Record<string, number>;
    sizes: Record<string, number>;
};

interface FilterEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    filterConfigs?: Pick<FilterConfig, "id" | "config">[];
    shopPages?: Pick<ShopPage, "slug" | "title">[];
    availableFacets?: Record<string, FacetCounts>;
    /** Per shop/category/fabric/sleeve product counts (getMegaCounts) — drives the
     *  "N товарів" badges so the menu↔product binding is visible. */
    megaCounts?: Record<string, number>;
    fetcher: FetcherWithComponents<unknown>;
}

type Scope = { kind: "section"; slug: string } | { kind: "global" } | { kind: "vocab" };

/** Ukrainian plural for "товар". */
function tovarWord(n: number): string {
    const d = n % 10;
    const dd = n % 100;
    if (d === 1 && dd !== 11) return "товар";
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "товари";
    return "товарів";
}

const CYR_MAP: Record<string, string> = {
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
    ъ: "",
    ы: "y",
    э: "e",
    ё: "e",
};
function slugify(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .split("")
        .map((c) => (c in CYR_MAP ? CYR_MAP[c] : c))
        .join("")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---- inline style tokens ---------------------------------------------------
const sInput: CSSProperties = {
    background: "#0f1216",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    outline: "none",
};
const sCard: CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.06)",
};
const sPrimaryBtn: CSSProperties = {
    padding: "0 20px",
    height: "40px",
    background: "var(--accent-primary)",
    color: "#000",
    border: "none",
    borderRadius: "8px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
};
const sIconBtn: CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
    cursor: "pointer",
    borderRadius: "8px",
    width: "30px",
    height: "30px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    flexShrink: 0,
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function FilterEditorModal({
    isOpen,
    onClose,
    filterConfigs = [],
    shopPages = [],
    availableFacets = {},
    megaCounts = {},
    fetcher,
}: FilterEditorModalProps) {
    // ---- live data seeds (from root loader) --------------------------------
    const liveTaxonomy = useTaxonomy();
    const liveVocab = useVocab();
    const liveShopMeta = useShopMeta();
    const { navFeatured } = useSiteSettings();

    const sectionOrder = [
        ...(liveShopMeta.order ?? []).filter((s) => SHOP_SLUGS.includes(s)),
        ...SHOP_SLUGS.filter((s) => !(liveShopMeta.order ?? []).includes(s)),
    ];

    const [scope, setScope] = useState<Scope>({ kind: "section", slug: sectionOrder[0] });

    // ---- editable state (deep copies) --------------------------------------
    const [taxonomy, setTaxonomy] = useState<ShopTaxonomy>(() => clone(liveTaxonomy));
    const [fabricLabels, setFabricLabels] = useState<Record<string, string>>(() =>
        clone(liveVocab.fabricLabels),
    );
    const [sleeveLabels, setSleeveLabels] = useState<Record<string, string>>(() =>
        clone(liveVocab.sleeveLabels),
    );
    const [shopMeta, setShopMeta] = useState(() => clone(liveShopMeta));
    const [filtersByPage, setFiltersByPage] = useState<Record<string, MergedFilterConfig>>({});

    // Initial snapshots for dirty-tracking. State (not a ref) so they can be read
    // during render; set once and never replaced. Filters seed lazily per page.
    const [initialSnap] = useState(() => ({
        taxonomy: JSON.stringify(liveTaxonomy),
        fabricLabels: JSON.stringify(liveVocab.fabricLabels),
        sleeveLabels: JSON.stringify(liveVocab.sleeveLabels),
        shopMeta: JSON.stringify(liveShopMeta),
    }));
    const [initialFilters, setInitialFilters] = useState<Record<string, string>>({});

    // Filter page for the current scope (section slug, or "global"; vocab = none).
    const filterPage =
        scope.kind === "section" ? scope.slug : scope.kind === "global" ? "global" : null;
    // Seed the active page's filter config lazily, recording its initial JSON.
    useEffect(() => {
        if (!filterPage || filtersByPage[filterPage]) return;
        const row = filterConfigs.find((c) => c.id === filterPage);
        const globalRow = filterConfigs.find((c) => c.id === "global");
        const seeded = parseAndMergeFilterConfig(row?.config || globalRow?.config);
        setInitialFilters((prev) => ({ ...prev, [filterPage]: JSON.stringify(seeded) }));
        setFiltersByPage((prev) => ({ ...prev, [filterPage]: seeded }));
    }, [filterPage, filterConfigs, filtersByPage]);

    const data = filterPage ? filtersByPage[filterPage] : undefined;
    const setData = (updater: (prev: MergedFilterConfig) => MergedFilterConfig) => {
        if (!filterPage) return;
        setFiltersByPage((prev) => ({ ...prev, [filterPage]: updater(prev[filterPage]) }));
    };

    // ---- dirty tracking ----------------------------------------------------
    const taxonomyDirty = JSON.stringify(taxonomy) !== initialSnap.taxonomy;
    const vocabDirty =
        JSON.stringify(fabricLabels) !== initialSnap.fabricLabels ||
        JSON.stringify(sleeveLabels) !== initialSnap.sleeveLabels;
    const shopMetaDirty = JSON.stringify(shopMeta) !== initialSnap.shopMeta;
    const dirtyFilterPages = Object.keys(filtersByPage).filter(
        (p) => JSON.stringify(filtersByPage[p]) !== (initialFilters[p] ?? ""),
    );
    const dirty = taxonomyDirty || vocabDirty || shopMetaDirty || dirtyFilterPages.length > 0;
    const invalidRange = Object.values(filtersByPage).some((cfg) =>
        cfg.priceRanges.some((r) => Number(r.min) > Number(r.max)),
    );

    // ---- submit lifecycle --------------------------------------------------
    const closeOnSuccess = useRef(false);
    const saving = fetcher.state !== "idle";
    const [submitError, setSubmitError] = useState<string | null>(null);
    useEffect(() => {
        if (fetcher.state !== "idle" || !closeOnSuccess.current) return;
        closeOnSuccess.current = false;
        const res = fetcher.data as { ok?: boolean; error?: string } | undefined;
        if (res?.ok) onClose();
        else setSubmitError(res?.error ?? "Не вдалося зберегти зміни.");
    }, [fetcher.state, fetcher.data, onClose]);

    const [showDiscard, setShowDiscard] = useState(false);
    const requestClose = () => (dirty ? setShowDiscard(true) : onClose());
    const dialogRef = useRef<HTMLDivElement>(null);
    useModalA11y(dialogRef, requestClose, !showDiscard);

    const handleSave = () => {
        setSubmitError(null);
        const fd = new FormData();
        fd.append("intent", "update_store");
        if (taxonomyDirty || vocabDirty) {
            fd.append("taxonomy", JSON.stringify({ shops: taxonomy, fabricLabels, sleeveLabels }));
        }
        if (shopMetaDirty) fd.append("shopMeta", JSON.stringify(shopMeta));
        if (dirtyFilterPages.length) {
            const filters: Record<string, MergedFilterConfig> = {};
            for (const p of dirtyFilterPages) filters[p] = filtersByPage[p];
            fd.append("filters", JSON.stringify(filters));
        }
        closeOnSuccess.current = true;
        fetcher.submit(fd, { method: "post" });
    };

    // ---- taxonomy (categories) handlers ------------------------------------
    const activeShop = scope.kind === "section" ? scope.slug : "";
    const shopSubs: Array<[string, SubcategoryDef]> = activeShop
        ? Object.entries(taxonomy[activeShop] ?? {})
        : [];
    const patchShop = (
        mut: (subs: Record<string, SubcategoryDef>) => Record<string, SubcategoryDef>,
    ) => setTaxonomy((prev) => ({ ...prev, [activeShop]: mut({ ...(prev[activeShop] ?? {}) }) }));
    const renameCategory = (slug: string, label: string) =>
        patchShop((subs) => ({ ...subs, [slug]: { ...subs[slug], label } }));
    const toggleAxis = (slug: string, axis: "fabrics" | "sleeves", code: string) =>
        patchShop((subs) => {
            const def = { ...subs[slug] };
            const cur = def[axis] ?? [];
            const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
            if (next.length) def[axis] = next;
            else delete def[axis];
            return { ...subs, [slug]: def };
        });
    const removeCategory = (slug: string) =>
        patchShop((subs) => {
            const next = { ...subs };
            delete next[slug];
            return next;
        });
    const moveCategory = (slug: string, dir: -1 | 1) =>
        patchShop((subs) => {
            const entries = Object.entries(subs);
            const i = entries.findIndex(([s]) => s === slug);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= entries.length) return subs;
            [entries[i], entries[j]] = [entries[j], entries[i]];
            return Object.fromEntries(entries);
        });

    const [newCatLabel, setNewCatLabel] = useState("");
    const [newCatSlug, setNewCatSlug] = useState("");
    const [newCatSlugTouched, setNewCatSlugTouched] = useState(false);
    const [taxoError, setTaxoError] = useState<string | null>(null);
    const effNewSlug = newCatSlugTouched ? newCatSlug.trim() : slugify(newCatLabel);
    const addCategory = () => {
        const label = newCatLabel.trim();
        if (!label) return setTaxoError("Вкажіть назву категорії.");
        if (!effNewSlug || !SLUG_RE.test(effNewSlug))
            return setTaxoError("Код категорії: лише латиниця, цифри та дефіс (напр. leggings).");
        if (taxonomy[activeShop]?.[effNewSlug])
            return setTaxoError(`Категорія з кодом «${effNewSlug}» вже існує.`);
        patchShop((subs) => ({ ...subs, [effNewSlug]: { label } }));
        setNewCatLabel("");
        setNewCatSlug("");
        setNewCatSlugTouched(false);
        setTaxoError(null);
    };

    // ---- section (shopMeta) handlers ---------------------------------------
    const setNavLabel = (slug: string, navLabel: string) =>
        setShopMeta((prev) => ({
            ...prev,
            items: { ...prev.items, [slug]: { ...prev.items[slug], navLabel } },
        }));
    const toggleHidden = (slug: string) =>
        setShopMeta((prev) => ({
            ...prev,
            items: {
                ...prev.items,
                [slug]: { ...prev.items[slug], hidden: !prev.items[slug]?.hidden },
            },
        }));
    const moveSection = (slug: string, dir: -1 | 1) =>
        setShopMeta((prev) => {
            const order = [...sectionOrder];
            const i = order.indexOf(slug);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= order.length) return prev;
            [order[i], order[j]] = [order[j], order[i]];
            return { ...prev, order };
        });
    const liveOrder = [
        ...(shopMeta.order ?? []).filter((s) => SHOP_SLUGS.includes(s)),
        ...SHOP_SLUGS.filter((s) => !(shopMeta.order ?? []).includes(s)),
    ];

    // ---- vocabulary («Словник») handlers -----------------------------------
    const renameVocab = (axis: "fabric" | "sleeve", code: string, label: string) =>
        (axis === "fabric" ? setFabricLabels : setSleeveLabels)((prev) => ({
            ...prev,
            [code]: label,
        }));
    const removeVocab = (axis: "fabric" | "sleeve", code: string) => {
        (axis === "fabric" ? setFabricLabels : setSleeveLabels)((prev) => {
            const next = { ...prev };
            delete next[code];
            return next;
        });
        // Cascade: drop the code from every category that used it, so the menu and
        // the validator never reference a vocabulary entry that no longer exists.
        const taxoAxis = axis === "fabric" ? "fabrics" : "sleeves";
        setTaxonomy((prev) => {
            const next: ShopTaxonomy = {};
            for (const [shop, subs] of Object.entries(prev)) {
                const ns: Record<string, SubcategoryDef> = {};
                for (const [cat, def] of Object.entries(subs)) {
                    const arr = def[taxoAxis];
                    if (arr?.includes(code)) {
                        const filtered = arr.filter((c) => c !== code);
                        const nd = { ...def };
                        if (filtered.length) nd[taxoAxis] = filtered;
                        else delete nd[taxoAxis];
                        ns[cat] = nd;
                    } else {
                        ns[cat] = def;
                    }
                }
                next[shop] = ns;
            }
            return next;
        });
    };
    const [newVocab, setNewVocab] = useState({
        fabric: { code: "", label: "" },
        sleeve: { code: "", label: "" },
    });
    const [vocabError, setVocabError] = useState<string | null>(null);
    const [confirmRemoveCode, setConfirmRemoveCode] = useState<{
        axis: "fabric" | "sleeve";
        code: string;
    } | null>(null);
    const addVocab = (axis: "fabric" | "sleeve") => {
        const { code, label } = newVocab[axis];
        const c = code.trim() || slugify(label);
        if (!label.trim()) return setVocabError("Вкажіть назву.");
        if (!c || !SLUG_RE.test(c))
            return setVocabError("Код: лише латиниця, цифри та дефіс (напр. wool).");
        const map = axis === "fabric" ? fabricLabels : sleeveLabels;
        if (map[c]) return setVocabError(`Код «${c}» вже існує.`);
        renameVocab(axis, c, label.trim());
        setNewVocab((p) => ({ ...p, [axis]: { code: "", label: "" } }));
        setVocabError(null);
    };

    // ---- filters (colors/sizes/prices) handlers ----------------------------
    const [newColorHex, setNewColorHex] = useState("#888888");
    const [newColorLabel, setNewColorLabel] = useState("");
    const addColor = () => {
        if (!newColorHex || !newColorLabel.trim()) return;
        setData((prev) => ({
            ...prev,
            colors: { ...prev.colors, [newColorHex]: newColorLabel.trim() },
        }));
        setNewColorLabel("");
    };
    const removeColor = (key: string) =>
        setData((prev) => {
            const next = { ...prev.colors };
            delete next[key];
            return { ...prev, colors: next };
        });
    const [newSize, setNewSize] = useState("");
    const addSize = () => {
        if (!newSize.trim()) return;
        setData((prev) => ({ ...prev, sizes: [...(prev.sizes || []), newSize.trim()] }));
        setNewSize("");
    };
    const addPriceRange = () =>
        setData((prev) => ({
            ...prev,
            priceRanges: [
                ...prev.priceRanges,
                {
                    id: `range-${prev.priceRanges.length}-${Math.round(prev.priceRanges.reduce((a, r) => a + r.max, 1))}`,
                    label: "Новий діапазон",
                    min: 0,
                    max: 1000,
                },
            ],
        }));

    // ---- facet counts (display) --------------------------------------------
    const gate = Boolean(availableFacets && availableFacets.global);
    const avail: FacetCounts = (filterPage && availableFacets[filterPage]) || {
        categories: {},
        colors: {},
        sizes: {},
    };
    // ---- product counts per fabric/sleeve, from getMegaCounts -----------------
    // getMegaCounts keys: `${shop}/${cat}`, `${shop}/${cat}/${fabric}`,
    // `${shop}/${cat}/${fabric}/${sleeve}`, `${shop}/${cat}/_/${sleeve}` (no fabric).
    // These prove the menu↔product binding (a pill's count = real tagged products).
    const catTotal = (cat: string) => megaCounts[`${activeShop}/${cat}`] || 0;
    const fabricCount = (cat: string, code: string) =>
        megaCounts[`${activeShop}/${cat}/${code}`] || 0;
    // A sleeve has no single rollup key in fabric-bearing categories, so sum the
    // fabric-agnostic leaf (`_`) PLUS every `${fabric}/${code}` leaf.
    const sleeveCount = (cat: string, code: string) => {
        let n = megaCounts[`${activeShop}/${cat}/_/${code}`] || 0;
        const prefix = `${activeShop}/${cat}/`;
        const suffix = `/${code}`;
        for (const k in megaCounts) {
            if (k.startsWith(prefix) && k.endsWith(suffix) && !k.startsWith(`${prefix}_/`)) {
                const mid = k.slice(prefix.length, k.length - suffix.length);
                if (mid && !mid.includes("/")) n += megaCounts[k];
            }
        }
        return n;
    };
    const axisCount = (axis: "fabrics" | "sleeves", cat: string, code: string) =>
        axis === "fabrics" ? fabricCount(cat, code) : sleeveCount(cat, code);
    const colorCount = (key: string) =>
        (avail.colors[key] || 0) + (data?.colors[key] ? avail.colors[data.colors[key]] || 0 : 0);
    const sizeCount = (size: string) => avail.sizes[size] || 0;

    // ---- small UI helpers --------------------------------------------------
    const countPill = (n: number) => (
        <span
            title="товарів тут"
            style={{
                fontSize: "10px",
                color: "#5eead4",
                background: "rgba(94,234,212,0.1)",
                border: "1px solid rgba(94,234,212,0.25)",
                borderRadius: "6px",
                padding: "1px 7px",
                whiteSpace: "nowrap",
                fontWeight: 600,
            }}
        >
            {n} {tovarWord(n)}
        </span>
    );
    const pill = (active: boolean, label: string, onClick: () => void, key: string) => (
        <button
            key={key}
            type="button"
            onClick={onClick}
            aria-pressed={active}
            style={{
                padding: "5px 12px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: active
                    ? "1px solid var(--accent-primary)"
                    : "1px solid rgba(255,255,255,0.14)",
                background: active ? "rgba(94,234,212,0.15)" : "transparent",
                color: active ? "#5eead4" : "#94a3b8",
            }}
        >
            {active ? "✓ " : ""}
            {label}
        </button>
    );
    const sectionTitle = (txt: string, extra?: ReactNode) => (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
            }}
        >
            <h4
                style={{
                    color: "var(--accent-primary)",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    margin: 0,
                    borderLeft: "3px solid var(--accent-primary)",
                    paddingLeft: "12px",
                }}
            >
                {txt}
            </h4>
            {extra}
        </div>
    );

    const railItem = (
        keyId: string,
        active: boolean,
        dirtyDot: boolean,
        onClick: () => void,
        children: ReactNode,
        extra?: ReactNode,
    ) => (
        <div
            key={keyId}
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                borderRadius: "10px",
                cursor: "pointer",
                background: active ? "rgba(94,234,212,0.12)" : "transparent",
                border: active ? "1px solid var(--accent-primary)" : "1px solid transparent",
                color: active ? "#fff" : "#cbd5e1",
                fontSize: "13px",
                fontWeight: 600,
            }}
        >
            <span
                style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}
            >
                {children}
            </span>
            {dirtyDot && (
                <span
                    title="Незбережені зміни"
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#fbbf24",
                        flexShrink: 0,
                    }}
                />
            )}
            {extra}
        </div>
    );

    // ---- detail: category card ---------------------------------------------
    const fabricCodes = Object.keys(fabricLabels);
    const sleeveCodes = Object.keys(sleeveLabels);
    const fLabel = (c: string) => fabricLabels[c] ?? fabricLabel(c);
    const sLabel = (c: string) => sleeveLabels[c] ?? sleeveLabel(c);
    const sectionTitleOf = (slug: string) => shopPages.find((p) => p.slug === slug)?.title ?? slug;

    // One fabric/sleeve axis row: pills + per-pill product-count badge + «порожнє»
    // note (a menu link with no products) + opportunity chips (products exist but
    // the pill is OFF → one click shows it in the menu).
    const axisRow = (
        slug: string,
        axis: "fabrics" | "sleeves",
        label: string,
        minW: number,
        codes: string[],
        active: string[],
        labelFn: (c: string) => string,
    ) => {
        const total = catTotal(slug);
        const hiddenUsed = codes.filter((c) => !active.includes(c) && axisCount(axis, slug, c) > 0);
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div
                    style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
                >
                    <span style={{ fontSize: "11px", color: "#64748b", minWidth: `${minW}px` }}>
                        {label}
                    </span>
                    {codes.map((c) => {
                        const on = active.includes(c);
                        const n = axisCount(axis, slug, c);
                        return (
                            <span
                                key={`${axis}-${c}`}
                                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                                {pill(
                                    on,
                                    labelFn(c),
                                    () => toggleAxis(slug, axis, c),
                                    `${axis}-${c}`,
                                )}
                                {n > 0 && countPill(n)}
                                {on && n === 0 && total > 0 && (
                                    <span
                                        title="Посилання є в меню, але товарів із цією ознакою поки немає"
                                        style={{ fontSize: "10px", color: "#fbbf24" }}
                                    >
                                        порожнє
                                    </span>
                                )}
                            </span>
                        );
                    })}
                </div>
                {hiddenUsed.map((c) => {
                    const n = axisCount(axis, slug, c);
                    return (
                        <button
                            key={`opp-${axis}-${c}`}
                            type="button"
                            onClick={() => toggleAxis(slug, axis, c)}
                            style={{
                                alignSelf: "flex-start",
                                padding: "3px 10px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                border: "1px solid var(--accent-primary)",
                                background: "rgba(94,234,212,0.1)",
                                color: "#5eead4",
                            }}
                        >
                            {labelFn(c)}: є {n} {tovarWord(n)} — показати в меню
                        </button>
                    );
                })}
            </div>
        );
    };

    const categoryCard = (slug: string, def: SubcategoryDef, idx: number, total: number) => {
        const fabrics = def.fabrics ?? [];
        const sleeves = def.sleeves ?? [];
        // Codes that have tagged products but aren't enabled in the menu (across
        // both axes) — drive the bulk «show all that exist» button.
        const hiddenUsed: Array<["fabrics" | "sleeves", string]> = [
            ...fabricCodes
                .filter((c) => !fabrics.includes(c) && fabricCount(slug, c) > 0)
                .map((c): ["fabrics", string] => ["fabrics", c]),
            ...sleeveCodes
                .filter((c) => !sleeves.includes(c) && sleeveCount(slug, c) > 0)
                .map((c): ["sleeves", string] => ["sleeves", c]),
        ];
        const preview = [shopMeta.items[activeShop]?.navLabel || activeShop, def.label || "—"];
        if (fabrics.length) preview.push(fabrics.map(fLabel).join("/"));
        if (sleeves.length) preview.push(sleeves.map(sLabel).join("/"));
        return (
            <div key={slug} style={{ ...sCard, padding: "16px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                        value={def.label}
                        onChange={(e) => renameCategory(slug, e.target.value)}
                        placeholder="Назва категорії"
                        aria-label="Назва категорії"
                        style={{
                            ...sInput,
                            flex: 1,
                            fontSize: "15px",
                            fontWeight: 600,
                            background: "rgba(255,255,255,0.05)",
                        }}
                    />
                    <span
                        title="Адреса (незмінна)"
                        style={{ fontSize: "11px", color: "#475569", fontFamily: "monospace" }}
                    >
                        /{slug}
                    </span>
                    <button
                        type="button"
                        onClick={() => moveCategory(slug, -1)}
                        disabled={idx === 0}
                        aria-label="Вгору"
                        style={{ ...sIconBtn, opacity: idx === 0 ? 0.3 : 1 }}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => moveCategory(slug, 1)}
                        disabled={idx === total - 1}
                        aria-label="Вниз"
                        style={{ ...sIconBtn, opacity: idx === total - 1 ? 0.3 : 1 }}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={() => removeCategory(slug)}
                        aria-label="Видалити"
                        style={{ ...sIconBtn, color: "#ef4444" }}
                    >
                        ✕
                    </button>
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        marginTop: "12px",
                    }}
                >
                    {axisRow(slug, "fabrics", "Тканина", 56, fabricCodes, fabrics, fLabel)}
                    {axisRow(slug, "sleeves", "Рукав", 44, sleeveCodes, sleeves, sLabel)}
                    {hiddenUsed.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                hiddenUsed.forEach(([axis, c]) => toggleAxis(slug, axis, c))
                            }
                            style={{
                                ...sIconBtn,
                                alignSelf: "flex-start",
                                width: "auto",
                                padding: "0 14px",
                                color: "var(--accent-primary)",
                                borderColor: "var(--accent-primary)",
                            }}
                        >
                            ✓ Показати все, що є в товарах
                        </button>
                    )}
                </div>
                <div
                    style={{
                        marginTop: "10px",
                        fontSize: "11px",
                        color: "#475569",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                    }}
                >
                    <span>
                        У меню: <span style={{ color: "#64748b" }}>{preview.join("  ›  ")}</span>
                        {catTotal(slug) > 0 && (
                            <span style={{ color: "#5eead4", marginLeft: "8px" }}>
                                · {catTotal(slug)} {tovarWord(catTotal(slug))}
                            </span>
                        )}
                    </span>
                    <a
                        href={`/admin/products?category=${slug}`}
                        style={{ color: "#5eead4", textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                        Керувати товарами цієї категорії →
                    </a>
                </div>
            </div>
        );
    };

    // ---- detail: featured card (own multipart fetcher) ---------------------
    const featuredFetcher = useFetcher();
    const featuredSaving = featuredFetcher.state !== "idle";
    // A render FUNCTION (not a nested component) so the uncontrolled multipart
    // form keeps its DOM state across parent re-renders.
    const renderFeatured = (slug: string) => {
        const item = navFeatured.items[slug];
        return (
            <div style={{ ...sCard, marginBottom: "22px" }}>
                {sectionTitle("Картка мега-меню")}
                <p style={{ color: "#64748b", fontSize: "12px", margin: "-6px 0 14px" }}>
                    Велике фото, назва й бейдж у випадному меню цього розділу.
                </p>
                <featuredFetcher.Form
                    method="post"
                    encType="multipart/form-data"
                    style={{
                        display: "flex",
                        gap: "16px",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                    }}
                >
                    <input type="hidden" name="intent" value="update_nav_featured" />
                    <input type="hidden" name={`${slug}_currentImage`} value={item?.image ?? ""} />
                    <div
                        style={{
                            width: 84,
                            height: 105,
                            borderRadius: 10,
                            overflow: "hidden",
                            background: "#000",
                            border: "1px solid rgba(255,255,255,0.08)",
                            flexShrink: 0,
                        }}
                    >
                        {item?.image && (
                            <img
                                src={item.image}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        )}
                    </div>
                    <div
                        style={{
                            flex: "1 1 240px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                        }}
                    >
                        <FilePickerField name={`${slug}_image_file`} label="Замінити фото" />
                        <input
                            name={`${slug}_title`}
                            defaultValue={item?.title ?? ""}
                            placeholder="Назва (напр. Yoga Колекція)"
                            style={sInput}
                        />
                        <input
                            name={`${slug}_badge`}
                            defaultValue={item?.badge ?? ""}
                            placeholder="Бейдж (напр. YOGA)"
                            style={sInput}
                        />
                        <button
                            type="submit"
                            disabled={featuredSaving}
                            style={{
                                ...sPrimaryBtn,
                                alignSelf: "flex-start",
                                opacity: featuredSaving ? 0.5 : 1,
                            }}
                        >
                            {featuredSaving ? "Збереження…" : "Оновити фото картки"}
                        </button>
                    </div>
                </featuredFetcher.Form>
            </div>
        );
    };

    // ---- detail: filters (colors/sizes/prices) -----------------------------
    const colorCard = (key: string, label: string) => (
        <div
            key={key}
            style={{
                ...sCard,
                display: "flex",
                gap: "12px",
                alignItems: "center",
                position: "relative",
            }}
        >
            <button
                onClick={() => removeColor(key)}
                aria-label="Видалити"
                style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    opacity: 0.6,
                }}
            >
                ✕
            </button>
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: key === "other" ? "linear-gradient(45deg,red,blue)" : key,
                    border: "2px solid rgba(255,255,255,0.2)",
                    flexShrink: 0,
                }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: "9px",
                        color: "#475569",
                        textTransform: "uppercase",
                        marginBottom: 4,
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}
                >
                    <span style={{ fontFamily: "monospace" }}>{key}</span>
                    {gate && colorCount(key) > 0 && countPill(colorCount(key))}
                </div>
                <input
                    value={label}
                    onChange={(e) =>
                        setData((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, [key]: e.target.value },
                        }))
                    }
                    style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        color: "#fff",
                        fontSize: "14px",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        outline: "none",
                    }}
                />
            </div>
        </div>
    );
    const renderFilters = (label: string) =>
        data && (
            <div>
                {scope.kind === "section" && (
                    <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 16px" }}>
                        Фільтри для розділу «{label}». За замовчуванням успадковані із «Загальних».
                    </p>
                )}
                {/* Colors */}
                <div style={{ marginBottom: 32 }}>
                    {sectionTitle("Кольори")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                            gap: 14,
                            marginBottom: 14,
                        }}
                    >
                        {Object.entries(data.colors).map(([k, v]) => colorCard(k, v))}
                    </div>
                    <div
                        style={{
                            background: "rgba(94,234,212,0.05)",
                            padding: 14,
                            borderRadius: 14,
                            border: "1px dashed rgba(94,234,212,0.3)",
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="color"
                            value={newColorHex}
                            onChange={(e) => setNewColorHex(e.target.value)}
                            aria-label="Колір"
                            style={{
                                width: 44,
                                height: 40,
                                padding: 0,
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                background: "transparent",
                                cursor: "pointer",
                            }}
                        />
                        <input
                            placeholder="Назва (напр. Бірюзовий)"
                            value={newColorLabel}
                            onChange={(e) => setNewColorLabel(e.target.value)}
                            style={{ ...sInput, flex: "1 1 180px" }}
                        />
                        <button onClick={addColor} style={sPrimaryBtn}>
                            Додати
                        </button>
                    </div>
                </div>
                {/* Prices */}
                <div style={{ marginBottom: 32 }}>
                    {sectionTitle(
                        "Діапазони цін",
                        <button
                            onClick={addPriceRange}
                            style={{
                                ...sIconBtn,
                                width: "auto",
                                padding: "0 14px",
                                color: "var(--accent-primary)",
                                borderColor: "var(--accent-primary)",
                            }}
                        >
                            + Додати
                        </button>,
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {data.priceRanges.map((range, idx) => (
                            <div
                                key={range.id ?? idx}
                                style={{
                                    ...sCard,
                                    display: "grid",
                                    gridTemplateColumns: "2fr 1fr 1fr 40px",
                                    gap: 14,
                                    alignItems: "center",
                                }}
                            >
                                <input
                                    value={range.label}
                                    placeholder="Назва"
                                    onChange={(e) =>
                                        setData((prev) => {
                                            const r = [...prev.priceRanges];
                                            r[idx] = { ...r[idx], label: e.target.value };
                                            return { ...prev, priceRanges: r };
                                        })
                                    }
                                    style={{
                                        width: "100%",
                                        background: "transparent",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: 15,
                                        fontWeight: 600,
                                        outline: "none",
                                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                />
                                <input
                                    type="number"
                                    value={range.min}
                                    aria-label="Від"
                                    onChange={(e) =>
                                        setData((prev) => {
                                            const r = [...prev.priceRanges];
                                            r[idx] = {
                                                ...r[idx],
                                                min: parseInt(e.target.value) || 0,
                                            };
                                            return { ...prev, priceRanges: r };
                                        })
                                    }
                                    style={{ ...sInput, width: "100%", padding: 10 }}
                                />
                                <input
                                    type="number"
                                    value={range.max}
                                    aria-label="До"
                                    onChange={(e) =>
                                        setData((prev) => {
                                            const r = [...prev.priceRanges];
                                            r[idx] = {
                                                ...r[idx],
                                                max: parseInt(e.target.value) || 0,
                                            };
                                            return { ...prev, priceRanges: r };
                                        })
                                    }
                                    style={{ ...sInput, width: "100%", padding: 10 }}
                                />
                                <button
                                    onClick={() =>
                                        setData((prev) => ({
                                            ...prev,
                                            priceRanges: prev.priceRanges.filter(
                                                (_, i) => i !== idx,
                                            ),
                                        }))
                                    }
                                    aria-label="Видалити"
                                    style={{
                                        height: 40,
                                        width: 40,
                                        background: "rgba(239,68,68,0.1)",
                                        border: "none",
                                        color: "#ef4444",
                                        borderRadius: 10,
                                        cursor: "pointer",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Sizes */}
                <div>
                    {sectionTitle("Розміри")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))",
                            gap: 10,
                            marginBottom: 14,
                        }}
                    >
                        {(data.sizes || []).map((size, idx) => (
                            <div
                                key={idx}
                                style={{
                                    ...sCard,
                                    padding: 10,
                                    borderRadius: 12,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <input
                                    value={size}
                                    onChange={(e) =>
                                        setData((prev) => {
                                            const s = [...prev.sizes];
                                            s[idx] = e.target.value;
                                            return { ...prev, sizes: s };
                                        })
                                    }
                                    style={{
                                        flex: 1,
                                        background: "transparent",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: 14,
                                        outline: "none",
                                        textAlign: "center",
                                        minWidth: 0,
                                    }}
                                />
                                <button
                                    onClick={() =>
                                        setData((prev) => ({
                                            ...prev,
                                            sizes: prev.sizes.filter((_, i) => i !== idx),
                                        }))
                                    }
                                    aria-label="Видалити"
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        opacity: 0.5,
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <div
                        style={{
                            background: "rgba(94,234,212,0.05)",
                            padding: 14,
                            borderRadius: 14,
                            border: "1px dashed rgba(94,234,212,0.3)",
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <input
                            placeholder="Новий розмір (напр. XXL)"
                            value={newSize}
                            onChange={(e) => setNewSize(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addSize()}
                            style={{ ...sInput, flex: "1 1 180px" }}
                        />
                        <button onClick={addSize} style={sPrimaryBtn}>
                            Додати
                        </button>
                    </div>
                </div>
            </div>
        );

    // ---- detail: vocabulary list -------------------------------------------
    const vocabList = (axis: "fabric" | "sleeve") => {
        const map = axis === "fabric" ? fabricLabels : sleeveLabels;
        const defaults = axis === "fabric" ? DEFAULT_FABRIC_LABELS : DEFAULT_SLEEVE_LABELS;
        return (
            <div style={{ marginBottom: 28 }}>
                {sectionTitle(axis === "fabric" ? "Тканина" : "Рукав")}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {Object.entries(map).map(([code, label]) => (
                        <div
                            key={code}
                            style={{
                                ...sCard,
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                                padding: 12,
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: "monospace",
                                    fontSize: 12,
                                    color: "#475569",
                                    minWidth: 90,
                                }}
                            >
                                {code}
                            </span>
                            <input
                                value={label}
                                onChange={(e) => renameVocab(axis, code, e.target.value)}
                                aria-label={`Назва ${code}`}
                                style={{ ...sInput, flex: 1, background: "rgba(255,255,255,0.05)" }}
                            />
                            {code in defaults && (
                                <span
                                    title="Стандартна назва — можна перейменувати або видалити"
                                    style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap" }}
                                >
                                    базова
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setConfirmRemoveCode({ axis, code })}
                                aria-label="Видалити"
                                style={{ ...sIconBtn, color: "#ef4444" }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        background: "rgba(94,234,212,0.05)",
                        padding: 14,
                        borderRadius: 14,
                        border: "1px dashed rgba(94,234,212,0.3)",
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 12,
                    }}
                >
                    <input
                        placeholder="Назва (напр. Шерсть)"
                        value={newVocab[axis].label}
                        onChange={(e) => {
                            setNewVocab((p) => ({
                                ...p,
                                [axis]: { ...p[axis], label: e.target.value },
                            }));
                            setVocabError(null);
                        }}
                        style={{ ...sInput, flex: "2 1 160px" }}
                    />
                    <input
                        placeholder="код (wool)"
                        value={newVocab[axis].code}
                        onChange={(e) => {
                            setNewVocab((p) => ({
                                ...p,
                                [axis]: { ...p[axis], code: e.target.value },
                            }));
                            setVocabError(null);
                        }}
                        style={{ ...sInput, flex: "1 1 120px", fontFamily: "monospace" }}
                    />
                    <button onClick={() => addVocab(axis)} style={sPrimaryBtn}>
                        Додати
                    </button>
                </div>
            </div>
        );
    };

    const dirtyPagesSet = new Set(dirtyFilterPages);

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(10px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 20,
                }}
            >
                <style
                    dangerouslySetInnerHTML={{
                        __html: `@keyframes modalUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`,
                    }}
                />
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Меню та фільтри магазину"
                    style={{
                        width: "100%",
                        maxWidth: 1080,
                        height: "92vh",
                        background: "#0f1216",
                        borderRadius: 24,
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "0 50px 100px rgba(0,0,0,0.6)",
                        overflow: "hidden",
                        animation: "modalUp .3s cubic-bezier(.16,1,.3,1)",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "20px 28px",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            background: "#161b22",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>
                                Меню та фільтри магазину
                            </h3>
                            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                                Розділи меню, категорії, тканина/рукав та фільтри — все в одному
                                місці.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={requestClose}
                            aria-label="Закрити"
                            style={{
                                color: "#94a3b8",
                                background: "rgba(255,255,255,0.05)",
                                border: "none",
                                cursor: "pointer",
                                padding: 10,
                                borderRadius: 12,
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body: rail + detail */}
                    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                        {/* RAIL */}
                        <div
                            className="admin-scroll-custom"
                            style={{
                                width: 232,
                                flexShrink: 0,
                                borderRight: "1px solid rgba(255,255,255,0.08)",
                                overflowY: "auto",
                                padding: "16px 12px",
                                background: "#0c0f13",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    color: "#475569",
                                    fontWeight: 700,
                                    padding: "4px 12px 8px",
                                }}
                            >
                                Розділи (верхнє меню)
                            </div>
                            {liveOrder.map((slug, idx) => {
                                const meta = shopMeta.items[slug];
                                const initShopMeta = JSON.parse(initialSnap.shopMeta);
                                const isDirty =
                                    (shopMetaDirty &&
                                        JSON.stringify(shopMeta.items[slug]) !==
                                            JSON.stringify(initShopMeta.items?.[slug])) ||
                                    (shopMetaDirty &&
                                        (shopMeta.order ?? []).join() !==
                                            (initShopMeta.order ?? []).join()) ||
                                    taxonomyDirtyForShop(slug, taxonomy, initialSnap.taxonomy) ||
                                    dirtyPagesSet.has(slug);
                                return railItem(
                                    slug,
                                    scope.kind === "section" && scope.slug === slug,
                                    isDirty,
                                    () => setScope({ kind: "section", slug }),
                                    <>
                                        <span
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 2,
                                            }}
                                        >
                                            <span style={{ opacity: meta?.hidden ? 0.45 : 1 }}>
                                                {meta?.navLabel || slug}
                                            </span>
                                        </span>
                                    </>,
                                    <span style={{ display: "flex", gap: 2 }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveSection(slug, -1);
                                            }}
                                            disabled={idx === 0}
                                            aria-label="Вгору"
                                            style={{
                                                ...sIconBtn,
                                                width: 24,
                                                height: 24,
                                                opacity: idx === 0 ? 0.3 : 1,
                                            }}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveSection(slug, 1);
                                            }}
                                            disabled={idx === liveOrder.length - 1}
                                            aria-label="Вниз"
                                            style={{
                                                ...sIconBtn,
                                                width: 24,
                                                height: 24,
                                                opacity: idx === liveOrder.length - 1 ? 0.3 : 1,
                                            }}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleHidden(slug);
                                            }}
                                            aria-label={meta?.hidden ? "Показати" : "Сховати"}
                                            title={meta?.hidden ? "Прихований" : "Показаний"}
                                            style={{
                                                ...sIconBtn,
                                                width: 24,
                                                height: 24,
                                                color: meta?.hidden ? "#64748b" : "#5eead4",
                                            }}
                                        >
                                            {meta?.hidden ? "🚫" : "👁"}
                                        </button>
                                    </span>,
                                );
                            })}
                            <div
                                style={{
                                    height: 1,
                                    background: "rgba(255,255,255,0.08)",
                                    margin: "12px 8px",
                                }}
                            />
                            {railItem(
                                "__global",
                                scope.kind === "global",
                                dirtyPagesSet.has("global"),
                                () => setScope({ kind: "global" }),
                                <>⚙ Загальні фільтри</>,
                            )}
                            {railItem(
                                "__vocab",
                                scope.kind === "vocab",
                                vocabDirty,
                                () => setScope({ kind: "vocab" }),
                                <>🔤 Тканина і рукав</>,
                            )}
                            <p
                                style={{
                                    fontSize: 11,
                                    color: "#475569",
                                    padding: "12px 12px 0",
                                    lineHeight: 1.5,
                                }}
                            >
                                Розділи фіксовані — щоб додати/прибрати розділ, зверніться до
                                розробника. Назву, порядок і видимість можна змінювати тут.
                            </p>
                        </div>

                        {/* DETAIL */}
                        <div
                            className="admin-scroll-custom"
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                padding: "24px 28px",
                                minWidth: 0,
                            }}
                        >
                            {scope.kind === "section" && (
                                <div>
                                    {/* Section header */}
                                    <div
                                        style={{
                                            ...sCard,
                                            marginBottom: 22,
                                            display: "flex",
                                            gap: 14,
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <div style={{ flex: "1 1 220px" }}>
                                            <label
                                                style={{
                                                    fontSize: 11,
                                                    color: "#64748b",
                                                    display: "block",
                                                    marginBottom: 6,
                                                }}
                                            >
                                                Назва в меню
                                            </label>
                                            <input
                                                value={shopMeta.items[scope.slug]?.navLabel ?? ""}
                                                onChange={(e) =>
                                                    setNavLabel(scope.slug, e.target.value)
                                                }
                                                placeholder="напр. YOGA"
                                                style={{
                                                    ...sInput,
                                                    width: "100%",
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    background: "rgba(255,255,255,0.05)",
                                                }}
                                            />
                                        </div>
                                        <label
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                color: "#cbd5e1",
                                                fontSize: 13,
                                                cursor: "pointer",
                                                marginTop: 18,
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!shopMeta.items[scope.slug]?.hidden}
                                                onChange={() => toggleHidden(scope.slug)}
                                            />
                                            Показувати в меню
                                        </label>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: "#475569",
                                                marginTop: 18,
                                            }}
                                        >
                                            Адреса: /shop/{scope.slug}
                                        </span>
                                    </div>

                                    {renderFeatured(scope.slug)}

                                    {/* Categories */}
                                    {sectionTitle(`Категорії меню · ${sectionTitleOf(scope.slug)}`)}
                                    <p
                                        style={{
                                            color: "#64748b",
                                            fontSize: 13,
                                            margin: "-6px 0 10px",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        Ці категорії формують меню сайту.{" "}
                                        <b style={{ color: "#94a3b8" }}>
                                            Тканина й рукав — це посилання-фільтри в меню
                                        </b>
                                        , а не самі товари: товар з'являється під ними сам, коли ви
                                        познач́ите йому тканину/рукав у картці товару. ↑/↓ — порядок.
                                    </p>
                                    <details style={{ marginBottom: 16 }}>
                                        <summary
                                            style={{
                                                cursor: "pointer",
                                                color: "#5eead4",
                                                fontSize: 12,
                                                userSelect: "none",
                                                padding: "4px 0",
                                            }}
                                        >
                                            Як це працює? (меню ↔ товари)
                                        </summary>
                                        <div
                                            style={{
                                                ...sCard,
                                                fontSize: 13,
                                                color: "#94a3b8",
                                                lineHeight: 1.6,
                                                marginTop: 8,
                                            }}
                                        >
                                            <div style={{ marginBottom: 6 }}>
                                                <b style={{ color: "#5eead4" }}>1.</b> Увімкніть
                                                пілюлю тут — у меню з'явиться посилання-фільтр
                                                (напр. «Sport», «Довгий рукав»).
                                            </div>
                                            <div style={{ marginBottom: 6 }}>
                                                <b style={{ color: "#5eead4" }}>2.</b> У картці
                                                товару виберіть ту саму тканину/рукав — товар сам
                                                потрапить під це посилання.
                                            </div>
                                            <div style={{ marginBottom: 6 }}>
                                                <b style={{ color: "#5eead4" }}>3.</b> Покупець
                                                бачить і посилання, і товари під ним.
                                            </div>
                                            <div style={{ color: "#fbbf24" }}>
                                                Пілюля сама по собі не додає товарів — лише
                                                показує/ховає посилання. Цифри «N товарів» біля
                                                пілюль показують, скільки товарів уже прив'язано.
                                            </div>
                                        </div>
                                    </details>
                                    <button
                                        type="button"
                                        onClick={() => setScope({ kind: "vocab" })}
                                        style={{
                                            ...sIconBtn,
                                            width: "auto",
                                            padding: "8px 14px",
                                            marginBottom: 18,
                                            color: "var(--accent-primary)",
                                            borderColor: "rgba(94,234,212,0.4)",
                                            background: "rgba(94,234,212,0.06)",
                                        }}
                                    >
                                        ✎ Перейменувати, додати або прибрати тканину/рукав →
                                    </button>
                                    {shopSubs.length === 0 && (
                                        <p
                                            style={{
                                                color: "#64748b",
                                                fontSize: 13,
                                                fontStyle: "italic",
                                                marginBottom: 16,
                                            }}
                                        >
                                            У цьому розділі ще немає категорій. Додайте першу нижче.
                                        </p>
                                    )}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 14,
                                            marginBottom: 18,
                                        }}
                                    >
                                        {shopSubs.map(([slug, def], idx) => (
                                            <Fragment key={slug}>
                                                {categoryCard(slug, def, idx, shopSubs.length)}
                                            </Fragment>
                                        ))}
                                    </div>
                                    <div
                                        style={{
                                            background: "rgba(94,234,212,0.05)",
                                            padding: 16,
                                            borderRadius: 14,
                                            border: "1px dashed rgba(94,234,212,0.3)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "#5eead4",
                                                textTransform: "uppercase",
                                                letterSpacing: 1,
                                                marginBottom: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            + Нова категорія
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 12,
                                                flexWrap: "wrap",
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <input
                                                placeholder="Назва (напр. Легінси)"
                                                value={newCatLabel}
                                                onChange={(e) => {
                                                    setNewCatLabel(e.target.value);
                                                    setTaxoError(null);
                                                }}
                                                onKeyDown={(e) =>
                                                    e.key === "Enter" && addCategory()
                                                }
                                                style={{ ...sInput, flex: "2 1 200px" }}
                                            />
                                            <div style={{ flex: "1 1 150px" }}>
                                                <input
                                                    placeholder="код (leggings)"
                                                    value={effNewSlug}
                                                    onChange={(e) => {
                                                        setNewCatSlug(e.target.value);
                                                        setNewCatSlugTouched(true);
                                                        setTaxoError(null);
                                                    }}
                                                    aria-label="Код"
                                                    style={{
                                                        ...sInput,
                                                        width: "100%",
                                                        fontFamily: "monospace",
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: "#475569",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    /shop/{scope.slug}/{effNewSlug || "…"}
                                                </div>
                                            </div>
                                            <button onClick={addCategory} style={sPrimaryBtn}>
                                                Додати
                                            </button>
                                        </div>
                                        {taxoError && (
                                            <p
                                                role="alert"
                                                style={{
                                                    color: "#fca5a5",
                                                    fontSize: 12,
                                                    margin: "10px 0 0",
                                                }}
                                            >
                                                {taxoError}
                                            </p>
                                        )}
                                    </div>

                                    {/* Filters */}
                                    <details style={{ marginTop: 28 }}>
                                        <summary
                                            style={{
                                                cursor: "pointer",
                                                color: "var(--accent-primary)",
                                                fontSize: 12,
                                                textTransform: "uppercase",
                                                letterSpacing: 2,
                                                padding: "8px 0",
                                                userSelect: "none",
                                            }}
                                        >
                                            Фільтри товарів цього розділу
                                        </summary>
                                        <div style={{ marginTop: 16 }}>
                                            {renderFilters(sectionTitleOf(scope.slug))}
                                        </div>
                                    </details>
                                </div>
                            )}

                            {scope.kind === "global" && (
                                <div>
                                    {sectionTitle("Загальні фільтри за замовчуванням")}
                                    <p
                                        style={{
                                            color: "#64748b",
                                            fontSize: 13,
                                            margin: "-6px 0 18px",
                                        }}
                                    >
                                        Застосовуються до всіх розділів, де не задано власні
                                        фільтри.
                                    </p>
                                    {renderFilters("Усі розділи")}
                                </div>
                            )}

                            {scope.kind === "vocab" && (
                                <div>
                                    {sectionTitle("Тканина і рукав — назви")}
                                    <p
                                        style={{
                                            color: "#64748b",
                                            fontSize: 13,
                                            margin: "-6px 0 18px",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        Назви тканини та рукава, що показуються в меню й фільтрах.
                                        Тут їх можна{" "}
                                        <b style={{ color: "#94a3b8" }}>перейменувати</b>,{" "}
                                        <b style={{ color: "#94a3b8" }}>додати свої</b> та{" "}
                                        <b style={{ color: "#94a3b8" }}>видалити</b>. Поле «код»
                                        (латиниця) — технічна адреса, її змінювати не можна;
                                        редагуйте назву зліва.
                                    </p>
                                    {vocabList("fabric")}
                                    {vocabList("sleeve")}
                                    {vocabError && (
                                        <p role="alert" style={{ color: "#fca5a5", fontSize: 12 }}>
                                            {vocabError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: "18px 28px",
                            background: "#161b22",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 16,
                        }}
                    >
                        <span
                            role="alert"
                            style={{
                                flex: 1,
                                minHeight: 18,
                                color: submitError ? "#fca5a5" : "#64748b",
                                fontSize: 13,
                                fontWeight: 500,
                            }}
                        >
                            {submitError ??
                                (invalidRange
                                    ? "Перевірте діапазони цін: «від» не може бути більшим за «до»."
                                    : dirty
                                      ? "Є незбережені зміни."
                                      : "")}
                        </span>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button
                                onClick={requestClose}
                                disabled={saving}
                                style={{
                                    padding: "12px 24px",
                                    borderRadius: 12,
                                    background: "transparent",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    color: "#94a3b8",
                                    cursor: saving ? "default" : "pointer",
                                    fontWeight: 600,
                                }}
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || invalidRange || !dirty}
                                style={{
                                    padding: "12px 32px",
                                    borderRadius: 12,
                                    background: "var(--accent-primary)",
                                    color: "#000",
                                    border: "none",
                                    cursor:
                                        saving || invalidRange || !dirty ? "default" : "pointer",
                                    fontWeight: 700,
                                    opacity: saving || invalidRange || !dirty ? 0.5 : 1,
                                    boxShadow: "0 10px 20px rgba(94,234,212,0.2)",
                                }}
                            >
                                {saving ? "Збереження…" : "Зберегти зміни"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmDialog
                open={showDiscard}
                title="Відхилити зміни?"
                body="Незбережені зміни буде втрачено."
                confirmLabel="Відхилити"
                cancelLabel="Залишитись"
                onConfirm={() => {
                    setShowDiscard(false);
                    onClose();
                }}
                onCancel={() => setShowDiscard(false)}
            />
            <ConfirmDialog
                open={!!confirmRemoveCode}
                title="Видалити код?"
                body="Товари, у яких вибрано цей код, залишаться без нього в меню. Видаляйте лише якщо ним ще ніхто не користується."
                confirmLabel="Видалити"
                cancelLabel="Скасувати"
                onConfirm={() => {
                    if (confirmRemoveCode)
                        removeVocab(confirmRemoveCode.axis, confirmRemoveCode.code);
                    setConfirmRemoveCode(null);
                }}
                onCancel={() => setConfirmRemoveCode(null)}
            />
        </>
    );
}

/** Did this shop's category tree change vs the initial snapshot? (for the rail dirty-dot) */
function taxonomyDirtyForShop(slug: string, taxonomy: ShopTaxonomy, initialJSON: string): boolean {
    try {
        const init = JSON.parse(initialJSON) as ShopTaxonomy;
        return JSON.stringify(taxonomy[slug] ?? {}) !== JSON.stringify(init[slug] ?? {});
    } catch {
        return false;
    }
}
