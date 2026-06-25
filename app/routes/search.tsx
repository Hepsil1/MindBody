import { useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { prisma } from "../db.server";
import { useState, useEffect } from "react";
import ProductCard, { type Product } from "../components/ProductCard";
import { useI18n, LLink, plural, getT } from "../i18n";
import { localeFromParam, localeFromParamSafe, OG_LOCALE } from "../i18n/config";
import { localizeEntities } from "../utils/translations.server";
import { DEFAULT_SITE_URL as SITE_URL } from "../utils/site-url";
import { trackSearch } from "../utils/analytics.client";
import { expandSearchTerms } from "../utils/search-synonyms";

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
    const locale = localeFromParamSafe(params.lang);
    const t = getT(locale);
    const q = data?.q || "";
    const count = data?.products?.length || 0;
    const title = q ? t("Пошук: {q} | MIND BODY", { q }) : t("Пошук | MIND BODY");
    const desc = q
        ? t("Знайдено {count} товарів за запитом «{q}» в MIND BODY.", { count, q })
        : t("Знайди товари MIND BODY за назвою, категорією або кольором.");
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
        { property: "og:locale", content: OG_LOCALE[locale] },
        { property: "og:type", content: "website" },
        // Search-result pages shouldn't be indexed individually
        { name: "robots", content: "noindex, follow" },
    ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
    const locale = localeFromParam(params.lang);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (q.length < 2) {
        return { q, products: [] as Product[], fallback: [] as Product[] };
    }

    try {
        // F-014 — synonym-expand the query so "легінси" finds "Лосини",
        // "комплект" finds "костюм", etc. See utils/search-synonyms.ts.
        const terms = expandSearchTerms(q);
        const products = await prisma.product.findMany({
            where: {
                status: "active",
                OR: terms.flatMap((t) => [
                    { name: { contains: t, mode: "insensitive" as const } },
                    { description: { contains: t, mode: "insensitive" as const } },
                    { category: { contains: t, mode: "insensitive" as const } },
                ]),
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
                colors: true,
                colorImages: true,
                shopPageSlug: true,
                inventory: true,
                status: true,
                createdAt: true,
            },
        });

        // en/ru: show translated names (matching itself runs on the uk text —
        // the synonym expansion maps en/ru queries onto uk terms).
        const localized = await localizeEntities("Product", products, locale, [
            "name",
            "description",
        ]);

        const NOW = Date.now();
        const NEW_THRESHOLD = 14 * 24 * 60 * 60 * 1000;

        const mapped: Product[] = localized.map((p) => {
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
            let cols: string[] = [];
            try {
                cols = JSON.parse(p.colors || "[]");
            } catch {
                // Malformed colors JSON — no swatches.
            }
            let colorImages: Record<string, string[]> = {};
            try {
                colorImages = JSON.parse(p.colorImages || "{}");
            } catch {
                // Malformed colorImages JSON — swatches won't preview.
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
                colors: cols,
                colorImages,
                is_new: NOW - createdAt < NEW_THRESHOLD,
                is_sale: isSale,
                sale_price: isSale ? price : undefined,
                discount_percent: isSale ? Math.round((1 - price / comparePrice) * 100) : 0,
                is_stock: inStock,
            };
        });

        // F-014 — empty results stay a dead-end without something to do
        // next. Load 6 popular fallbacks (newest in-stock products) so
        // the buyer leaves the page with a place to click instead of
        // bouncing. Single extra query, only when needed.
        let fallback: Product[] = [];
        if (mapped.length === 0) {
            const top = await prisma.product.findMany({
                where: { status: "active" },
                orderBy: { createdAt: "desc" },
                take: 6,
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    price: true,
                    comparePrice: true,
                    category: true,
                    images: true,
                    inventory: true,
                    createdAt: true,
                },
            });
            const localizedTop = await localizeEntities("Product", top, locale, ["name"]);
            fallback = localizedTop.map((p) => {
                let imgs: string[] = [];
                try {
                    imgs = JSON.parse(p.images || "[]");
                } catch {}
                let inv: Record<string, number> = {};
                try {
                    inv = JSON.parse(p.inventory || "{}");
                } catch {}
                const invValues = Object.values(inv);
                const inStock = invValues.length === 0 || invValues.some((v) => Number(v) > 0);
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
                    is_stock: inStock,
                };
            });
        }

        return { q, products: mapped, fallback };
    } catch (e) {
        console.error("Search loader error", e);
        return { q, products: [] as Product[], fallback: [] as Product[] };
    }
}

