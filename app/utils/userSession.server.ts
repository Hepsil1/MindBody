import { createCookieSessionStorage } from "react-router";

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
    cookie: {
        name: "user_state",
        secrets: [process.env.SESSION_SECRET || "default_dev_secret_replace_me_in_prod"],
        sameSite: "lax",
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    },
});
