import { useRef } from "react";
import { useSubmit } from "react-router";

export interface SearchInputProps {
    name?: string;
    placeholder?: string;
    /** Current value from the loader state (uncontrolled — keeps the caret stable while typing). */
    defaultValue?: string;
    debounceMs?: number;
}

/**
 * Debounced, auto-submitting search box. Submits its enclosing GET <Form> ~300ms
 * after the user stops typing (replace:true so each keystroke doesn't spam
 * history). Because the form omits a `page` field, submitting resets to page 1.
 */
export function SearchInput({
    name = "q",
    placeholder = "Пошук…",
    defaultValue = "",
    debounceMs = 300,
}: SearchInputProps) {
    const submit = useSubmit();
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    return (
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "360px" }}>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="16"
                height="16"
                style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                }}
            >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
                type="search"
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(e) => {
                    const form = e.currentTarget.form;
                    if (!form) return;
                    clearTimeout(timer.current);
                    timer.current = setTimeout(
                        () => submit(form, { method: "get", replace: true }),
                        debounceMs,
                    );
                }}
                style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    color: "var(--text-main)",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                }}
            />
        </div>
    );
}
