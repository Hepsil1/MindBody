import { useState, useEffect } from "react";
import { parseAndMergeFilterConfig } from "../../utils/filters";

/**
 * Filter Editor Modal — extracted from app/routes/admin/slides.tsx
 * to keep the visual editor route file scannable. Owns the full
 * categories/colors/sizes/priceRanges editing UI for the global
 * filter config plus optional per-shop overrides.
 */
// --- Filter Editor Modal Component ---
export function FilterEditorModal({
    isOpen,
    onClose,
    filterConfigs = [],
    shopPages = [],
    fetcher,
}: any) {
    const [selectedPage, setSelectedPage] = useState("global");

    const [data, setData] = useState(() => {
        const globalRow = filterConfigs.find((c: any) => c.id === "global");
        return parseAndMergeFilterConfig(globalRow?.config);
    });

    useEffect(() => {
        const configRow = filterConfigs.find((c: any) => c.id === selectedPage);
        const globalRow = filterConfigs.find((c: any) => c.id === "global");
        const fallbackConfig = parseAndMergeFilterConfig(globalRow?.config);

        if (!configRow?.config) {
            setData(fallbackConfig);
        } else {
            setData(parseAndMergeFilterConfig(configRow.config));
        }
    }, [selectedPage, filterConfigs]);

    const handleSave = () => {
        const formData = new FormData();
        formData.append("intent", "update_filters");
        formData.append("pageSlug", selectedPage);
        formData.append("config", JSON.stringify(data));
        fetcher.submit(formData, { method: "post" });
        // Don't close immediately so they see it saved, but for simplicity we close now:
        onClose();
    };

    // Category Logic
    const [newCatKey, setNewCatKey] = useState("");
    const [newCatLabel, setNewCatLabel] = useState("");
    const addCategory = () => {
        if (!newCatKey || !newCatLabel) return;
        setData((prev: any) => ({
            ...prev,
            categories: { ...prev.categories, [newCatKey]: newCatLabel },
        }));
        setNewCatKey("");
        setNewCatLabel("");
    };
    const removeCategory = (key: string) => {
        const newCats = { ...data.categories };
        delete newCats[key];
        setData((prev: any) => ({ ...prev, categories: newCats }));
    };

    // Color Logic
    const [newColorKey, setNewColorKey] = useState("");
    const [newColorLabel, setNewColorLabel] = useState("");
    const addColor = () => {
        if (!newColorKey || !newColorLabel) return;
        setData((prev: any) => ({
            ...prev,
            colors: { ...prev.colors, [newColorKey]: newColorLabel },
        }));
        setNewColorKey("");
        setNewColorLabel("");
    };
    const removeColor = (key: string) => {
        const newColors = { ...data.colors };
        delete newColors[key];
        setData((prev: any) => ({ ...prev, colors: newColors }));
    };

    // Size Logic
    const [newSize, setNewSize] = useState("");
    const addSize = () => {
        if (!newSize) return;
        setData((prev: any) => ({
            ...prev,
            sizes: [...(prev.sizes || []), newSize],
        }));
        setNewSize("");
    };

    // Price Logic
    const addPriceRange = () => {
        const newRange = { id: `range-${Date.now()}`, label: "Новий діапазон", min: 0, max: 1000 };
        setData((prev: any) => ({
            ...prev,
            priceRanges: [...prev.priceRanges, newRange],
        }));
    };
    const removePriceRange = (idx: number) => {
        const newRanges = data.priceRanges.filter((_: any, i: number) => i !== idx);
        setData((prev: any) => ({ ...prev, priceRanges: newRanges }));
    };

    const updateLabel = (type: "categories" | "colors", key: string, val: string) => {
        setData((prev: any) => ({
            ...prev,
            [type]: { ...prev[type], [key]: val },
        }));
    };

    const updatePriceRange = (index: number, field: string, val: any) => {
        const newRanges = [...data.priceRanges];
        newRanges[index] = { ...newRanges[index], [field]: val };
        setData((prev: any) => ({ ...prev, priceRanges: newRanges }));
    };

    return (
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
                            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
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
                                {(shopPages || []).map((p: any) => (
                                    <option key={p.slug} value={p.slug}>
                                        {p.title ? `${p.title} (${p.slug})` : p.slug}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
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

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                gap: "16px",
                                marginBottom: "20px",
                            }}
                        >
                            {Object.entries(data.categories).map(([key, label]: any) => (
                                <div
                                    key={key}
                                    style={{
                                        background: "rgba(255,255,255,0.03)",
                                        padding: "16px",
                                        borderRadius: "16px",
                                        border: "1px solid rgba(255,255,255,0.05)",
                                        position: "relative",
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
                                        }}
                                    >
                                        ID: {key}
                                    </div>
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={(e) =>
                                            updateLabel("categories", key, e.target.value)
                                        }
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
                            ))}
                        </div>

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
                                placeholder="ID (напр. jumpsuits)"
                                value={newCatKey}
                                onChange={(e) => setNewCatKey(e.target.value)}
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
                            КОЛЬОР�?
                        </h4>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                gap: "16px",
                                marginBottom: "20px",
                            }}
                        >
                            {Object.entries(data.colors).map(([key, label]: any) => (
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
                                            background:
                                                key === "other"
                                                    ? "linear-gradient(45deg, red, blue)"
                                                    : key,
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
                                            }}
                                        >
                                            Key: {key}
                                        </div>
                                        <input
                                            type="text"
                                            value={label}
                                            onChange={(e) =>
                                                updateLabel("colors", key, e.target.value)
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
                            ))}
                        </div>

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
                                ДІАПАЗОН�? ЦІН
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
                                + ДОДАТ�?
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {data.priceRanges.map((range: any, idx: number) => (
                                <div
                                    key={range.id}
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
                                РОЗМІР�?
                            </h4>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                                gap: "12px",
                                marginBottom: "20px",
                            }}
                        >
                            {(data.sizes || []).map((size: string, idx: number) => (
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
                                    }}
                                >
                                    <input
                                        type="text"
                                        value={size}
                                        onChange={(e) => {
                                            const newSizes = [...data.sizes];
                                            newSizes[idx] = e.target.value;
                                            setData((prev: any) => ({ ...prev, sizes: newSizes }));
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
                                            const newSizes = data.sizes.filter(
                                                (_: any, i: number) => i !== idx,
                                            );
                                            setData((prev: any) => ({ ...prev, sizes: newSizes }));
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
                            ))}
                        </div>

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
                        justifyContent: "flex-end",
                        gap: "16px",
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: "12px 24px",
                            borderRadius: "12px",
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#94a3b8",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        Скасувати
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: "12px 32px",
                            borderRadius: "12px",
                            background: "var(--accent-primary)",
                            color: "#000",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 700,
                            boxShadow: "0 10px 20px rgba(94, 234, 212, 0.2)",
                        }}
                    >
                        Зберегти зміни
                    </button>
                </div>
            </div>
        </div>
    );
}
