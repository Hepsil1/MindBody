// Standard result shape for every admin action.
//
// Why: the admin routes historically returned three different shapes —
// `{ success: true }` / `{ error }` plain objects, bare `new Response("OK")`,
// and raw `redirect()` — so the client never had one reliable thing to read,
// and toast/error feedback was impossible to wire consistently. This module
// is the single contract: actions return an `ActionResult`, the client reads
// `data.ok` and (optionally) `data.toast`.
//
// Adoption is incremental: a route opts in by returning `actionOk`/`actionError`
// (or wrapping its body in `runAction`). Routes that redirect on success use the
// flash cookie instead (see flash.server.ts) — there is no `actionData` to read
// after a redirect.

import { Prisma } from "@prisma/client";

export type ToastType = "success" | "error" | "info";

export interface ToastPayload {
    type: ToastType;
    message: string;
}

/** Per-field validation errors, keyed by form field name. */
export type FieldErrors = Record<string, string>;

export interface ActionError {
    ok: false;
    error: string;
    fieldErrors?: FieldErrors;
    toast?: ToastPayload;
}

export type ActionSuccess<T extends Record<string, unknown>> = {
    ok: true;
    toast?: ToastPayload;
} & T;

export type ActionResult<T extends Record<string, unknown> = Record<string, never>> =
    | ActionSuccess<T>
    | ActionError;

/** Success result, optionally carrying extra data and a toast to fire client-side. */
export function actionOk<T extends Record<string, unknown> = Record<string, never>>(
    data?: T,
    toast?: ToastPayload,
): ActionSuccess<T> {
    return {
        ok: true,
        ...(data ?? ({} as T)),
        ...(toast ? { toast } : {}),
    } as ActionSuccess<T>;
}

/**
 * Failure result. By default it also produces an error toast carrying the same
 * message, so callers get user feedback for free. Pass `toast: false` to suppress
 * it (e.g. when the error is shown inline next to a field), or `toast: "info"` to
 * downgrade the tone.
 */
export function actionError(
    error: string,
    opts?: { fieldErrors?: FieldErrors; toast?: false | ToastType },
): ActionError {
    let toast: ToastPayload | undefined;
    if (opts?.toast !== false) {
        const type: ToastType = typeof opts?.toast === "string" ? opts.toast : "error";
        toast = { type, message: error };
    }
    return {
        ok: false,
        error,
        ...(opts?.fieldErrors ? { fieldErrors: opts.fieldErrors } : {}),
        toast,
    };
}

/**
 * Wrap an action body so unexpected throws become a clean `ActionError` instead
 * of a 500 with a leaked stack trace. Known Prisma errors are mapped to friendly
 * messages (unique-constraint → "already exists"). `label` is logged for triage.
 */
export async function runAction<T extends Record<string, unknown> = Record<string, never>>(
    label: string,
    fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
    try {
        return await fn();
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === "P2002") return actionError("Запис із таким значенням уже існує");
            if (e.code === "P2025") return actionError("Запис не знайдено");
        }
        console.error(`[action:${label}]`, e);
        return actionError("Сталася серверна помилка");
    }
}
