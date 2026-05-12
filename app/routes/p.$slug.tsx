import { redirect, type LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server";

// SEO-friendly slug route — looks up the product by slug and renders the
// existing product detail by id-based URL. Implemented as a permanent
// canonical redirect so Google consolidates link equity to /p/<slug>.
//
// (If we ever move the PDP code from /product/$id to here, swap the
// redirect for a direct render. For now this keeps backwards compat with
// every existing link to /product/<id>.)
export async function loader({ params }: LoaderFunctionArgs) {
    const slug = params.slug?.trim().toLowerCase();
    if (!slug) throw new Response("Not Found", { status: 404 });

    const product = await prisma.product.findUnique({
        where: { slug },
        select: { id: true, status: true },
    });

    if (!product || product.status !== "active") {
        throw new Response("Not Found", { status: 404 });
    }

    return redirect(`/product/${product.id}`, { status: 301 });
}
