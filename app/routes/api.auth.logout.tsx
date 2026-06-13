import type { ActionFunctionArgs } from "react-router";
import { getSession, destroySession } from "../utils/userSession.server";

// Clears the server session cookie. Called by AuthUtils.logout() so the signed
// session can't outlive the client's "logged out" state (the cookie is otherwise
// a session cookie that survives until the browser closes).
export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request.headers.get("Cookie"));
    return new Response(JSON.stringify({ success: true }), {
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie": await destroySession(session),
        },
    });
}
