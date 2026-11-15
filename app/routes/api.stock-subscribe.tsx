import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { createStockSubscription, unsubscribeStock } from "../services/stockSubscription.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { checkRateLimit } from "../utils/rateLimit.server";

const Schema = z.object({
    productId: z.string().min(1).max(64),
    // "" = any size (the shopper subscribed before picking one).
    size: z.string().max(20),
    color: z.string().max(40).optional(),
    email: z.string().trim().max(254).email(),
    locale: z.enum(["uk", "en", "ru"]).optional(),
});

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    // RFC 8058 one-click unsubscribe: mail clients POST to the List-Unsubscribe
    // URL (cross-origin, no JSON body) — handle it before the CSRF/JSON path.
    const unsub = new URL(request.url).searchParams.get("unsub");
    if (unsub) {
        const ok = await unsubscribeStock(unsub);
        return Response.json({ success: ok }, { status: ok ? 200 : 404 });
    }

    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;

    const rateLimit = checkRateLimit(request, "stock-sub", 5, 60_000);
    if (rateLimit) return rateLimit;

    try {
        const body = await request.json();
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
            return Response.json(
                { success: false, error: "Некоректний email або параметри товару" },
                { status: 400 },
            );
        }

        await createStockSubscription(parsed.data);
        return Response.json({ success: true });
    } catch (e) {
        console.error("[api.stock-subscribe] error:", e);
        return Response.json(
            { success: false, error: "Сталася помилка. Спробуйте ще раз." },
            { status: 500 },
        );
    }
}

// GET ?unsub=<token> — one-click unsubscribe link from the back-in-stock email.
export async function loader({ request }: LoaderFunctionArgs) {
    const token = new URL(request.url).searchParams.get("unsub") || "";
    const ok = token ? await unsubscribeStock(token) : false;
    const msg = ok
        ? "Ви відписалися від сповіщень про наявність. / You have been unsubscribed."
        : "Посилання недійсне або вже використане. / This link is invalid or already used.";
    return new Response(
        `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>MIND BODY</title><p style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333">${msg}</p>`,
        { status: ok ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
}
