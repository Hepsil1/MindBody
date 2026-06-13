import { redirect } from "react-router";
import { randomBytes } from "node:crypto";
import {
    googleConfigured,
    buildGoogleAuthUrl,
    googleStateCookie,
} from "../utils/googleAuth.server";

// Start of the Google OAuth flow. Generates a state nonce (stored in a signed
// one-time cookie for CSRF), then redirects the browser to Google's consent
// screen. The /auth page's "Увійти через Google" button links here.
export async function loader() {
    if (!googleConfigured()) {
        return redirect("/auth?error=google_unavailable");
    }

    const state = randomBytes(16).toString("hex");
    return redirect(buildGoogleAuthUrl(state), {
        headers: { "Set-Cookie": await googleStateCookie.serialize(state) },
    });
}
