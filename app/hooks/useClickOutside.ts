import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Calls `handler` when a mousedown happens outside every element in
 * `refs`. Useful for closing dropdowns, popovers, and any UI that
 * shouldn't intercept clicks elsewhere on the page.
 *
 * Pass an array so you can group multiple panels — the handler only
 * fires when the click is outside *all* of them (e.g. a label + its
 * dropdown menu rendered as siblings).
 *
 * ```ts
 * const ref = useRef<HTMLDivElement>(null);
 * useClickOutside([ref], () => setOpen(false));
 * ```
 */
export function useClickOutside(
    refs: Array<RefObject<HTMLElement | null>>,
    handler: (event: MouseEvent) => void,
): void {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            // Fire only if the click was outside every ref. This lets a
            // composite UI (input + dropdown rendered separately) treat
            // both halves as "inside".
            const insideAny = refs.some((ref) => ref.current?.contains(target));
            if (!insideAny) handler(event);
        };

        document.addEventListener("mousedown", listener);
        return () => document.removeEventListener("mousedown", listener);
        // Intentionally re-subscribe whenever the handler identity changes
        // so closures over fresh state stay current. refs are stable.
    }, [refs, handler]);
}
