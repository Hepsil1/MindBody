import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    body?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "danger" | "default";
    /** Disable buttons + show a busy confirm label while the action runs. */
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Accessible replacement for window.confirm(): focus-trapped, Escape cancels,
 * focus starts on (and returns from) the safe default. Destructive by default
 * (tone="danger"). The confirm handler typically submits a fetcher so the
 * mutation flows through the standard action → toast pipeline.
 */
export function ConfirmDialog({
    open,
    title,
    body,
    confirmLabel = "Видалити",
    cancelLabel = "Скасувати",
    tone = "danger",
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
                return;
            }
            if (e.key === "Tab" && dialogRef.current) {
                const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
                );
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener("keydown", onKey);
            previouslyFocused?.focus?.();
        };
    }, [open, onCancel]);

    const danger = tone === "danger";

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onCancel}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 1000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(2, 6, 12, 0.6)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                        padding: "24px",
                    }}
                >
                    <motion.div
                        ref={dialogRef}
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-dialog-title"
                        initial={{ scale: 0.94, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.96, opacity: 0, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "100%",
                            maxWidth: "420px",
                            background: "#161b22",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "16px",
                            padding: "28px",
                            boxShadow: "0 24px 64px -16px rgba(0,0,0,0.7)",
                        }}
                    >
                        <h2
                            id="confirm-dialog-title"
                            style={{
                                margin: "0 0 10px",
                                fontSize: "19px",
                                fontWeight: 600,
                                color: "#f8fafc",
                            }}
                        >
                            {title}
                        </h2>
                        {body && (
                            <div style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>
                                {body}
                            </div>
                        )}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "12px",
                                marginTop: "24px",
                            }}
                        >
                            <button
                                ref={cancelRef}
                                type="button"
                                onClick={onCancel}
                                disabled={busy}
                                style={{
                                    padding: "10px 18px",
                                    borderRadius: "10px",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "transparent",
                                    color: "#e2e8f0",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    cursor: busy ? "default" : "pointer",
                                }}
                            >
                                {cancelLabel}
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={busy}
                                style={{
                                    padding: "10px 18px",
                                    borderRadius: "10px",
                                    border: "1px solid",
                                    borderColor: danger
                                        ? "rgba(239,68,68,0.4)"
                                        : "rgba(94,234,212,0.4)",
                                    background: danger
                                        ? "rgba(239,68,68,0.15)"
                                        : "rgba(94,234,212,0.15)",
                                    color: danger ? "#fca5a5" : "#5eead4",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: busy ? "default" : "pointer",
                                    minWidth: "96px",
                                }}
                            >
                                {busy ? "…" : confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
