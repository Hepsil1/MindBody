import { useEffect, useRef } from "react";

/** Structural shape of the `toast` an action attaches to its result. Kept local
 *  (not imported from the .server module) so this stays a pure client import. */
export type ToastInput = { type: "success" | "error" | "info"; message: string };

/**
 * Fire a sonner toast whenever an action result carries one. Pass the route's
 * `useActionData()` or a fetcher's `data`. Deduped by reference so a re-render
 * (or revalidation) doesn't replay the same toast.
 *
 * sonner is imported lazily at call time rather than statically: the static
 * import resolved to a sonner module instance whose store the mounted <Toaster>
 * wasn't observing, so toasts never appeared. The lazy import resolves to the
 * same live instance the Toaster uses.
 */
export function useActionToast(data: { toast?: ToastInput } | undefined | null): void {
    const seen = useRef<unknown>(null);
    useEffect(() => {
        if (!data || !data.toast || data === seen.current) return;
        seen.current = data;
        const payload = data.toast;
        void import("sonner").then(({ toast }) => {
            if (payload.type === "error") toast.error(payload.message);
            else if (payload.type === "info") toast.info(payload.message);
            else toast.success(payload.message);
        });
    }, [data]);
}
