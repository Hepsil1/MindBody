import { useMemo } from "react";

/**
 * True when `current` differs from the captured `initial` snapshot. Uses stable
 * JSON comparison — fine for flat form-state objects whose key order is fixed
 * (the admin edit forms hold their fields in a single useState object).
 */
export function useDirty<T>(current: T, initial: T): boolean {
    return useMemo(() => JSON.stringify(current) !== JSON.stringify(initial), [current, initial]);
}
