import { Link, useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { prisma } from "../db.server";
import { useState } from "react";
import ProductCard, { type Product } from "../components/ProductCard";
import { pluralizeUA } from "../utils/plural";
import { DEFAULT_SITE_URL as SITE_URL } from "../utils/site-url";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const q = data?.q || "";
    const count = data?.products?.length || 0;
    const title = q ? `Пошук: ${q} | MIND BODY` : "Пошук | MIND BODY";
    const desc = q
        ? `Знайдено ${count} товарів за запитом «${q}» в MIND BODY.`
        : "Знайди товари MIND BODY за назвою, категорією або кольором.";
    return [
        { title },
        { name: "description", content: desc },
        {
            tagName: "link",
            rel: "canonical",
            href: `${SITE_URL}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        // Search-result pages shouldn't be indexed individually
        { name: "robots", content: "noindex, follow" },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (q.length < 2) {
        return { q, products: [] as Product[] };
    }

    try {
        const term = q.replace(/[%_]/g, "");
        const products = await prisma.product.findMany({
            where: {
                status: "active",
                OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { description: { contains: term, mode: "insensitive" } },
                    { category: { contains: term, mode: "insensitive" } },
                ],
            },
            orderBy: { createdAt: "desc" },
            take: 60,
            select: {
                id: true,
                slug: true,
                name: true,
                price: true,
                comparePrice: true,
                category: true,
                images: true,
                shopPageSlug: true,
                inventory: true,
                status: true,
                createdAt: true,
            },
        });

        const NOW = Date.now();
        const NEW_THRESHOLD = 14 * 24 * 60 * 60 * 1000;

        const mapped: Product[] = products.map((p) => {
            let imgs: string[] = [];
            try {
                imgs = JSON.parse(p.images || "[]");
            } catch {
                // Malformed images JSON — fall back to placeholder.
            }
            let inv: Record<string, number> = {};
            try {
                inv = JSON.parse(p.inventory || "{}");
            } catch {
                // Malformed inventory JSON — treat as no stock info, fall back to status check.
            }
            const invValues = Object.values(inv);
            const inStock =
                p.status === "active" &&
                (invValues.length === 0 || invValues.some((v) => Number(v) > 0));
            const price = Number(p.price);
            const comparePrice = Number(p.comparePrice) || 0;
            const isSale = comparePrice > price && price > 0;
            const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;

            return {
                id: p.id,
                slug: p.slug ?? undefined,
                name: p.name,
                category: p.category ?? undefined,
                price: isSale ? comparePrice : price,
                image: imgs[0] || "/brand-sun.png",
                image2: imgs[1] || null,
                is_new: NOW - createdAt < NEW_THRESHOLD,
                is_sale: isSale,
                sale_price: isSale ? price : undefined,
                discount_percent: isSale ? Math.round((1 - price / comparePrice) * 100) : 0,
                inStock,
            };
        });

        return { q, products: mapped };
    } catch (e) {
        console.error("Search loader error", e);
        return { q, products: [] as Product[] };
    }
}

export default function Search() {
    const { q: initialQ, products } = useLoaderData<typeof loader>();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState(initialQ || "");

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        const next = new URLSearchParams(params);
        next.set("q", trimmed);
        setParams(next, { replace: false });
    };

    const hasQuery = initialQ.length >= 2;
    const noResults = hasQuery && products.length === 0;

    return (
        <main className="search-page">
            <section
                className="page-hero"
                style={{
                    background:
                        "linear-gradient(135deg, var(--color-bg-cream) 0%, var(--color-bg-soft) 100%)",
                    padding: "120px 0 60px",
                    textAlign: "center",
                }}
            >
                <div className="container" style={{ maxWidth: "720px" }}>
                    <nav
                        className="breadcrumb"
                        aria-label="Хлібні крихти"
                        style={{ marginBottom: "20px" }}
                    >
                        <Link to="/">Головна</Link>
                        <span aria-hidden="true"> / </span>
                        <span>Пошук</span>
                    </nav>
                    <h1>Знайди свій рух</h1>

                    <form
                        onSubmit={submit}
                        role="search"
                        aria-label="Пошук товарів"
                        style={{
                            marginTop: "32px",
                            display: "flex",
                            background: "#fff",
                            border: "1px solid var(--color-border)",
                            borderRadius: "999px",
                            padding: "6px",
                            boxShadow: "0 6px 30px rgba(20, 40, 40, 0.06)",
                        }}
                    >
                        <label htmlFor="search-input" className="visually-hidden">
                            Що шукаєш?
                        </label>
                        <input
                            id="search-input"
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Лосини, топ, костюм…"
                            autoComplete="off"
                            autoFocus
                            style={{
                                flex: 1,
                                border: "none",
                                background: "transparent",
                                padding: "14px 20px",
                                fontSize: "16px",
                                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                            }}
                        />
                        <button
                            type="submit"
                            className="btn btn--primary"
                            style={{ padding: "12px 28px", borderRadius: "999px" }}
                            disabled={query.trim().length < 2}
                        >
                            Шукати
                        </button>
                    </form>

                    {hasQuery && (
                        <p style={{ marginTop: "20px", color: "var(--color-text-secondary)" }}>
                            {products.length > 0
                                ? `Знайдено ${products.length} ${pluralizeUA(products.length, "товар", "товари", "товарів")} за запитом «${initialQ}»`
                                : `Нічого не знайдено за запитом «${initialQ}»`}
                        </p>
                    )}
                </div>
            </section>

            <section
                className="section"
                style={{ background: "#fff", paddingTop: "40px", paddingBottom: "80px" }}
            >
                <div className="container">
                    {!hasQuery && (
                        <div
                            style={{
                                textAlign: "center",
                                padding: "40px 20px",
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            <p style={{ marginBottom: "24px", fontSize: "16px" }}>
                                Введи 2 або більше символів — і ми знайдемо.
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "10px",
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                {["Лосини", "Топ", "Костюм", "Шорти", "Худі"].map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => {
                                            setQuery(tag);
                                            const next = new URLSearchParams(params);
                                            next.set("q", tag);
                                            setParams(next, { replace: false });
                                        }}
                                        style={{
                                            padding: "8px 16px",
                                            border: "1px solid var(--color-border)",
                                            background: "var(--color-bg-cream)",
                                            borderRadius: "999px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                                        }}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {hasQuery && products.length > 0 && (
                        <div className="luxe-product-grid">
                            {products.map((p) => (
                                <div key={p.id} className="luxe-card-wrapper">
                                    <ProductCard product={p} />
                                </div>
                            ))}
                        </div>
                    )}

                    {noResults && (
                        <div style={{ textAlign: "center", padding: "48px 20px" }}>
                            <h2 style={{ marginBottom: "12px" }}>Спробуй інше</h2>
                            <p
                                style={{
                                    color: "var(--color-text-secondary)",
                                    marginBottom: "32px",
                                    maxWidth: "480px",
                                    margin: "0 auto 32px",
                                }}
                            >
                                Можливо, варто перевірити написання або скоротити запит. Або
                                перегляньте наші колекції:
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "12px",
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <Link to="/shop/yoga" className="btn btn--primary">
                                    Yoga
                                </Link>
                                <Link to="/shop/sport" className="btn btn--primary">
                                    Sport
                                </Link>
                                <Link to="/shop/casual" className="btn btn--primary">
                                    Casual
                                </Link>
                                <Link to="/shop/kids" className="btn btn--primary">
                                    Kids
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
