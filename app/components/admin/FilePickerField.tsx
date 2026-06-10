import { useEffect, useRef, useState, type ChangeEventHandler } from "react";

interface FilePickerFieldProps {
    /** Form field name — for uncontrolled multipart forms (slide create). */
    name?: string;
    /** Button label. */
    label?: string;
    accept?: string;
    required?: boolean;
    /** Controlled mode — AboutSlidesModal keeps the File in component state. */
    onFileChange?: (file: File | null) => void;
}

/**
 * Styled replacement for raw `<input type="file">` (which rendered the
 * browser's own English "Choose File / No file chosen" chrome inside the dark
 * Ukrainian admin). The real input stays in the DOM (visually hidden, NOT
 * display:none) so multipart form posts and native `required` validation keep
 * working; the visible UI is a dark button + chosen filename + an object-URL
 * thumbnail preview of the picked image.
 */
export function FilePickerField({
    name,
    label = "Обрати файл",
    accept = "image/*",
    required,
    onFileChange,
}: FilePickerFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const onFileChangeRef = useRef(onFileChange);
    useEffect(() => {
        onFileChangeRef.current = onFileChange;
    });

    // Release the last object URL on unmount.
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The slide-create form is reset programmatically after a successful save —
    // clear the visible filename/thumbnail along with the hidden input.
    useEffect(() => {
        const form = inputRef.current?.form;
        if (!form) return;
        const onReset = () => {
            setFileName(null);
            setPreviewUrl((old) => {
                if (old) URL.revokeObjectURL(old);
                return null;
            });
            onFileChangeRef.current?.(null);
        };
        form.addEventListener("reset", onReset);
        return () => form.removeEventListener("reset", onReset);
    }, []);

    const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        const file = e.target.files?.[0] || null;
        setFileName(file ? file.name : null);
        setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return file ? URL.createObjectURL(file) : null;
        });
        onFileChange?.(file);
    };

    return (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Visually hidden, not display:none — keeps form submission and
                the native `required` bubble functional. */}
            <input
                ref={inputRef}
                type="file"
                name={name}
                accept={accept}
                required={required}
                onChange={handleChange}
                tabIndex={-1}
                style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    width: "1px",
                    height: "1px",
                    opacity: 0,
                    pointerEvents: "none",
                }}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {label}
            </button>
            {previewUrl && (
                <img
                    src={previewUrl}
                    alt=""
                    style={{
                        width: "40px",
                        height: "40px",
                        objectFit: "cover",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        flexShrink: 0,
                    }}
                />
            )}
            <span
                style={{
                    fontSize: "12px",
                    color: fileName ? "#e2e8f0" : "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                }}
            >
                {fileName ?? "Файл не обрано"}
            </span>
        </div>
    );
}
