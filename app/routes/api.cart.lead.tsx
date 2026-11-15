import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { upsertCartLead } from "../services/abandonedCart.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { checkRateLimit } from "../utils/rateLimit.server";

const LeadSchema = z.object({
    // Must be the client's crypto.randomUUID()-based key (see checkout.tsx) —
    // short/guessable keys are rejected so a lead can't be hijacked by guessing.
    sessionKey: z.string().regex(/^cs_[0-9a-f-]{36}$/),
    email: z.string().trim().max(254).email().optional().nullable().or(z.literal("")),
    phone: z
        .string()
        .trim()
        .max(32)
        .regex(/^\+?[\d\s()-]{9,20}$/)
        .optional()
        .nullable()
        .or(z.literal("")),
    name: z.string().trim().max(120).optional().nullable(),
    locale: z.string().optional(),
    subtotal: z.number().min(0).max(10_000_000).optional().default(0),
    items: z
        .array(
            z.object({
                productId: z.union([z.string(), z.number()]),
                name: z.string().optional(),
                size: z.string().optional().nullable(),
                color: z.string().optional().nullable(),
                quantity: z.number().int().min(1).max(99).default(1),
            }),
        )
        .max(50),
});

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;

    const rateLimit = checkRateLimit(request, "cart-lead", 10, 60_000);
    if (rateLimit) return rateLimit;

    try {
        const body = await request.json();
        const parsed = LeadSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ success: true }); // Always 200 to prevent probing
        }

        const data = parsed.data;
        await upsertCartLead({
            sessionKey: data.sessionKey,
            email: data.email,
            phone: data.phone,
            name: data.name,
            locale: data.locale,
            subtotal: data.subtotal,
            items: data.items.map((i) => ({
                productId: String(i.productId),
                name: i.name,
                size: i.size,
                color: i.color,
                quantity: i.quantity,
            })),
        });

        return Response.json({ success: true });
    } catch (e) {
        console.error("[api.cart.lead] error:", e);
        return Response.json({ success: true });
    }
}