export default function Search() {
    const { q: initialQ, products, fallback } = useLoaderData<typeof loader>();
    const { t, locale } = useI18n();
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

    // F-002 — log the query the visitor actually ran (post-loader, so
    // empty/<2-char inputs don't pollute the report). The helper bails
    // server-side, so this is a no-op during SSR.
    useEffect(() => {
        if (hasQuery) trackSearch(initialQ);
    }, [initialQ, hasQuery]);

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
                        aria-label={t("Хлібні крихти")}
                        style={{ marginBottom: "20px" }}
                    >
                        <LLink to="/">{t("Головна")}</LLink>
                        <span aria-hidden="true"> / </span>
                        <span>{t("Пошук")}</span>
                    </nav>
                    <h1>{t("Знайди свій рух")}</h1>

                    <form
                        onSubmit={submit}
                        role="search"
                        aria-label={t("Пошук товарів")}
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
                            {t("Що шукаєш?")}
                        </label>
                        <input
                            id="search-input"
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("Лосини, топ, костюм…")}
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
                            {t("Шукати")}
                        </button>
                    </form>

                    {hasQuery && (
                        <p style={{ marginTop: "20px", color: "var(--color-text-secondary)" }}>
                            {products.length > 0
                                ? t("Знайдено {n} {unit} за запитом «{query}»", {
                                      n: products.length,
                                      unit: plural(
                                          locale,
                                          products.length,
                                          "товар",
                                          "товари",
                                          "товарів",
                                      ),
                                      query: initialQ,
                                  })
                                : t("Нічого не знайдено за запитом «{query}»", {
                                      query: initialQ,
                                  })}
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
                                {t("Введи 2 або більше символів — і ми знайдемо.")}
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
                                        {t(tag)}
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
                            <h2 style={{ marginBottom: "12px" }}>{t("Спробуй інше")}</h2>
                            <p
                                style={{
                                    color: "var(--color-text-secondary)",
                                    marginBottom: "32px",
                                    maxWidth: "480px",
                                    margin: "0 auto 32px",
                                }}
                            >
                                {t(
                                    "Можливо, варто перевірити написання або скоротити запит. Або перегляньте наші колекції:",
                                )}
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "12px",
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <LLink to="/shop/yoga" className="btn btn--primary">
                                    Yoga
                                </LLink>
                                <LLink to="/shop/sport" className="btn btn--primary">
                                    Sport
                                </LLink>
                                <LLink to="/shop/casual" className="btn btn--primary">
                                    Casual
                                </LLink>
                                <LLink to="/shop/kids" className="btn btn--primary">
                                    Kids
                                </LLink>
                            </div>

                            {/* F-014 — keep the visitor on-site: even when
                                their query didn't match, show six recent
                                products. The loader already populated
                                `fallback` only for the no-results branch
                                so there's no extra cost on the happy path. */}
                            {fallback.length > 0 && (
                                <div style={{ marginTop: "64px" }}>
                                    <h3
                                        style={{
                                            marginBottom: "24px",
                                            fontFamily:
                                                "var(--font-display, 'Cormorant Garamond', serif)",
                                        }}
                                    >
                                        {t("Можливо, вам сподобається")}
                                    </h3>
                                    <div className="luxe-product-grid">
                                        {fallback.map((p) => (
                                            <div key={p.id} className="luxe-card-wrapper">
                                                <ProductCard product={p} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
