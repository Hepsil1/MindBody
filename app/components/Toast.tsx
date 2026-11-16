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

    const showToast = useCallback(
        (text: ReactNode, type: ToastMessage["type"] = "success", image?: string) => {
            const id = ++toastId;
            setToasts((prev) => [...prev, { id, text, type, image }]);
            /* Sprint 1 D2.4 — #13 PDP-002 duration 3500 → 5500ms.
               Mobile users need time to decide continue shopping vs go
               to cart. Error toasts get extra time below. */
            const duration = type === "error" || type === "warning" ? 6000 : 5500;
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        },
        [],
    );

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Quiet brand toast (styles in app.css "Toast"): dark ink panel,
                status shown by a thin left rule, no emoji or glyph icons. */}
            <div className="toast-container" role="status" aria-live="polite" aria-atomic="false">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`toast-item toast-item--${toast.type}`}
                        onClick={() => dismiss(toast.id)}
                    >
                        {toast.image && (
                            <span className="toast-item__thumb">
                                <img src={toast.image} alt="" />
                            </span>
                        )}
                        <span className="toast-item__text">{toast.text}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
