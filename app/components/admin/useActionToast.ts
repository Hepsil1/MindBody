import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Structural shape of the `toast` an action attaches to its result. Kept local
 *  (not imported from the .server module) so this stays a pure client import. */
export type ToastInput = { type: "success" | "error" | "info"; message: string };

/**
 * Fire a sonner toast whenever an action result carries one. Pass the route's
 * `useActionData()` or a fetcher's `data`. Deduped by reference so a re-render
 * (or revalidation) doesn't replay the same toast.
 */
export function useActionToast(data: { toast?: ToastInput } | undefined | null): void {
    const seen = useRef<unknown>(null);
    useEffect(() => {
        if (!data || !data.toast || data === seen.current) return;
        seen.current = data;
        const { type, message } = data.toast;
        if (type === "error") toast.error(message);
        else if (type === "info") toast.info(message);
        else toast.success(message);
    }, [data]);
}
