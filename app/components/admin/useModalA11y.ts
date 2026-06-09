import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared modal accessibility, extracted from ConfirmDialog so every admin modal
 * behaves the same: Escape closes, Tab is trapped within `ref`, focus moves into
 * the dialog on open and is restored to the opener on close.
 *
 * `onClose` is read through a ref, so passing an inline closure does NOT re-run
 * the effect (no focus-stealing on every render). Pass `active=false` to suspend
 * the trap — e.g. while a nested ConfirmDialog owns focus.
 */
export function useModalA11y(
    ref: RefObject<HTMLElement | null>,
    onClose: () => void,
    active = true,
): void {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!active) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const SELECTOR =
            'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

        const focusTimer = window.setTimeout(() => {
            const first = ref.current?.querySelector<HTMLElement>(SELECTOR);
            (first ?? ref.current)?.focus?.();
        }, 0);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCloseRef.current();
                return;
            }
            if (e.key === "Tab" && ref.current) {
                const f = ref.current.querySelectorAll<HTMLElement>(SELECTOR);
                if (f.length === 0) return;
                const first = f[0];
                const last = f[f.length - 1];
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
    }, [active, ref]);
}
