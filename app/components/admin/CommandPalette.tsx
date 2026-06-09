import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useModalA11y } from "./useModalA11y";
import type { AdminSearchResults, AdminSearchHit } from "../../routes/admin/api.search";

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
}

const GROUPS: Array<{ key: keyof AdminSearchResults; title: string }> = [
    { key: "orders", title: "Замовлення" },
    { key: "products", title: "Товари" },
    { key: "customers", title: "Клієнти" },
];

/**
 * Cmd+K / Ctrl+K palette: one input → grouped hits across orders / products /
 * customers (admin/api.search). Arrows move, Enter opens, Escape closes (via
 * useModalA11y, which also traps focus and restores it to the opener).
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
    const navigate = useNavigate();
    const fetcher = useFetcher<AdminSearchResults>();
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const dialogRef = useRef<HTMLDivElement>(null);
    useModalA11y(dialogRef, onClose, open);

    // Debounced search — the palette is opened for a quick lookup, 200ms feels
    // instant without hammering the API on every keystroke.
    useEffect(() => {
        if (!open) return;
        const term = q.trim();
        if (term.length < 2) return;
        const t = window.setTimeout(() => {
            fetcher.load(`/admin/api/search?q=${encodeURIComponent(term)}`);
        }, 200);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, open]);

    // Reset state each time the palette opens.
    useEffect(() => {
        if (open) {
            setQ("");
            setActive(0);
        }
    }, [open]);

    const results = q.trim().length >= 2 ? fetcher.data : undefined;
    const flat: Array<AdminSearchHit & { group: string }> = useMemo(() => {
        if (!results) return [];
        return GROUPS.flatMap(({ key, title }) =>
            (results[key] ?? []).map((h) => ({ ...h, group: title })),
        );
    }, [results]);

    useEffect(() => {
        if (active >= flat.length) setActive(0);
    }, [flat.length, active]);

    if (!open) return null;

    const go = (hit: AdminSearchHit | undefined) => {
        if (!hit) return;
        onClose();
        navigate(hit.to);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            go(flat[active]);
        }
    };

    let lastGroup = "";

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1100,
                background: "rgba(2,6,12,0.6)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: "12vh",
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Глобальний пошук по адмінці"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(640px, 94vw)",
                    background: "#161b22",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    boxShadow: "0 24px 64px -16px rgba(0,0,0,0.7)",
                    overflow: "hidden",
                }}
            >
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="№ замовлення, товар, клієнт…"
                    aria-label="Пошук по замовленнях, товарах і клієнтах"
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "16px 20px",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: "var(--text-main, #f8fafc)",
                        fontSize: "16px",
                        outline: "none",
                    }}
                />
                <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "8px 0" }}>
                    {q.trim().length < 2 ? (
                        <div style={{ padding: "16px 20px", color: "#64748b", fontSize: "13px" }}>
                            Введіть мінімум 2 символи. ↑↓ — навігація, Enter — відкрити.
                        </div>
                    ) : fetcher.state !== "idle" && flat.length === 0 ? (
                        <div style={{ padding: "16px 20px", color: "#64748b", fontSize: "13px" }}>
                            Пошук…
                        </div>
                    ) : flat.length === 0 ? (
                        <div style={{ padding: "16px 20px", color: "#64748b", fontSize: "13px" }}>
                            Нічого не знайдено.
                        </div>
                    ) : (
                        flat.map((hit, i) => {
                            const showHeader = hit.group !== lastGroup;
                            lastGroup = hit.group;
                            return (
                                <div key={`${hit.to}-${i}`}>
                                    {showHeader && (
                                        <div
                                            style={{
                                                padding: "10px 20px 4px",
                                                fontSize: "11px",
                                                fontWeight: 700,
                                                letterSpacing: "0.08em",
                                                textTransform: "uppercase",
                                                color: "#64748b",
                                            }}
                                        >
                                            {hit.group}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => go(hit)}
                                        onMouseEnter={() => setActive(i)}
                                        style={{
                                            display: "block",
                                            width: "100%",
                                            textAlign: "left",
                                            padding: "10px 20px",
                                            background:
                                                i === active
                                                    ? "rgba(94,234,212,0.08)"
                                                    : "transparent",
                                            border: "none",
                                            borderLeft:
                                                i === active
                                                    ? "2px solid var(--accent-primary, #5eead4)"
                                                    : "2px solid transparent",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div
                                            style={{
                                                color: "var(--text-main, #f8fafc)",
                                                fontSize: "14px",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {hit.label}
                                        </div>
                                        <div style={{ color: "#64748b", fontSize: "12px" }}>
                                            {hit.sub}
                                        </div>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
