import { type LoaderFunctionArgs, type MetaFunction, redirect } from "react-router";
import { isValidSubcategory, slugToLabel } from "../utils/categoryMap";
import ShopCategory, { loader as parentLoader } from "./shop.$category";

/**
 * /shop/:category/:subcategory — nested route giving each subcategory its
 * own canonical, title, BreadcrumbList (3 levels) and CollectionPage
 * JSON-LD. Reuses the parent route's UI; only the loader (filtering) and
 * meta differ.
 *
 * Invalid combinations (e.g. /shop/yoga/pole-sets — pole-sets exists only
 * for dance) 301-redirect to /shop/:category. The whitelist lives in
 * app/utils/categoryMap.ts → CATEGORY_BY_SHOP_PAGE.
 */
export async function loader(args: LoaderFunctionArgs) {
    const { category, subcategory } = args.params;
    if (!category || !subcategory) {
        throw redirect("/shop", 301);
    }
    if (!isValidSubcategory(category, subcategory)) {
        // Unknown sub for this shop: send the user (and search bots) back to
        // the parent listing. 301 preserves any existing link equity.
        throw redirect(`/shop/${category}`, 301);
    }

    const parent = await parentLoader(args);
    // Narrow the product list to just this subcategory so SSR HTML matches
    // what the user came for — keeps Google from seeing duplicate content
    // between /shop/yoga and /shop/yoga/longsleeve.
    const products = parent.products.filter((p) => p.category === subcategory);

    return { ...parent, products, subcategory };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const shopPage = data?.shopPage;
    const subcategory = data?.subcategory ?? "";
    const category = data?.category ?? "";
    const siteUrl = data?.siteUrl || "https://saleid.icu";
    const products = data?.products ?? [];

    const shopLabel = shopPage?.title || category.toUpperCase();
    const subLabel = slugToLabel(subcategory);
    const title = `${subLabel} — ${shopLabel} | MIND BODY`;
    const description = `${subLabel} у колекції ${shopLabel} MIND BODY. Спортивний одяг українського виробництва.`;
    const canonicalUrl = `${siteUrl}/shop/${category}/${subcategory}`;
    const heroImage = shopPage?.heroImage || "/brand-sun.png";
    const ogImage = heroImage.startsWith("http") ? heroImage : `${siteUrl}${heroImage}`;

    const listItems = products.slice(0, 10).map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${siteUrl}/product/${p.id}`,
        name: p.name,
    }));

    return [
        { title },
        { name: "description", content: description },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: ogImage },
        { property: "og:locale", content: "uk_UA" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:image", content: ogImage },
        // 3-level breadcrumb — Home → SHOP_CATEGORY → SUBCATEGORY.
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Головна", item: siteUrl },
                    {
                        "@type": "ListItem",
                        position: 2,
                        name: shopLabel,
                        item: `${siteUrl}/shop/${category}`,
                    },
                    { "@type": "ListItem", position: 3, name: subLabel, item: canonicalUrl },
                ],
            },
        },
        // CollectionPage JSON-LD scoped to this subcategory — numberOfItems
        // and ItemList only count the filtered products, not the entire shop.
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: `${subLabel} — ${shopLabel}`,
                url: canonicalUrl,
                description,
                isPartOf: { "@type": "WebSite", url: siteUrl, name: "MIND BODY" },
                inLanguage: "uk-UA",
                mainEntity: {
                    "@type": "ItemList",
                    numberOfItems: products.length,
                    itemListElement: listItems,
                },
            },
        },
    ];
};

export function headers() {
    return {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    };
}

// Reuse the entire listing UI from the parent route — sidebar, filters,
// product grid. The parent component reads useParams() and pre-selects the
// subcategory filter when present (see shop.$category.tsx initial state).
export default ShopCategory;
