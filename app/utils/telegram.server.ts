// Server-side Telegram sender — the single place that talks to the Bot API.
//
// Why this exists: every caller (order notifications, contact form, the
// /api/telegram/send route) previously inlined its own `fetch` with no timeout.
// A hanging api.telegram.org (TCP black-hole, not a fast error) would then block
// the awaiting request — most dangerously the order-create response, leaving the
// customer on a spinner for an order that already succeeded. This helper gives
// every send a hard 3s timeout and is best-effort: it never throws, so callers
// can fire-and-forget it without risk to the request lifecycle.

import { env } from "./env.server";
import { logger } from "./logger.server";

const TELEGRAM_API = "https://api.telegram.org";
const SEND_TIMEOUT_MS = 3000;

/**
 * Send a message to the shop's configured Telegram chat. Returns false (never
 * throws) when Telegram isn't configured, the API errors, or the 3s timeout
 * fires. Safe to call without awaiting.
 */
export async function sendTelegramMessage(
    text: string,
    opts: { parseMode?: "Markdown" | "HTML" } = {},
): Promise<boolean> {
    const token = env.TELEGRAM_BOT_TOKEN ?? "";
    const chatId = env.TELEGRAM_CHAT_ID ?? "";
    if (!token || !chatId) return false;

    try {
        const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
            }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (!res.ok) {
            logger.error({ status: res.status }, "[telegram] send returned non-OK");
            return false;
        }
        return true;
    } catch (e) {
        logger.error({ err: e }, "[telegram] send failed");
        return false;
    }
}
