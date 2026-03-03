import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { adminSession } from "../../utils/admin.server";

export async function action({ request }: ActionFunctionArgs) {
    return redirect("/admin/login", {
        headers: {
            "Set-Cookie": await adminSession.serialize("", { maxAge: 0 }),
        },
    });
}

export async function loader() {
    return redirect("/admin/login", {
        headers: {
            "Set-Cookie": await adminSession.serialize("", { maxAge: 0 }),
        },
    });
}
