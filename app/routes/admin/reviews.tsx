import { useLoaderData, useSubmit, Form, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { prisma } from "../../db.server";
import { isAuthenticated } from "../../utils/admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
    if (!await isAuthenticated(request)) {
        return new Response("Unauthorized", { status: 401 });
    }
    const reviews = await prisma.review.findMany({
        orderBy: { createdAt: "desc" }
    });
    
    // Map product IDs to names
    const productIds = Array.from(new Set(reviews.map((r: any) => r.productId)));
    let productMap: Record<string, string> = {};
    if (productIds.length > 0) {
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true }
        });
        products.forEach((p: any) => { productMap[p.id] = p.name; });
    }

    return { reviews, productMap };
}

export async function action({ request }: ActionFunctionArgs) {
    if (!await isAuthenticated(request)) {
        return new Response("Unauthorized", { status: 401 });
    }
    const formData = await request.formData();
    const action = formData.get("action");
    const id = formData.get("id") as string;

    if (action === "approve") {
        await prisma.review.update({ where: { id }, data: { isApproved: true } });
    } else if (action === "reject") {
        await prisma.review.update({ where: { id }, data: { isApproved: false } });
    } else if (action === "delete") {
        await prisma.review.delete({ where: { id } });
    }
    return new Response("OK");
}

export default function AdminReviews() {
    const { reviews, productMap } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const nav = useNavigation();
    
    return (
        <div style={{ padding: "20px" }}>
            <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>Модерація відгуків</h1>
            <div style={{ display: "grid", gap: "16px" }}>
                {reviews.map((r: any) => (
                    <div key={r.id} style={{ 
                        border: "1px solid #eee", padding: "16px", borderRadius: "8px",
                        background: r.isApproved ? "white" : "#fff8e1"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <strong>{r.authorName}</strong>
                            <span style={{ color: "#f59e0b" }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                        </div>
                        <p style={{ margin: "4px 0", color: "#666", fontSize: "14px" }}>
                            Товар: {productMap[r.productId] || r.productId}
                        </p>
                        <p style={{ margin: "8px 0" }}>{r.text}</p>
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                            <Form method="post">
                                <input type="hidden" name="id" value={r.id} />
                                {!r.isApproved ? (
                                    <button 
                                        type="submit" name="action" value="approve"
                                        style={{ padding: "6px 12px", background: "#10b981", color: "white", borderRadius: "4px", border: "none", cursor: "pointer" }}
                                    >
                                        Одобрити
                                    </button>
                                ) : (
                                    <button 
                                        type="submit" name="action" value="reject"
                                        style={{ padding: "6px 12px", background: "#f59e0b", color: "white", borderRadius: "4px", border: "none", cursor: "pointer" }}
                                    >
                                        Сховати
                                    </button>
                                )}
                                <button 
                                    type="submit" name="action" value="delete"
                                    style={{ padding: "6px 12px", background: "#ef4444", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", marginLeft: "8px" }}
                                    onClick={(e) => !confirm("Видалити відгук?") && e.preventDefault()}
                                >
                                    Видалити
                                </button>
                            </Form>
                        </div>
                    </div>
                ))}
            </div>
            {reviews.length === 0 && <p>Відгуків ще немає.</p>}
        </div>
    );
}
