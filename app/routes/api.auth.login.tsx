import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger.server";
import { LoginSchema, formatZodErrors } from "../utils/validation";
import { checkRateLimit } from "../utils/rateLimit.server";
import { rejectCrossOrigin } from "../utils/csrf.server";
import { getSession, commitSession } from "../utils/userSession.server";

// Pre-computed bcrypt hash of a throwaway string. We run bcrypt.compare against
// it on the unknown-email / no-password paths so an attacker can't distinguish
// "email exists" from "email doesn't" by response timing — skipping the real
// compare (~tens of ms) would otherwise be a measurable side-channel.
const DUMMY_HASH = bcrypt.hashSync("mindbody-dummy-password-for-timing", 10);

const GENERIC_AUTH_ERROR = "Невірний email або пароль";

/**
 * Login API — authenticates a customer and issues an HttpOnly session cookie.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Not allowed", { status: 405 });
    }

    // CSRF + brute-force / enumeration protection.
    const csrf = rejectCrossOrigin(request);
    if (csrf) return csrf;
    const rateLimited = checkRateLimit(request, "login", 5, 60_000);
    if (rateLimited) return rateLimited;

    try {
        const raw = await request.json();
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: formatZodErrors(parsed.error) }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }
        const { email, password } = parsed.data;

        // Find customer by email (Zod already lowercased the email).
        const customer = await prisma.customer.findUnique({ where: { email } });

        // Always run exactly one bcrypt.compare (against a dummy hash when the
        // account is missing or has no password) so timing can't reveal which
        // emails exist, and return ONE generic message in every failure case so
        // the response body can't either. This de-enumerates the customer base.
        const hash = customer?.passwordHash ?? DUMMY_HASH;
        const valid = await bcrypt.compare(password, hash);

        if (!customer || !customer.passwordHash || !valid) {
            return new Response(JSON.stringify({ error: GENERIC_AUTH_ERROR }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Success — issue the server session cookie (the source of truth for
        // server-side ownership checks, e.g. /api/orders/list) AND return the
        // safe customer object the client persists for UI state.
        const session = await getSession(request.headers.get("Cookie"));
        session.set("email", customer.email.toLowerCase().trim());
        session.set("customerId", customer.id);

        // NEVER send the bcrypt hash (or any secret column) to the client —
        // auth.ts persists this object into sessionStorage.
        const { passwordHash: _omitHash, ...safeCustomer } = customer;
        return new Response(JSON.stringify(safeCustomer), {
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": await commitSession(session),
            },
        });
    } catch (e) {
        logger.error({ err: e }, "[auth] login failed");
        return new Response(JSON.stringify({ error: "Помилка сервера" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
