import { SHOP_PAGE_OPTIONS } from "../../../utils/shop-pages";

interface ShopViewProps {
    activeShop: string;
    /** Remount key suffix — bumped after a successful save to reload the preview. */
    previewNonce: number;
    onSelectShop: (slug: string) => void;
    onEditBg: () => void;
    onEditFilters: () => void;
}

/**
 * "Магазин" editor view — the real /shop/{slug} page in a fullscreen iframe
 * under a floating overlay with the shop selector + edit actions. Extracted
 * 1:1 from app/routes/admin/slides.tsx (SE1).
 */
export function ShopView({
    activeShop,
    previewNonce,
    onSelectShop,
    onEditBg,
    onEditFilters,
}: ShopViewProps) {
    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {/* Top overlay: real-shop selector + actions */}
            <div
                style={{
                    position: "absolute",
                    top: "16px",
                    left: "16px",
                    right: "16px",
                    zIndex: 10,
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    pointerEvents: "auto",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "4px",
                        flexWrap: "wrap",
                        background: "rgba(15, 23, 42, 0.85)",
                        backdropFilter: "blur(8px)",
                        padding: "5px",
                        borderRadius: "24px",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                    }}
                >
                    {SHOP_PAGE_OPTIONS.map((o) => (
                        <button
                            key={o.slug}
                            onClick={() => onSelectShop(o.slug)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "18px",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.03em",
                                background:
                                    o.slug === activeShop ? "var(--accent-primary)" : "transparent",
                                color: o.slug === activeShop ? "#000" : "#cbd5e1",
                                transition: "all 0.15s",
                            }}
                        >
                            {o.title}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onEditBg}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        background: "var(--accent-primary)",
                        border: "none",
                        borderRadius: "20px",
                        color: "#000",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(94, 234, 212, 0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    Змінити фон
                </button>
                <button
                    onClick={onEditFilters}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        background: "rgba(15, 23, 42, 0.85)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(148, 163, 184, 0.3)",
                        borderRadius: "20px",
                        color: "#e2e8f0",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    Редагувати фільтри
                </button>
            </div>

            <iframe
                key={`${activeShop}-${previewNonce}`}
                src={`/shop/${activeShop}`}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Перегляд магазину"
                // Same-origin storefront preview: allow its scripts +
                // same-origin (hydration + the OPEN_SHOP_BG_EDITOR
                // postMessage bridge) but block top-navigation, popups
                // and forms so a storefront bug can't drive the admin UI.
                sandbox="allow-scripts allow-same-origin"
            />
        </div>
    );
}
