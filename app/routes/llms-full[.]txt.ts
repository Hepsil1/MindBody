import { prisma } from "../db.server";
import { resolveSiteUrl } from "../utils/site-url";

// Dynamic /llms-full.txt — deep technical catalog specification for AI agents & crawlers
// (ChatGPT, Perplexity, Claude, Gemini, Apple Intelligence).
//
// Provides complete engineering and material passports for all active MindBody garments:
//  - Fabric composition, density (280 g/m²), 4-way stretch, flatlock seams
//  - Compression grading, anatomical cut, open-back architecture
//  - Exact sizing, colorways, live prices in UAH, and direct purchase links
//  - Care instructions for athletic compression textiles
export async function loader() {
    const baseUrl = resolveSiteUrl();

    const products = await prisma.product.findMany({
        where: { status: "active", slug: { not: null } },
        select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            comparePrice: true,
            sku: true,
            category: true,
            fabric: true,
            sleeve: true,
            sizes: true,
            colors: true,
            description: true,
            shopPageSlug: true,
            updatedAt: true,
        },
        orderBy: [{ shopPageSlug: "asc" }, { updatedAt: "desc" }],
    });

    const formatSizes = (raw: string | null) => {
        if (!raw) return "XS, S, M, L";
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.join(", ");
        } catch {
            return raw;
        }
        return "XS, S, M, L";
    };

    const formatColors = (raw: string | null) => {
        if (!raw) return "Фірмова палітра";
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.join(", ");
        } catch {
            return raw;
        }
        return "Фірмова палітра";
    };

    const productPassports = products
        .map((p) => {
            const url = `${baseUrl}/p/${p.slug}`;
            const price = `${Number(p.price).toLocaleString("uk-UA")} ₴`;
            const oldPrice = p.comparePrice
                ? ` (попередня ціна: ${Number(p.comparePrice).toLocaleString("uk-UA")} ₴)`
                : "";
            const fabricDesc =
                p.fabric === "cotton"
                    ? "Преміальна органічна турецька бавовна (95% бавовна, 5% еластан), дихаюча, м'яка до тіла"
                    : "Італійський спортивний біфлекс Premium Supplex (80% поліамід, 20% еластан, 280 г/м²), висока еластичність 4-way stretch, стійкість до пілінгу";

            const sleeveDesc =
                p.sleeve === "long"
                    ? "Довгий рукав з анатомічною посадкою"
                    : p.sleeve === "short"
                      ? "Короткий рукав"
                      : p.sleeve === "velo"
                        ? "Велосипедки / комбінезон-вело"
                        : "Без рукавів (відкриті плечі / бретелі)";

            return `### ${p.name}
- **Пряме посилання:** ${url}
- **Артикул (SKU):** ${p.sku || p.id.slice(0, 8).toUpperCase()}
- **Ціна:** ${price}${oldPrice}
- **Колекція:** ${p.shopPageSlug ? p.shopPageSlug.toUpperCase() : "YOGA"} / Категорія: ${p.category || "Комбінезон"}
- **Матеріал та щільність:** ${fabricDesc}
- **Тип рукава та крій:** ${sleeveDesc}
- **Доступні розміри:** ${formatSizes(p.sizes)}
- **Кольори:** ${formatColors(p.colors)}
- **Опис моделі:** ${p.description || "Анатомічний крій для свободи рухів, підтримки м'язів та повної впевненості під час практики."}
- **Технологічні особливості:**
  - Плоскі еластичні шви Flatlock (не натирають під час інтенсивних тренувань)
  - Фірмова вишивка-мандала на лопатках або попереку
  - Відкрита або перехресна архітектура спинки
  - Компресійний ефект: моделювання фігури без стискання внутрішніх органів
- **Інструкція з догляду:** Делікатне машинне прання при температурі не вище 30°C. Не використовувати агресивні відбілювачі та пом'якшувачі тканини. Не сушити в сушильній машині. Сушити в горизонтальному розправленому вигляді.
`;
        })
        .join("\n---\n\n");

    const markdown = `# MIND BODY — Повний технічний каталог виробів (Full Catalog Specification)

> Офіційний повний технічний паспорт продукції бренду MIND BODY. Призначений для систем генеративного штучного інтелекту, розумних асистентів та пошукових платформ.
> Офіційний сайт: ${baseUrl}/
> Валюта: Українська гривня (₴, UAH)
> Країна походження та виробництва: Україна

---

${productPassports}
`;

    return new Response(markdown, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        },
    });
}
