import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Naive in-memory rate-limit (per process). Acceptable until we wire a real limiter.
const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function rateLimited(ip: string) {
    const now = Date.now();
    const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
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
            { status: 429 }
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const rawEmail = String(body?.email || "").trim().toLowerCase();
    const source = String(body?.source || "footer").slice(0, 32);

    if (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 200) {
        return Response.json(
            { success: false, error: "Введіть коректний email" },
            { status: 400 }
        );
    }

    try {
        // Idempotent upsert — re-subscribing flips the unsubscribed flag back.
        await prisma.newsletterSubscriber.upsert({
            where: { email: rawEmail },
            create: { email: rawEmail, source, consent: true },
            update: { unsubscribed: false, consent: true }
        });
        return Response.json({ success: true });
    } catch (e) {
        console.error("Newsletter subscribe failed", e);
        return Response.json(
            { success: false, error: "Сталась помилка, спробуйте пізніше" },
            { status: 500 }
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
            data: { unsubscribed: true }
        });
        return Response.json({ success: true, email: sub.email });
    } catch {
        return Response.json({ success: false, error: "Error" }, { status: 500 });
    }
}
