// Resource route — POST only, secret-guarded. Lets us trigger/verify a scrape
// on demand (it honors the same lock + 5-min floor as the scheduler). Never an
// open trigger; never leaks the sessionid.
import type { ActionFunctionArgs } from "react-router";
import { runRefresh } from "../services/instagram-refresh.server";
import { getSessionState } from "../services/instagram.server";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return Response.json({ ok: false, error: "method" }, { status: 405 });
    }
    const token = request.headers.get("x-ig-refresh-token");
    const expected = process.env.IG_REFRESH_TOKEN;
    if (!expected || token !== expected) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const result = await runRefresh();
    return Response.json({ ...result, ...getSessionState() });
}
