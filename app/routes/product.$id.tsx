import { redirect, type LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

// The canonical public product URL is now /p/<slug> (see p.$slug.tsx, which owns
// the PDP). This legacy /product/<id> route stays ONLY for backward-compat — old
// links, bookmarks, anything still pointing at the UUID. It 301-redirects an
// active product to its slug URL and 404s otherwise. No component: the loader
// always redirects or throws.
export async function loader({ params }: LoaderFunctionArgs) {
    const id = params.id;
    if (!id) throw new Response("Not Found", { status: 404 });

    const product = await prisma.product.findUnique({
        where: { id },
        select: { slug: true, status: true },
    });

    // draft / archived / missing → 404, no redirect (mirrors p.$slug + sitemap).
    if (!product || product.status !== "active") {
        throw new Response("Not Found", { status: 404 });
    }
    // Active but with no slug — don't mint a broken /p/ URL. Log and 404; slugs
    // are auto-generated on save, so this only happens for un-migrated rows.
    if (!product.slug) {
        console.error("[product.$id] active product has no slug:", id);
        throw new Response("Not Found", { status: 404 });
    }
    return redirect(`/p/${product.slug}`, { status: 301 });
}
