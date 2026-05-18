import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import { sendEmail, renderNewsletterWelcome } from "../utils/email.server";
import { env } from "../utils/env.server";
import { logger } from "../utils/logger.server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Naive in-memory rate-limit (per process). Acceptable until we wire a real limiter.
const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function rateLimited(ip: string) {
    const now = Date.now();
    const bucket = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (bucket.length >= RATE_MAX) return true;
    bucket.push(now);
    rateBuckets.set(ip, bucket);
    return false;
}

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    if (rateLimited(ip)) {
        return Response.json(
            { success: false, error: "Забагато спроб, спробуйте через хвилину" },
            { status: 429 },
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    // Defensive narrowing — body is `unknown` until we read fields.
    const bodyObj = (typeof body === "object" && body !== null ? body : {}) as {
        email?: unknown;
        source?: unknown;
    };
    const rawEmail = String(bodyObj.email ?? "")
        .trim()
        .toLowerCase();
    const source = String(bodyObj.source ?? "footer").slice(0, 32);

    if (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 200) {
        return Response.json({ success: false, error: "Введіть коректний email" }, { status: 400 });
    }

    try {
        // Idempotent upsert — re-subscribing flips the unsubscribed flag back.
        const sub = await prisma.newsletterSubscriber.upsert({
            where: { email: rawEmail },
            create: { email: rawEmail, source, consent: true },
            update: { unsubscribed: false, consent: true },
        });

        // Fire-and-forget welcome email. Don't block the response on email delivery.
        const unsubscribeUrl = `${env.SITE_URL}/api/newsletter?unsub=${sub.unsubKey}`;
        sendEmail({
            to: rawEmail,
            subject: "Ласкаво просимо у MIND BODY",
            html: renderNewsletterWelcome({ email: rawEmail, unsubKey: sub.unsubKey }),
            unsubscribeUrl,
            tags: [{ name: "type", value: "newsletter-welcome" }],
        }).catch((e) =>
            logger.error({ err: e, email: rawEmail }, "[newsletter] welcome email failed"),
        );

        return Response.json({ success: true });
    } catch (e) {
        logger.error({ err: e }, "[newsletter] subscribe failed");
        return Response.json(
            { success: false, error: "Сталась помилка, спробуйте пізніше" },
            { status: 500 },
        );
    }
}

// GET — for unsubscribe link in emails
export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const key = url.searchParams.get("unsub");
    if (!key) {
        return Response.json({ success: false, error: "Missing unsub key" }, { status: 400 });
    }
    try {
        const sub = await prisma.newsletterSubscriber.findUnique({ where: { unsubKey: key } });
        if (!sub) return Response.json({ success: false, error: "Not found" }, { status: 404 });
        await prisma.newsletterSubscriber.update({
            where: { unsubKey: key },
            data: { unsubscribed: true },
        });
        return Response.json({ success: true, email: sub.email });
    } catch {
        return Response.json({ success: false, error: "Error" }, { status: 500 });
    }
}
