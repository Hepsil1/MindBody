import { Form, useActionData, redirect, useNavigation } from "react-router";
import {
    adminSession,
    ADMIN_USERNAME,
    verifyAdminPassword,
    newSessionToken,
} from "../../utils/admin.server";
import type { ActionFunctionArgs } from "react-router";

// In-memory brute-force protection (resets on cold start, but protects within instance lifetime)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
// Global, IP-AGNOSTIC cap. The per-IP bucket above keys on the spoofable
// X-Forwarded-For, so an attacker rotating XFF per request gets a fresh 5-try
// bucket each time. This counter locks ALL logins once total failures cross the
// threshold inside the window — rotation can't evade it. Plus a hard Map cap so
// the per-IP map can't grow unbounded from rotated/forged IPs.
const GLOBAL_MAX_FAILS = 30;
const GLOBAL_WINDOW_MS = 5 * 60 * 1000;
const MAX_MAP_SIZE = 5000;
let globalFails = 0;
let globalWindowStart = 0;
let globalLockUntil = 0;

function noteGlobalFail() {
    const now = Date.now();
    if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
        globalWindowStart = now;
        globalFails = 0;
    }
    globalFails++;
    if (globalFails >= GLOBAL_MAX_FAILS) globalLockUntil = now + GLOBAL_WINDOW_MS;
}
function sweepAttempts() {
    if (loginAttempts.size < MAX_MAP_SIZE) return;
    const now = Date.now();
    for (const [k, v] of loginAttempts) {
        if (now - v.lastAttempt > LOCKOUT_MS) loginAttempts.delete(k);
    }
}

export async function action({ request }: ActionFunctionArgs) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    // Global lock (IP-agnostic) — catches the XFF-rotation bypass of the per-IP
    // bucket below. Defense-in-depth on the single shared admin credential.
    if (Date.now() < globalLockUntil) {
        return { error: "Забагато спроб. Спробуйте пізніше." };
    }
    sweepAttempts();

    // Check brute-force lockout
    const attempts = loginAttempts.get(ip);
    if (attempts && attempts.count >= MAX_ATTEMPTS) {
        const elapsed = Date.now() - attempts.lastAttempt;
        if (elapsed < LOCKOUT_MS) {
            const minutesLeft = Math.ceil((LOCKOUT_MS - elapsed) / 60000);
            return { error: `Забагато спроб. Спробуйте через ${minutesLeft} хв.` };
        }
        // Lockout expired — reset
        loginAttempts.delete(ip);
    }

    const formData = await request.formData();
    const username = formData.get("username");
    const password = formData.get("password");

    if (username === ADMIN_USERNAME && (await verifyAdminPassword(String(password ?? "")))) {
        // Success — clear attempts
        loginAttempts.delete(ip);
        return redirect("/admin", {
            headers: {
                "Set-Cookie": await adminSession.serialize(newSessionToken()),
            },
        });
    }

    // Failed attempt — track it
    const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    current.count++;
    current.lastAttempt = Date.now();
    loginAttempts.set(ip, current);
    noteGlobalFail();

    const remaining = MAX_ATTEMPTS - current.count;
    if (remaining <= 0) {
        return { error: "Забагато спроб. Спробуйте через 15 хв." };
    }

    return { error: `Невірний логін або пароль (залишилось спроб: ${remaining})` };
}

