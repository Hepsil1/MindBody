// Structured server-side logging via pino.
//
// Why: console.error scattered across server files produces unstructured text
// PM2 can't index, search, or alert on. Pino emits JSON in production (one
// log = one parseable record) and pretty-printed text in development.
//
// Usage:
//   import { logger } from "~/utils/logger.server";
//   logger.info({ orderId, customerId }, "order created");
//   logger.error({ err, context: "telegram" }, "notification failed");
//
// Always pass an object as the first argument with structured fields, and a
// string message as the second. This is the inverse of console.error's
// (msg, err) convention but is what makes downstream search work.

import pino from "pino";
import { env } from "./env.server";
import { getRequestId } from "./requestContext.server";

const isDev = env.NODE_ENV === "development";

export const logger = pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    // Inject the current request-ID (from AsyncLocalStorage) into every
    // log record. Lets us grep one request's full lifecycle out of a busy
    // prod log: `grep requestId=<uuid> mindbody-out.log`.
    mixin() {
        const requestId = getRequestId();
        return requestId ? { requestId } : {};
    },
    // Redact common credential paths so an accidentally-logged request body
    // never persists keys to disk.
    redact: {
        paths: [
            "password",
            "passwordHash",
            "*.password",
            "*.passwordHash",
            "headers.authorization",
            "headers.cookie",
            "*.RESEND_API_KEY",
            "*.TELEGRAM_BOT_TOKEN",
            "*.GOOGLE_CLIENT_SECRET",
            "*.SESSION_SECRET",
        ],
        censor: "[REDACTED]",
    },
    // Pretty output only in dev — in production we want raw JSON for ingestion.
    transport: isDev
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "HH:MM:ss.l",
                  ignore: "pid,hostname",
              },
          }
        : undefined,
});
