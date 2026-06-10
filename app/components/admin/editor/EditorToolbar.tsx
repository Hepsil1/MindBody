import type { CSSProperties, ReactNode } from "react";

/** Preview device width — the iframe wrapper is constrained to these. */
export type PreviewDevice = "desktop" | "tablet" | "mobile";
export const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, number | null> = {
    desktop: null, // 100%
    tablet: 768,
    mobile: 390,
};

/**
 * Persistent control strip above the editor's preview iframe. Replaces the
 * old floating overlay buttons (which covered preview content and vanished
 * behind modals). Left side: view-specific actions passed as children.
 * Right side: device toggle + refresh-preview + open-the-real-page.
 */
interface EditorToolbarProps {
    children?: ReactNode;
    /** Storefront path of the previewed page (opened in a new tab). */
    siteUrl: string;
    onRefresh: () => void;
    device: PreviewDevice;
    onDeviceChange: (d: PreviewDevice) => void;
}

const DEVICE_ICONS: Record<PreviewDevice, ReactNode> = {
    desktop: (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    ),
    tablet: (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" />
        </svg>
    ),
    mobile: (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" />
        </svg>
    ),
};

export const TOOLBAR_BUTTON_STYLE: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "20px",
    color: "#e2e8f0",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
};

export const TOOLBAR_BUTTON_PRIMARY_STYLE: CSSProperties = {
    ...TOOLBAR_BUTTON_STYLE,
    background: "var(--accent-primary)",
    border: "none",
    color: "#000",
    boxShadow: "0 4px 14px rgba(94, 234, 212, 0.35)",
};

export function EditorToolbar({
    children,
    siteUrl,
    onRefresh,
    device,
    onDeviceChange,
}: EditorToolbarProps) {
    return (
        <div
            style={{
                height: "56px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "0 16px",
                background: "#0f1216",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                overflowX: "auto",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                {children}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Device width toggle — constrains the preview iframe wrapper. */}
                <div
                    style={{
                        display: "flex",
                        gap: "2px",
                        padding: "3px",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "16px",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                    }}
                >
                    {(["desktop", "tablet", "mobile"] as PreviewDevice[]).map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => onDeviceChange(d)}
                            title={
                                d === "desktop"
                                    ? "Десктоп"
                                    : d === "tablet"
                                      ? "Планшет (768px)"
                                      : "Телефон (390px)"
                            }
                            aria-label={d}
                            aria-pressed={device === d}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "30px",
                                height: "26px",
                                border: "none",
                                borderRadius: "13px",
                                cursor: "pointer",
                                background: device === d ? "var(--accent-primary)" : "transparent",
                                color: device === d ? "#000" : "#94a3b8",
                                transition: "all 0.15s",
                            }}
                        >
                            {DEVICE_ICONS[d]}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    title="Оновити превʼю"
                    aria-label="Оновити превʼю"
                    style={TOOLBAR_BUTTON_STYLE}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Оновити
                </button>
                <a
                    href={siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...TOOLBAR_BUTTON_STYLE, textDecoration: "none" }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Відкрити сайт
                </a>
            </div>
        </div>
    );
}
