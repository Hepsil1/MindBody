// One-shot "flash" toast that survives a redirect.
//
// Why: actions that redirect on success (e.g. delete → back to the list) have
// no `actionData` for the client to read, so useActionToast can't fire. We stash
// the toast in a short-lived signed cookie on the redirect; the destination
// route's loader reads and clears it, and the layout fires it once.

import { createCookie } from "react-router";
import type { ToastPayload } from "./action-result.server";

const flashCookie = createCookie("admin_flash", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30,
    secrets: [process.env.SESSION_SECRET || "default_dev_secret_replace_me_in_prod"],
});

/** Serialize a toast to a Set-Cookie value; attach it to the redirect's headers. */
export async function setFlash(toast: ToastPayload): Promise<string> {
    return flashCookie.serialize(toast);
}

/**
 * Read and clear the flash toast. Returns the toast plus a Headers carrying the
 * clearing Set-Cookie — merge those headers into the loader response so the
 * toast fires exactly once.
 */
export async function getFlash(
    request: Request,
): Promise<{ toast: ToastPayload | null; headers: Headers }> {
    const value = (await flashCookie.parse(request.headers.get("Cookie"))) as ToastPayload | null;
    const headers = new Headers();
    if (value) headers.append("Set-Cookie", await flashCookie.serialize("", { maxAge: 0 }));
    return { toast: value ?? null, headers };
}
