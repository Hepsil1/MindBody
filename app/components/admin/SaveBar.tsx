import { AnimatePresence, motion } from "framer-motion";

export interface SaveBarProps {
    dirty: boolean;
    /** From navigation/fetcher state — disables buttons and shows progress. */
    saving?: boolean;
    onReset: () => void;
    /** If provided, the save button is a plain button calling this. Otherwise it
     *  is a submit button for the enclosing <Form>. */
    onSave?: () => void;
    saveLabel?: string;
    message?: string;
}

/**
 * Sticky "unsaved changes" bar for edit forms. Renders nothing until the form is
 * dirty (or actively saving). Slides up from the bottom of the content column.
 */
export function SaveBar({
    dirty,
    saving = false,
    onReset,
    onSave,
    saveLabel = "Зберегти",
    message = "Є незбережені зміни",
}: SaveBarProps) {
    const visible = dirty || saving;
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        position: "sticky",
                        bottom: "16px",
                        zIndex: 60,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px",
                        margin: "24px 0 0",
                        padding: "14px 20px",
                        background: "rgba(22,27,34,0.95)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "14px",
                        boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6)",
                    }}
                >
                    <span style={{ color: "#cbd5e1", fontSize: "14px", fontWeight: 500 }}>
                        {saving ? "Збереження…" : message}
                    </span>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={onReset}
                            disabled={saving}
                            style={{
                                padding: "9px 16px",
                                borderRadius: "9px",
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "transparent",
                                color: "#e2e8f0",
                                fontSize: "13px",
                                fontWeight: 500,
                                cursor: saving ? "default" : "pointer",
                            }}
                        >
                            Скинути
                        </button>
                        <button
                            type={onSave ? "button" : "submit"}
                            onClick={onSave}
                            disabled={saving}
                            style={{
                                padding: "9px 18px",
                                borderRadius: "9px",
                                border: "none",
                                background: "var(--accent-primary, #5eead4)",
                                color: "#0f172a",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: saving ? "default" : "pointer",
                            }}
                        >
                            {saveLabel}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
