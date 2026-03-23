import { createCookieSessionStorage } from "react-router";

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
    cookie: {
        name: "user_state",
        secrets: [process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET env var is required'); })()],
        sameSite: "lax",
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    },
});