export default function AdminLogin() {
    const actionData = useActionData<{ error?: string }>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                position: "relative",
                overflow: "hidden",
                fontFamily: '"DM Sans", sans-serif',
            }}
        >
            {/* Background decorative elements */}
            <div
                style={{
                    position: "absolute",
                    top: "-20%",
                    right: "-10%",
                    width: "600px",
                    height: "600px",
                    background:
                        "radial-gradient(circle, rgba(61, 171, 163, 0.15) 0%, transparent 70%)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: "-30%",
                    left: "-15%",
                    width: "800px",
                    height: "800px",
                    background:
                        "radial-gradient(circle, rgba(61, 171, 163, 0.1) 0%, transparent 70%)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                }}
            />

            {/* Floating brand elements */}
            <div
                style={{
                    position: "absolute",
                    top: "10%",
                    left: "8%",
                    fontSize: "120px",
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 300,
                    color: "rgba(255,255,255,0.03)",
                    letterSpacing: "0.1em",
                    userSelect: "none",
                    transform: "rotate(-15deg)",
                }}
            >
                MIND
            </div>
            <div
                style={{
                    position: "absolute",
                    bottom: "15%",
                    right: "5%",
                    fontSize: "100px",
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 300,
                    color: "rgba(255,255,255,0.03)",
                    letterSpacing: "0.1em",
                    userSelect: "none",
                    transform: "rotate(10deg)",
                }}
            >
                BODY
            </div>

            {/* Login Card */}
            <div
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    padding: "48px 40px",
                    background: "rgba(30, 41, 59, 0.8)",
                    backdropFilter: "blur(20px)",
                    borderRadius: "24px",
                    boxShadow:
                        "0 25px 80px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                    position: "relative",
                    zIndex: 10,
                }}
            >
                {/* Logo */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        marginBottom: "40px",
                    }}
                >
                    <div
                        style={{
                            width: "72px",
                            height: "72px",
                            background: "linear-gradient(135deg, #3daba3 0%, #2d8a84 100%)",
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "20px",
                            boxShadow: "0 12px 40px -10px rgba(61, 171, 163, 0.5)",
                            position: "relative",
                        }}
                    >
                        <span
                            style={{
                                color: "#0f172a",
                                fontSize: "32px",
                                fontWeight: 700,
                                fontFamily: '"DM Sans", sans-serif',
                            }}
                        >
                            M
                        </span>
                        <div
                            style={{
                                position: "absolute",
                                inset: "-2px",
                                borderRadius: "22px",
                                background:
                                    "linear-gradient(135deg, rgba(255,255,255,0.2), transparent)",
                                pointerEvents: "none",
                            }}
                        />
                    </div>

                    <h1
                        style={{
                            fontSize: "28px",
                            fontWeight: 600,
                            color: "#fff",
                            marginBottom: "8px",
                            letterSpacing: "0.02em",
                        }}
                    >
                        MIND BODY
                    </h1>
                    <p
                        style={{
                            color: "#94a3b8",
                            fontSize: "14px",
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                        }}
                    >
                        Admin Panel
                    </p>
                </div>

                <Form
                    method="post"
                    style={{ display: "flex", flexDirection: "column", gap: "24px" }}
                >
                    <div>
                        <label
                            style={{
                                display: "block",
                                marginBottom: "10px",
                                fontSize: "13px",
                                color: "#94a3b8",
                                fontWeight: 500,
                                letterSpacing: "0.05em",
                                textTransform: "uppercase",
                            }}
                        >
                            Логін
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type="text"
                                name="username"
                                placeholder="Admin"
                                autoFocus
                                autoComplete="username"
                                style={{
                                    width: "100%",
                                    padding: "16px 20px",
                                    paddingLeft: "48px",
                                    background: "rgba(15, 23, 42, 0.6)",
                                    border: "1px solid rgba(148, 163, 184, 0.2)",
                                    borderRadius: "14px",
                                    color: "#fff",
                                    fontSize: "16px",
                                    outline: "none",
                                    transition: "all 0.2s ease",
                                    boxSizing: "border-box",
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = "#3daba3";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(61, 171, 163, 0.15)";
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = "rgba(148, 163, 184, 0.2)";
                                    e.target.style.boxShadow = "none";
                                }}
                            />
                            <svg
                                style={{
                                    position: "absolute",
                                    left: "16px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "20px",
                                    height: "20px",
                                    color: "#64748b",
                                }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                    </div>

                    <div>
                        <label
                            style={{
                                display: "block",
                                marginBottom: "10px",
                                fontSize: "13px",
                                color: "#94a3b8",
                                fontWeight: 500,
                                letterSpacing: "0.05em",
                                textTransform: "uppercase",
                            }}
                        >
                            Пароль доступу
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type="password"
                                name="password"
                                placeholder="••••••••••"
                                autoComplete="current-password"
                                style={{
                                    width: "100%",
                                    padding: "16px 20px",
                                    paddingLeft: "48px",
                                    background: "rgba(15, 23, 42, 0.6)",
                                    border: "1px solid rgba(148, 163, 184, 0.2)",
                                    borderRadius: "14px",
                                    color: "#fff",
                                    fontSize: "16px",
                                    outline: "none",
                                    transition: "all 0.2s ease",
                                    boxSizing: "border-box",
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = "#3daba3";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(61, 171, 163, 0.15)";
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = "rgba(148, 163, 184, 0.2)";
                                    e.target.style.boxShadow = "none";
                                }}
                            />
                            <svg
                                style={{
                                    position: "absolute",
                                    left: "16px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: "20px",
                                    height: "20px",
                                    color: "#64748b",
                                }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                        </div>
                    </div>

                    {actionData?.error && (
                        <div
                            style={{
                                padding: "14px 16px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "12px",
                                color: "#fca5a5",
                                fontSize: "14px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                            }}
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {actionData.error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: "100%",
                            padding: "16px",
                            background: isSubmitting
                                ? "rgba(61, 171, 163, 0.5)"
                                : "linear-gradient(135deg, #3daba3 0%, #2d8a84 100%)",
                            color: "#0f172a",
                            border: "none",
                            borderRadius: "14px",
                            fontSize: "16px",
                            fontWeight: 600,
                            cursor: isSubmitting ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease",
                            boxShadow: isSubmitting
                                ? "none"
                                : "0 8px 30px -10px rgba(61, 171, 163, 0.5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <svg
                                    style={{
                                        animation: "spin 1s linear infinite",
                                        width: "20px",
                                        height: "20px",
                                    }}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                                </svg>
                                Вхід...
                            </>
                        ) : (
                            <>
                                Увійти в панель
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </>
                        )}
                    </button>
                </Form>

                <div
                    style={{
                        marginTop: "32px",
                        paddingTop: "24px",
                        borderTop: "1px solid rgba(148, 163, 184, 0.1)",
                        textAlign: "center",
                        color: "#64748b",
                        fontSize: "13px",
                    }}
                >
                    Доступ лише для адміністраторів
                </div>
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
