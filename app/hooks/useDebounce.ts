import { useEffect, useState } from "react";

/**
 * Returns `value` after `delayMs` has passed without it changing. Use to
 * trade input recency for server load — e.g. typing in a search box fires
 * one API call per pause instead of one per keystroke.
 *
 * ```ts
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebounce(query, 300);
 * useEffect(() => { search(debouncedQuery); }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}
