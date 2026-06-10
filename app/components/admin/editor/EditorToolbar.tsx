import type { CSSProperties, ReactNode } from "react";

/**
 * Persistent control strip above the editor's preview iframe. Replaces the
 * old floating overlay buttons (which covered preview content and vanished
 * behind modals). Left side: view-specific actions passed as children.
 * Right side: refresh-preview + open-the-real-page.
 */
interface EditorToolbarProps {
    children?: ReactNode;
    /** Storefront path of the previewed page (opened in a new tab). */
    siteUrl: string;
    onRefresh: () => void;
}

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

export function EditorToolbar({ children, siteUrl, onRefresh }: EditorToolbarProps) {
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
