import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ToastMessage {
    id: number;
    text: ReactNode;
    type: "success" | "error" | "info" | "warning";
    image?: string;
}

interface ToastContextType {
    showToast: (text: ReactNode, type?: ToastMessage["type"], image?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be inside ToastProvider");
    return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((text: ReactNode, type: ToastMessage["type"] = "success", image?: string) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, text, type, image }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const icons: Record<ToastMessage["type"], string> = {
        success: "✓",
        error: "✕",
        info: "ℹ",
        warning: "⚠",
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container" style={{
                position: "fixed",
                top: "20px",
                right: "20px",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                pointerEvents: "none",
            }}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`toast-item toast-item--${toast.type}`}
                        style={{
                            pointerEvents: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "14px 20px",
                            borderRadius: "12px",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            background: toast.type === "success"
                                ? "rgba(16, 185, 129, 0.15)"
                                : toast.type === "error"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : toast.type === "warning"
                                        ? "rgba(245, 158, 11, 0.15)"
                                        : "rgba(59, 130, 246, 0.15)",
                            border: `1px solid ${toast.type === "success"
                                ? "rgba(16, 185, 129, 0.3)"
                                : toast.type === "error"
                                    ? "rgba(239, 68, 68, 0.3)"
                                    : toast.type === "warning"
                                        ? "rgba(245, 158, 11, 0.3)"
                                        : "rgba(59, 130, 246, 0.3)"
                                }`,
                            color: "#fff",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                            animation: "toast-slide-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1)",
                            minWidth: "280px",
                            maxWidth: "420px",
                            cursor: "pointer",
                        }}
                        onClick={() => dismiss(toast.id)}
                    >
                        <span style={{
                            width: toast.image ? "40px" : "28px",
                            height: toast.image ? "50px" : "28px",
                            borderRadius: toast.image ? "6px" : "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            flexShrink: 0,
                            overflow: "hidden",
                            background: toast.image ? "#1e293b" : (
                                toast.type === "success"
                                ? "rgba(16, 185, 129, 0.3)"
                                : toast.type === "error"
                                    ? "rgba(239, 68, 68, 0.3)"
                                    : toast.type === "warning"
                                        ? "rgba(245, 158, 11, 0.3)"
                                        : "rgba(59, 130, 246, 0.3)"
                            ),
                        }}>
                            {toast.image ? (
                                <img src={toast.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : icons[toast.type]}
                        </span>
                        <span style={{ flex: 1, lineHeight: "1.4" }}>{toast.text}</span>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes toast-slide-in {
                    from {
                        transform: translateX(120%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
}
