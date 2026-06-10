import { useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { SiteSettingKey } from "../../../utils/site-settings";

export interface ListField {
    name: string;
    label: string;
    type?: "text" | "textarea" | "number";
    placeholder?: string;
}

interface SiteSettingListPanelProps {
    title: string;
    description: string;
    /** SiteSetting key — saved as { items: [...] } under this key. */
    settingKey: SiteSettingKey;
    /** Initial items (from loader/defaults). */
    items: Array<Record<string, string | number>>;
    /** Field descriptors rendered per item, in order. */
    fields: ListField[];
    /** Heading per item card, e.g. (i) => `Перевага ${i + 1}`. */
    itemLabel: (index: number) => string;
    fetcher: FetcherWithComponents<unknown>;
}

/**
 * Generic editor for a fixed-length list setting (home features / stats /
 * brand-world). Renders one card per item with the given fields; saves the
 * whole list under `settingKey` via intent "update_site_settings" (the server
 * Zod-validates the shape before persisting). Number fields are coerced so the
 * value JSON carries real numbers, not strings.
 */
export function SiteSettingListPanel({
    title,
    description,
    settingKey,
    items,
    fields,
    itemLabel,
    fetcher,
}: SiteSettingListPanelProps) {
    const [rows, setRows] = useState(items);
    const dirty = JSON.stringify(rows) !== JSON.stringify(items);
    const saving = fetcher.state !== "idle";

    const update = (i: number, name: string, value: string, type?: ListField["type"]) => {
        setRows((prev) =>
            prev.map((row, idx) =>
                idx === i
                    ? { ...row, [name]: type === "number" ? Number(value) || 0 : value }
                    : row,
            ),
        );
    };

    const save = () => {
        const fd = new FormData();
        fd.append("intent", "update_site_settings");
        fd.append("key", settingKey);
        fd.append("value", JSON.stringify({ items: rows }));
        fetcher.submit(fd, { method: "post" });
    };

    return (
        <div
            className="custom-scrollbar"
            style={{ height: "100%", overflowY: "auto", background: "#0a0c10" }}
        >
            <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 24px 80px" }}>
                <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 600, margin: "0 0 6px" }}>
                    {title}
                </h2>
                <p
                    style={{
                        color: "#64748b",
                        fontSize: "13px",
                        margin: "0 0 28px",
                        lineHeight: 1.6,
                    }}
                >
                    {description}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {rows.map((row, i) => (
                        <div
                            key={i}
                            style={{
                                background: "#16191f",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: "14px",
                                padding: "18px",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "11px",
                                    textTransform: "uppercase",
                                    letterSpacing: "1px",
                                    color: "var(--accent-primary)",
                                    fontWeight: 700,
                                    marginBottom: "14px",
                                }}
                            >
                                {itemLabel(i)}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {fields.map((f) => (
                                    <div key={f.name}>
                                        <label
                                            htmlFor={`ss-${settingKey}-${i}-${f.name}`}
                                            style={{
                                                display: "block",
                                                fontSize: "11px",
                                                color: "#94a3b8",
                                                marginBottom: "5px",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {f.label}
                                        </label>
                                        {f.type === "textarea" ? (
                                            <textarea
                                                id={`ss-${settingKey}-${i}-${f.name}`}
                                                value={String(row[f.name] ?? "")}
                                                placeholder={f.placeholder}
                                                rows={2}
                                                onChange={(e) =>
                                                    update(i, f.name, e.target.value, f.type)
                                                }
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "10px 12px",
                                                    borderRadius: 9,
                                                    fontSize: "13px",
                                                    resize: "vertical",
                                                    fontFamily: "inherit",
                                                }}
                                            />
                                        ) : (
                                            <input
                                                id={`ss-${settingKey}-${i}-${f.name}`}
                                                type={f.type === "number" ? "number" : "text"}
                                                value={String(row[f.name] ?? "")}
                                                placeholder={f.placeholder}
                                                onChange={(e) =>
                                                    update(i, f.name, e.target.value, f.type)
                                                }
                                                style={{
                                                    width: "100%",
                                                    background: "#0a0c10",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    color: "#fff",
                                                    padding: "10px 12px",
                                                    borderRadius: 9,
                                                    fontSize: "13px",
                                                }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        marginTop: "26px",
                    }}
                >
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !dirty}
                        style={{
                            padding: "12px 32px",
                            borderRadius: "12px",
                            background: "var(--accent-primary)",
                            color: "#000",
                            border: "none",
                            cursor: saving || !dirty ? "default" : "pointer",
                            fontWeight: 700,
                            fontSize: "14px",
                            opacity: saving || !dirty ? 0.5 : 1,
                        }}
                    >
                        {saving ? "Збереження…" : "Зберегти"}
                    </button>
                    {dirty && !saving && (
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                            Є незбережені зміни
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
