import { useCallback, useMemo, useState } from "react";

/**
 * Ephemeral row-selection state for bulk actions. This is the ONE piece of list
 * UI state that is intentionally NOT URL-derived — selections shouldn't be
 * bookmarkable. Clear it on navigation from the consumer (e.g. when the page
 * param changes) so stale ids don't linger.
 */
export function useRowSelection<T extends { id: string }>(rows: T[]) {
    const [selected, setSelected] = useState<Set<string>>(() => new Set());

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleAll = useCallback(() => {
        setSelected((prev) => {
            if (rows.length > 0 && rows.every((r) => prev.has(r.id))) return new Set();
            return new Set(rows.map((r) => r.id));
        });
    }, [rows]);

    const clear = useCallback(() => setSelected(new Set()), []);
    const selectedIds = useMemo(() => Array.from(selected), [selected]);

    return { selected, toggle, toggleAll, clear, allSelected, someSelected, selectedIds };
}
