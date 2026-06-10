import type { ReactNode } from "react";
import { useEditorMode, postToEditor, type EditorBridgeMessage } from "../utils/editor-bridge";

interface EditorAffordanceProps {
    /** Button label, e.g. "Редагувати слайди". */
    label: string;
    /** Bridge message sent to the parent editor on click. */
    message: EditorBridgeMessage;
    children: ReactNode;
}

/**
 * Wraps an editable storefront section with a click-to-edit affordance that
 * exists ONLY inside the visual editor's preview iframe (useEditorMode).
 * For real visitors (and SSR) it renders children unchanged — zero markup,
 * zero layout impact. Inside the editor it overlays a dashed outline + a
 * centered white pill button that posts the section's bridge message to the
 * parent editor, which opens the matching panel.
 */
export function EditorAffordance({ label, message, children }: EditorAffordanceProps) {
    const editorMode = useEditorMode();
    if (!editorMode) return <>{children}</>;

    return (
        <div style={{ position: "relative" }}>
            {children}
            {/* Dashed frame marking the editable region (clicks pass through). */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 6,
                    zIndex: 95,
                    pointerEvents: "none",
                    border: "2px dashed rgba(94, 234, 212, 0.7)",
                    borderRadius: 12,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 96,
                }}
            >
                <button
                    type="button"
                    data-editor-affordance
                    onClick={(e) => {
                        e.preventDefault();
                        postToEditor(message);
                    }}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "white",
                        color: "black",
                        padding: "12px 24px",
                        borderRadius: "30px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        fontSize: "13px",
                        letterSpacing: "1px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                        transition: "transform 0.2s",
                        cursor: "pointer",
                        border: "none",
                    }}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {label}
                </button>
            </div>
        </div>
    );
}
