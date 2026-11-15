/**
 * Dynamic SEO & GEO (Generative Engine Optimization) Generator for MIND BODY.
 * Produces rich contextual alt text, semantic meta descriptions, and OpenGraph descriptors.
 */

export interface ProductSeoContext {
    title: string;
    category?: string | null;
    color?: string | null;
    fabric?: string | null;
    index?: number;
    totalImages?: number;
    view?: "front" | "back" | "detail" | "lifestyle" | string;
    locale?: string;
}

/**
 * Infer primary fabric type from title or description if not explicitly passed.
 */
export function inferFabric(title?: string, description?: string): string {
    const text = `${title || ""} ${description || ""}`.toLowerCase();
    if (text.includes("льон") || text.includes("лляний") || text.includes("linen")) {
        return "натуральний льон";
    }
    if (text.includes("бавовн") || text.includes("cotton")) {
        return "органічна бавовна";
    }
    if (text.includes("муслін") || text.includes("muslin")) {
        return "дихаючий муслін";
    }
    if (
        text.includes("комбінезон") ||
        text.includes("легінс") ||
        text.includes("топ") ||
        text.includes("рашгард")
    ) {
        return "еластичний біфлекс Supplex 280 г/м²";
    }
    return "преміальний тактильний трикотаж";
}

/**
 * Infer angle/perspective based on image index.
 */
function inferPerspective(index: number, total: number, locale = "uk"): string {
    const isEn = locale === "en";
    if (index === 0) return isEn ? "front view" : "вигляд спереду";
    if (index === 1 && total > 2)
        return isEn ? "back view with signature cut" : "вигляд ззаду з фірмовим переплетінням";
    if (index === total - 1 && total > 3)
        return isEn ? "lifestyle / in movement" : "у русі / динаміці";
    return isEn ? `detail angle #${index + 1}` : `деталь крою #${index + 1}`;
}

/**
 * Generate rich, contextual alt text for product gallery images.
 */
export function generateProductAltText(ctx: ProductSeoContext): string {
    const { title, category, color, fabric, index = 0, totalImages = 1, locale = "uk" } = ctx;
    const cleanTitle = title.trim();
    const cleanColor = color ? color.trim() : "";
    const effectiveFabric = fabric || inferFabric(cleanTitle);
    const perspective = inferPerspective(index, totalImages, locale);

    if (locale === "en") {
        const parts = [
            cleanTitle,
            cleanColor ? `in ${cleanColor}` : "",
            category ? `for ${category.toLowerCase()}` : "activewear",
            effectiveFabric ? `(${effectiveFabric})` : "",
            `— ${perspective}`,
            "| MIND BODY Ukraine",
        ].filter(Boolean);
        return parts.join(" ");
    }

    // Default Ukrainian (Quiet Luxury semantic styling)
    const parts = [
        cleanTitle,
        cleanColor ? `у кольорі ${cleanColor}` : "",
        category ? `для ${category.toLowerCase()}` : "для спорту та йоги",
        effectiveFabric ? `(${effectiveFabric})` : "",
        `— ${perspective}`,
        "| MIND BODY",
    ].filter(Boolean);

    return parts.join(" ");
}

/**
 * Generate an engaging, high-CTR meta description for Google & AI search engines.
 */
export function generateProductMetaDescription(opts: {
    title: string;
    price?: number;
    category?: string | null;
    description?: string | null;
    colors?: string[];
}): string {
    const { title, price, category, description, colors = [] } = opts;
    const fabric = inferFabric(title, description || "");
    const priceText = price ? `Від ${price.toLocaleString("uk-UA")} ₴.` : "";
    const colorText = colors.length > 0 ? `Кольори: ${colors.slice(0, 3).join(", ")}.` : "";

    const desc = `Купити ${title} від українського бренду MIND BODY. Тканина: ${fabric}, анатомічний крій, плоскі шви. ${priceText} ${colorText} Доставка по Україні Новою Поштою.`;
    return desc.slice(0, 160).trim();
}
