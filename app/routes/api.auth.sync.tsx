import type { ActionFunctionArgs } from "react-router";
import { getSession, commitSession, destroySession } from "../utils/userSession.server";

// Sync local-storage auth with a session cookie for basic IDOR protection
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") return new Response("Not allowed", { status: 405 });
    
    try {
        const body = await request.json();
        const session = await getSession(request.headers.get("Cookie"));
        
        if (body.action === 'login' && body.email) {
            session.set("email", body.email.toLowerCase());
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Set-Cookie": await commitSession(session) }
            });
        } else if (body.action === 'logout') {
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Set-Cookie": await destroySession(session) }
            });
        }
        
        return new Response("OK");
    } catch(e) {
        return new Response("Error syncing", { status: 500 });
    }
}
