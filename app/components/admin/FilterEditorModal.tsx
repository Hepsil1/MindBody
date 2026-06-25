import { useState, useEffect, useRef, Fragment, type ReactNode } from "react";
import type { FetcherWithComponents } from "react-router";
import type { ShopPage, FilterConfig } from "@prisma/client";
import { parseAndMergeFilterConfig } from "../../utils/filters";
import { knownCategorySlugsFor, ALLOWED_CATEGORY_SLUGS } from "../../utils/categoryMap";
import { useDirty } from "./useDirty";
import { ConfirmDialog } from "./ConfirmDialog";
import { useModalA11y } from "./useModalA11y";

/**
 * Filter Editor Modal — extracted from app/routes/admin/slides.tsx
 * to keep the visual editor route file scannable. Owns the full
 * categories/colors/sizes/priceRanges editing UI for the global
 * filter config plus optional per-shop overrides.
 */
/** Per-page facet counts (categories/colors/sizes -> product count), built
    server-side by deriveAvailableFacets. Keyed by shop slug, plus a "global"
    union bucket. Drives which filters the editor SHOWS so it mirrors the live
    storefront (a facet with 0 products on a page is hidden there too). */
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
    fetcher: FetcherWithComponents<unknown>;
}

/** Ukrainian plural for "товар" (1 товар / 2-4 товари / 5+ товарів). */
function tovarWord(n: number): string {
    const d = n % 10;
    const dd = n % 100;
    if (d === 1 && dd !== 11) return "товар";
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "товари";
    return "товарів";
}

