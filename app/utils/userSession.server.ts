import { createCookieSessionStorage } from "react-router";

// secure: only true when SITE_URL uses https (prevents broken sessions if HTTPS isn't set up yet)
export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
    cookie: {
        name: "user_state",
        secrets: [process.env.SESSION_SECRET || "default_dev_secret_replace_me_in_prod"],
        sameSite: "lax",
        path: "/",
        httpOnly: true,
        secure: (process.env.SITE_URL || "").startsWith("https://"),
    },
});
