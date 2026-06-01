import { AnimatePresence, motion } from "framer-motion";

export interface BulkActionBarProps {
    count: number;
    /** Route-specific action buttons (each typically submits a fetcher with the
     *  selected ids). */
    children: React.ReactNode;
    onClear: () => void;
}

/** Sticky bar that appears when rows are selected, hosting bulk actions. */
export function BulkActionBar({ count, children, onClear }: BulkActionBarProps) {
    return (
        <AnimatePresence>
            {count > 0 && (
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
                        margin: "20px 0 0",
                        padding: "12px 18px",
                        background: "rgba(22,27,34,0.96)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid rgba(94,234,212,0.25)",
                        borderRadius: "14px",
                        boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6)",
                    }}
                >
                    <span style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 600 }}>
                        Обрано: {count}
                    </span>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        {children}
                        <button
                            type="button"
                            onClick={onClear}
                            style={{
                                padding: "8px 14px",
                                borderRadius: "9px",
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "transparent",
                                color: "#e2e8f0",
                                fontSize: "13px",
                                fontWeight: 500,
                                cursor: "pointer",
                            }}
                        >
                            Скасувати
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