export function FilterEditorModal({
    isOpen,
    onClose,
    filterConfigs = [],
    shopPages = [],
    availableFacets = {},
    fetcher,
}: FilterEditorModalProps) {
    const [selectedPage, setSelectedPage] = useState("global");

    const [data, setData] = useState(() => {
        const globalRow = filterConfigs.find((c) => c.id === "global");
        return parseAndMergeFilterConfig(globalRow?.config);
    });
    // Snapshot of the config as last loaded for `selectedPage` — the dirty check
    // and the "discard unsaved changes?" guard compare `data` against this.
    const [initialData, setInitialData] = useState(data);

    useEffect(() => {
        const configRow = filterConfigs.find((c) => c.id === selectedPage);
        const globalRow = filterConfigs.find((c) => c.id === "global");
        // Per-shop config overrides global; fall back to global, then defaults.
        const loaded = parseAndMergeFilterConfig(configRow?.config || globalRow?.config);
        setData(loaded);
        setInitialData(loaded);
    }, [selectedPage, filterConfigs]);

    const closeOnSuccess = useRef(false);
    const saving = fetcher.state !== "idle";
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Close ONLY after the server confirms success. The previous code called
    // onClose() immediately on submit ("for simplicity we close now"), so a
    // rejected save (e.g. a price range with min>max) closed the modal and the
    // operator never connected the error to their edit. Now: stay open while
    // saving; on success close; on failure keep open and show the reason inline.
    useEffect(() => {
        if (fetcher.state !== "idle" || !closeOnSuccess.current) return;
        closeOnSuccess.current = false;
        const res = fetcher.data as { ok?: boolean; error?: string } | undefined;
        if (res?.ok) onClose();
        else setSubmitError(res?.error ?? "Не вдалося зберегти зміни.");
    }, [fetcher.state, fetcher.data, onClose]);

    const handleSave = () => {
        setSubmitError(null);
        const formData = new FormData();
        formData.append("intent", "update_filters");
        formData.append("pageSlug", selectedPage);
        formData.append("config", JSON.stringify(data));
        closeOnSuccess.current = true;
        fetcher.submit(formData, { method: "post" });
    };

    // Client-side guards (the server still enforces both):
    //  - invalidRange disables Save + shows a hint, so the operator fixes a
    //    min>max range before a round-trip instead of after a rejected save.
    //  - dirty + a ConfirmDialog stop an accidental close from silently dropping
    //    unsaved edits.
    const invalidRange = data.priceRanges.some((r) => Number(r.min) > Number(r.max));
    const dirty = useDirty(data, initialData);
    const [showDiscard, setShowDiscard] = useState(false);
    const requestClose = () => {
        if (dirty) setShowDiscard(true);
        else onClose();
    };
    // Focus trap + Escape-to-close; suspended while the discard ConfirmDialog
    // (which has its own trap) is open.
    const dialogRef = useRef<HTMLDivElement>(null);
    useModalA11y(dialogRef, requestClose, !showDiscard);

    // Category Logic. New categories are picked from the taxonomy catalog for
    // the current page, minus the ones already in the config.
    const [newCatKey, setNewCatKey] = useState("");
    const [newCatLabel, setNewCatLabel] = useState("");
    const availableCatalogCats = knownCategorySlugsFor(selectedPage).filter(
        (c) => !(c.slug in data.categories),
    );
    const addCategory = () => {
        if (!newCatKey || !newCatLabel) return;
        setData((prev) => ({
            ...prev,
            categories: { ...prev.categories, [newCatKey]: newCatLabel },
        }));
        setNewCatKey("");
        setNewCatLabel("");
    };
    const removeCategory = (key: string) => {
        const newCats = { ...data.categories };
        delete newCats[key];
        setData((prev) => ({ ...prev, categories: newCats }));
    };

    // Color Logic
    const [newColorKey, setNewColorKey] = useState("");
    const [newColorLabel, setNewColorLabel] = useState("");
    const addColor = () => {
        if (!newColorKey || !newColorLabel) return;
        setData((prev) => ({
            ...prev,
            colors: { ...prev.colors, [newColorKey]: newColorLabel },
        }));
        setNewColorKey("");
        setNewColorLabel("");
    };
    const removeColor = (key: string) => {
        const newColors = { ...data.colors };
        delete newColors[key];
        setData((prev) => ({ ...prev, colors: newColors }));
    };

    // Size Logic
    const [newSize, setNewSize] = useState("");
    const addSize = () => {
        if (!newSize) return;
        setData((prev) => ({
            ...prev,
            sizes: [...(prev.sizes || []), newSize],
        }));
        setNewSize("");
    };

    // Price Logic
    const addPriceRange = () => {
        const newRange = { id: `range-${Date.now()}`, label: "Новий діапазон", min: 0, max: 1000 };
        setData((prev) => ({
            ...prev,
            priceRanges: [...prev.priceRanges, newRange],
        }));
    };
    const removePriceRange = (idx: number) => {
        const newRanges = data.priceRanges.filter((_, i: number) => i !== idx);
        setData((prev) => ({ ...prev, priceRanges: newRanges }));
    };

    const updateLabel = (type: "categories" | "colors", key: string, val: string) => {
        setData((prev) => ({
            ...prev,
            [type]: { ...prev[type], [key]: val },
        }));
    };

    const updatePriceRange = (index: number, field: string, val: string | number) => {
        const newRanges = [...data.priceRanges];
        newRanges[index] = { ...newRanges[index], [field]: val };
        setData((prev) => ({ ...prev, priceRanges: newRanges }));
    };

    // ---- Per-page sync (display only) ----------------------------------
    // Mirror the live storefront: a category/colour/size shows here only when
    // it has >0 active products on the selected page — the same gate
    // shop.$category.tsx applies (count===0 -> hidden). `data` is NEVER pruned,
    // so Save still posts the full config (incl. hidden entries) — non-destructive.
    // `gate` is off only when no product data loaded at all (loader error /
    // empty store) so the editor never looks like "everything disappeared".
    const gate = Boolean(availableFacets && availableFacets.global);
    const avail: FacetCounts = (availableFacets && availableFacets[selectedPage]) || {
        categories: {},
        colors: {},
        sizes: {},
    };
    // Counts replicate the storefront's dual slug-OR-label match
    // (shop.$category.tsx: p.category === slug || p.category === label).
    const catCount = (key: string) =>
        (avail.categories[key] || 0) +
        (data.categories[key] ? avail.categories[data.categories[key]] || 0 : 0);
    const colorCount = (key: string) =>
        (avail.colors[key] || 0) + (data.colors[key] ? avail.colors[data.colors[key]] || 0 : 0);
    const sizeCount = (size: string) => avail.sizes[size] || 0;

    const catEntries = Object.entries(data.categories);
    const colorEntries = Object.entries(data.colors);
    const sizeItems = (data.sizes || []).map((size, idx) => ({ size, idx }));
    const presentCats = catEntries.filter(([k]) => !gate || catCount(k) > 0);
    const hiddenCats = catEntries.filter(([k]) => gate && catCount(k) === 0);
    const presentColors = colorEntries.filter(([k]) => !gate || colorCount(k) > 0);
    const hiddenColors = colorEntries.filter(([k]) => gate && colorCount(k) === 0);
    const presentSizes = sizeItems.filter(({ size }) => !gate || sizeCount(size) > 0);
    const hiddenSizes = sizeItems.filter(({ size }) => gate && sizeCount(size) === 0);
    const pageTitle = shopPages.find((p) => p.slug === selectedPage)?.title ?? selectedPage;
    // Grammatical context for the "no products here" copy — "global" is the
    // master vocabulary (all pages), not a single page.
    const noProductsWhere =
        selectedPage === "global" ? "у жодному розділі" : `на сторінці «${pageTitle}»`;

    const countPill = (n: number) => (
        <span
            title="товарів на цій сторінці"
            style={{
                marginLeft: "8px",
                fontSize: "10px",
                color: "#5eead4",
                background: "rgba(94,234,212,0.1)",
                border: "1px solid rgba(94,234,212,0.25)",
                borderRadius: "6px",
                padding: "1px 7px",
                whiteSpace: "nowrap",
                fontWeight: 600,
                textTransform: "none",
            }}
        >
            {n} {tovarWord(n)}
        </span>
    );

    const hiddenDisclosure = (count: number, cols: string, children: ReactNode) =>
        count === 0 ? null : (
            <details style={{ marginTop: "4px", marginBottom: "8px" }}>
                <summary
                    style={{
                        cursor: "pointer",
                        color: "#64748b",
                        fontSize: "12px",
                        padding: "8px 0",
                        userSelect: "none",
                    }}
                >
                    Налаштовано, але немає товарів {noProductsWhere} ({count})
                </summary>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: cols,
                        gap: "16px",
                        marginTop: "12px",
                    }}
                >
                    {children}
                </div>
            </details>
        );

    const emptyNote = () =>
        gate ? (
            <p
                style={{
                    color: "#64748b",
                    fontSize: "13px",
                    fontStyle: "italic",
                    margin: "0 0 16px",
                }}
            >
                Поки немає товарів цієї групи {noProductsWhere}.
            </p>
        ) : null;

    const categoryCard = (key: string, label: string, muted: boolean) => (
        <div
            key={key}
            style={{
                background: "rgba(255,255,255,0.03)",
                padding: "16px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.05)",
                position: "relative",
                opacity: muted ? 0.5 : 1,
            }}
        >
            <button
                onClick={() => removeCategory(key)}
                style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
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
                    fontSize: "10px",
                    color: "#475569",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                }}
            >
                ID: {key}
                {!ALLOWED_CATEGORY_SLUGS.has(key) && (
                    <span
                        style={{
                            color: "#fbbf24",
                            background: "rgba(251, 191, 36, 0.12)",
                            border: "1px solid rgba(251, 191, 36, 0.3)",
                            borderRadius: "6px",
                            padding: "1px 6px",
                            textTransform: "none",
                            fontWeight: 600,
                        }}
                    >
                        немає в каталозі
                    </span>
                )}
                {!muted && countPill(catCount(key))}
            </div>
            <input
                type="text"
                value={label}
                onChange={(e) => updateLabel("categories", key, e.target.value)}
                style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: "14px",
                    borderRadius: "8px",
                    padding: "8px 12px",
                }}
            />
        </div>
    );

    const colorCard = (key: string, label: string, muted: boolean) => (
        <div
            key={key}
            style={{
                background: "rgba(255,255,255,0.03)",
                padding: "16px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                gap: "12px",
                alignItems: "center",
                position: "relative",
                opacity: muted ? 0.5 : 1,
            }}
        >
            <button
                onClick={() => removeColor(key)}
                style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
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
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: key === "other" ? "linear-gradient(45deg, red, blue)" : key,
                    border: "2px solid rgba(255,255,255,0.2)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                    flexShrink: 0,
                }}
            ></div>
            <div style={{ flex: 1 }}>
                <div
                    style={{
                        fontSize: "9px",
                        color: "#475569",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "6px",
                    }}
                >
                    Key: {key}
                    {!muted && countPill(colorCount(key))}
                </div>
                <input
                    type="text"
                    value={label}
                    onChange={(e) => updateLabel("colors", key, e.target.value)}
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

    const sizeCard = (size: string, idx: number, muted: boolean) => (
        <div
            key={idx}
            style={{
                background: "rgba(255,255,255,0.03)",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                position: "relative",
                opacity: muted ? 0.5 : 1,
            }}
        >
            <input
                type="text"
                value={size}
                onChange={(e) => {
                    const newSizes = [...data.sizes];
                    newSizes[idx] = e.target.value;
                    setData((prev) => ({ ...prev, sizes: newSizes }));
                }}
                style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    textAlign: "center",
                    minWidth: "0",
                }}
            />
            <button
                onClick={() => {
                    const newSizes = data.sizes.filter((_, i: number) => i !== idx);
                    setData((prev) => ({ ...prev, sizes: newSizes }));
                }}
                style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "12px",
                    opacity: 0.5,
                }}
            >
                ✕
            </button>
        </div>
    );

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
                    padding: "20px",
                }}
            >
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `,
                    }}
                />
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Керування фільтрами"
                    style={{
                        width: "100%",
                        maxWidth: "900px",
                        maxHeight: "90vh",
                        background: "#0f1216",
                        borderRadius: "24px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "0 50px 100px rgba(0,0,0,0.6)",
                        overflow: "hidden",
                        animation: "modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "24px 32px",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#161b22",
                        }}
                    >
                        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
                            <div>
                                <h3
                                    style={{
                                        margin: 0,
                                        color: "#fff",
                                        fontSize: "18px",
                                        fontWeight: 700,
                                    }}
                                >
                                    Керування фільтрами
                                </h3>
                                <p
                                    style={{
                                        margin: "4px 0 0",
                                        color: "#64748b",
                                        fontSize: "13px",
                                    }}
                                >
                                    Повне налаштування категорій, кольорів та цін.
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                                    Для сторінки:
                                </span>
                                <select
                                    value={selectedPage}
                                    onChange={(e) => setSelectedPage(e.target.value)}
                                    aria-label="Сторінка, для якої редагуються фільтри"
                                    style={{
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        outline: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="global">Всі сторінки (Global)</option>
                                    {(shopPages || []).map((p) => (
                                        <option key={p.slug} value={p.slug}>
                                            {p.title ? `${p.title} (${p.slug})` : p.slug}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
                                padding: "10px",
                                borderRadius: "12px",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div
                        className="admin-scroll-custom"
                        style={{ flex: 1, overflowY: "auto", padding: "32px" }}
                    >
                        {/* Categories */}
                        <div style={{ marginBottom: "48px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "24px",
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
                                    КАТЕГОРІЇ
                                </h4>
                            </div>

                            {presentCats.length === 0 && emptyNote()}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                    gap: "16px",
                                    marginBottom: "20px",
                                }}
                            >
                                {presentCats.map(([key, label]) => (
                                    <Fragment key={key}>{categoryCard(key, label, false)}</Fragment>
                                ))}
                            </div>
                            {hiddenDisclosure(
                                hiddenCats.length,
                                "repeat(auto-fill, minmax(260px, 1fr))",
                                hiddenCats.map(([key, label]) => (
                                    <Fragment key={key}>{categoryCard(key, label, true)}</Fragment>
                                )),
                            )}

                            <div
                                style={{
                                    background: "rgba(94, 234, 212, 0.05)",
                                    padding: "20px",
                                    borderRadius: "16px",
                                    border: "1px dashed rgba(94, 234, 212, 0.3)",
                                    display: "flex",
                                    gap: "12px",
                                }}
                            >
                                {/* New category is PICKED from the taxonomy catalog (single
                                    source of truth) rather than free-typed — picking a slug
                                    prefills its catalog label, which the operator can still
                                    edit. Slugs already present are filtered out. */}
                                <select
                                    value={newCatKey}
                                    onChange={(e) => {
                                        const slug = e.target.value;
                                        setNewCatKey(slug);
                                        const found = availableCatalogCats.find(
                                            (c) => c.slug === slug,
                                        );
                                        if (found && !newCatLabel) setNewCatLabel(found.label);
                                    }}
                                    aria-label="Категорія з каталогу"
                                    style={{
                                        flex: 1,
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        fontSize: "13px",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="">— оберіть категорію —</option>
                                    {availableCatalogCats.map((c) => (
                                        <option key={c.slug} value={c.slug}>
                                            {c.label} ({c.slug})
                                        </option>
                                    ))}
                                </select>
                                <input
                                    placeholder="Назва (напр. Комбінезони)"
                                    value={newCatLabel}
                                    onChange={(e) => setNewCatLabel(e.target.value)}
                                    style={{
                                        flex: 2,
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        fontSize: "13px",
                                    }}
                                />
                                <button
                                    onClick={addCategory}
                                    style={{
                                        padding: "0 20px",
                                        background: "var(--accent-primary)",
                                        color: "#000",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    Додати
                                </button>
                            </div>
                        </div>

                        {/* Colors */}
                        <div style={{ marginBottom: "48px" }}>
                            <h4
                                style={{
                                    color: "var(--accent-primary)",
                                    fontSize: "12px",
                                    textTransform: "uppercase",
                                    letterSpacing: "2px",
                                    marginBottom: "24px",
                                    borderLeft: "3px solid var(--accent-primary)",
                                    paddingLeft: "12px",
                                }}
                            >
                                КОЛЬОРИ
                            </h4>

                            {presentColors.length === 0 && emptyNote()}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                    gap: "16px",
                                    marginBottom: "20px",
                                }}
                            >
                                {presentColors.map(([key, label]) => (
                                    <Fragment key={key}>{colorCard(key, label, false)}</Fragment>
                                ))}
                            </div>
                            {hiddenDisclosure(
                                hiddenColors.length,
                                "repeat(auto-fill, minmax(260px, 1fr))",
                                hiddenColors.map(([key, label]) => (
                                    <Fragment key={key}>{colorCard(key, label, true)}</Fragment>
                                )),
                            )}

                            <div
                                style={{
                                    background: "rgba(94, 234, 212, 0.05)",
                                    padding: "20px",
                                    borderRadius: "16px",
                                    border: "1px dashed rgba(94, 234, 212, 0.3)",
                                    display: "flex",
                                    gap: "12px",
                                }}
                            >
                                <input
                                    placeholder="CSS колір (напр. #FF0000)"
                                    value={newColorKey}
                                    onChange={(e) => setNewColorKey(e.target.value)}
                                    style={{
                                        flex: 1,
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        fontSize: "13px",
                                    }}
                                />
                                <input
                                    placeholder="Назва (напр. Яскравий червоний)"
                                    value={newColorLabel}
                                    onChange={(e) => setNewColorLabel(e.target.value)}
                                    style={{
                                        flex: 2,
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        fontSize: "13px",
                                    }}
                                />
                                <button
                                    onClick={addColor}
                                    style={{
                                        padding: "0 20px",
                                        background: "var(--accent-primary)",
                                        color: "#000",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    Додати
                                </button>
                            </div>
                        </div>

                        {/* Price Ranges */}
                        <div style={{ marginBottom: "48px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "24px",
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
                                    ДІАПАЗОНИ ЦІН
                                </h4>
                                <button
                                    onClick={addPriceRange}
                                    style={{
                                        padding: "6px 16px",
                                        background: "rgba(94, 234, 212, 0.1)",
                                        border: "1px solid var(--accent-primary)",
                                        color: "var(--accent-primary)",
                                        borderRadius: "8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    + ДОДАТИ
                                </button>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {data.priceRanges.map((range, idx: number) => (
                                    <div
                                        key={range.id ?? idx}
                                        style={{
                                            background: "rgba(255,255,255,0.03)",
                                            padding: "20px",
                                            borderRadius: "20px",
                                            border: "1px solid rgba(255,255,255,0.05)",
                                            display: "grid",
                                            gridTemplateColumns: "2fr 1fr 1fr 40px",
                                            gap: "24px",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: "10px",
                                                    color: "#475569",
                                                    marginBottom: "6px",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Назва діапазону
                                            </div>
                                            <input
                                                type="text"
                                                value={range.label}
                                                placeholder="Напр: Доступні ціни"
                                                onChange={(e) =>
                                                    updatePriceRange(idx, "label", e.target.value)
                                                }
                                                style={{
                                                    width: "100%",
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#fff",
                                                    fontSize: "15px",
                                                    fontWeight: 600,
                                                    outline: "none",
                                                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: "10px",
                                                    color: "#475569",
                                                    marginBottom: "6px",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Від (₴)
                                            </div>
                                            <input
                                                type="number"
                                                value={range.min}
                                                onChange={(e) =>
                                                    updatePriceRange(
                                                        idx,
                                                        "min",
                                                        parseInt(e.target.value) || 0,
                                                    )
                                                }
                                                style={{
                                                    width: "100%",
                                                    background: "rgba(255,255,255,0.05)",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "10px",
                                                    borderRadius: "10px",
                                                    fontSize: "14px",
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: "10px",
                                                    color: "#475569",
                                                    marginBottom: "6px",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                До (₴)
                                            </div>
                                            <input
                                                type="number"
                                                value={range.max}
                                                onChange={(e) =>
                                                    updatePriceRange(
                                                        idx,
                                                        "max",
                                                        parseInt(e.target.value) || 0,
                                                    )
                                                }
                                                style={{
                                                    width: "100%",
                                                    background: "rgba(255,255,255,0.05)",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "10px",
                                                    borderRadius: "10px",
                                                    fontSize: "14px",
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => removePriceRange(idx)}
                                            style={{
                                                height: "40px",
                                                width: "40px",
                                                background: "rgba(239, 68, 68, 0.1)",
                                                border: "none",
                                                color: "#ef4444",
                                                borderRadius: "10px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sizes Management */}
                        <div>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "24px",
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
                                    РОЗМІРИ
                                </h4>
                            </div>

                            {presentSizes.length === 0 && emptyNote()}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                                    gap: "12px",
                                    marginBottom: "20px",
                                }}
                            >
                                {presentSizes.map(({ size, idx }) => (
                                    <Fragment key={idx}>{sizeCard(size, idx, false)}</Fragment>
                                ))}
                            </div>
                            {hiddenDisclosure(
                                hiddenSizes.length,
                                "repeat(auto-fill, minmax(130px, 1fr))",
                                hiddenSizes.map(({ size, idx }) => (
                                    <Fragment key={idx}>{sizeCard(size, idx, true)}</Fragment>
                                )),
                            )}

                            <div
                                style={{
                                    background: "rgba(94, 234, 212, 0.05)",
                                    padding: "16px",
                                    borderRadius: "16px",
                                    border: "1px dashed rgba(94, 234, 212, 0.3)",
                                    display: "flex",
                                    gap: "12px",
                                }}
                            >
                                <input
                                    placeholder="Новий розмір (напр. XXL або 44)"
                                    value={newSize}
                                    onChange={(e) => setNewSize(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && addSize()}
                                    style={{
                                        flex: 1,
                                        background: "#0f1216",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#fff",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        fontSize: "13px",
                                    }}
                                />
                                <button
                                    onClick={addSize}
                                    style={{
                                        padding: "0 20px",
                                        background: "var(--accent-primary)",
                                        color: "#000",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    Додати
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: "24px 32px",
                            background: "#161b22",
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "16px",
                        }}
                    >
                        <span
                            role="alert"
                            style={{
                                flex: 1,
                                minHeight: "18px",
                                color: "#fca5a5",
                                fontSize: "13px",
                                fontWeight: 500,
                            }}
                        >
                            {submitError ??
                                (invalidRange
                                    ? "Перевірте діапазони цін: «від» не може бути більшим за «до»."
                                    : "")}
                        </span>
                        <div style={{ display: "flex", gap: "16px" }}>
                            <button
                                onClick={requestClose}
                                disabled={saving}
                                style={{
                                    padding: "12px 24px",
                                    borderRadius: "12px",
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
                                disabled={saving || invalidRange}
                                style={{
                                    padding: "12px 32px",
                                    borderRadius: "12px",
                                    background: "var(--accent-primary)",
                                    color: "#000",
                                    border: "none",
                                    cursor: saving || invalidRange ? "default" : "pointer",
                                    fontWeight: 700,
                                    opacity: saving || invalidRange ? 0.5 : 1,
                                    boxShadow: "0 10px 20px rgba(94, 234, 212, 0.2)",
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
                body="Незбережені зміни у фільтрах буде втрачено."
                confirmLabel="Відхилити"
                cancelLabel="Залишитись"
                onConfirm={() => {
                    setShowDiscard(false);
                    onClose();
                }}
                onCancel={() => setShowDiscard(false)}
            />
        </>
    );
}
