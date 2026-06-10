interface AboutViewProps {
    /** Remount key suffix — bumped after a successful save to reload the preview. */
    previewNonce: number;
    onEditSlides: () => void;
}

/**
 * "Про бренд" editor view — the real /about page in a fullscreen iframe with
 * a centered edit button. Extracted 1:1 from app/routes/admin/slides.tsx (SE1).
 */
export function AboutView({ previewNonce, onEditSlides }: AboutViewProps) {
    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {/* Edit About Slides Button Overlay */}
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 10,
                    pointerEvents: "auto",
                }}
            >
                <button
                    onClick={onEditSlides}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        background: "var(--accent-primary)",
                        border: "none",
                        borderRadius: "24px",
                        color: "#000",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 8px 32px rgba(94, 234, 212, 0.5)",
                        transition: "all 0.2s",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                    >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Редагувати слайди
                </button>
            </div>

            <iframe
                key={`about-${previewNonce}`}
                src="/about"
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Перегляд сторінки «Про бренд»"
                sandbox="allow-scripts allow-same-origin"
            />
        </div>
    );
}
