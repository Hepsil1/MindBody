// Per-request context (request-ID for log correlation) using
// AsyncLocalStorage.
//
// Why: when 100 RPS hit prod simultaneously and one of them errors,
// `mindbody-error.log` has stack traces from many parallel requests
// interleaved. Without a request-ID we can't tell which log lines belong
// to the failing request. With one, every log emitted during a request's
// lifecycle carries the same `requestId` field — grep the log, find the
// chain, done.
//
// Architecture:
//   server.js (the entrypoint PM2 runs) owns the AsyncLocalStorage
//   instance and stores it on `globalThis.__requestALS`. The Express
//   middleware in server.js wraps every request in `als.run({...}, next)`
//   so any code in the bundled build/server/index.js that calls
//   `getRequestId()` sees the right ID for the current request.
//
//   We use globalThis to share the instance because server.js (plain JS at
//   project root) and this file (bundled into build/server/index.js)
//   would otherwise have separate copies.

import type { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
    requestId: string;
}

declare global {
    var __requestALS: AsyncLocalStorage<RequestContext> | undefined;
}

/**
 * Returns the request-ID for the current async context, or null when
 * called outside any request (e.g. during server startup).
 */
export function getRequestId(): string | null {
    return globalThis.__requestALS?.getStore()?.requestId ?? null;
}
