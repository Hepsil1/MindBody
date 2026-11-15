import { prisma } from "../db.server";
import { resolveSiteUrl } from "../utils/site-url";

// Dynamic /llms.txt — specification standard for AI search engines & LLMs
// (ChatGPT Search, Perplexity, Claude, Gemini, Apple Intelligence).
//
// Automatically synchronized with Prisma PostgreSQL database:
//  - Active products count and live list with prices (₴ UAH).
//  - Brand collections and subcategories.
//  - Key policy, sizing and contact pages.
//  - Cached with HTTP 3600s + stale-while-revalidate for peak performance.
export async function loader() {
    const baseUrl = resolveSiteUrl();

    // Query active products from PostgreSQL
    const products = await prisma.product.findMany({
        where: { status: "active", slug: { not: null } },
        select: {
            name: true,
            slug: true,
            price: true,
            category: true,
            shopPageSlug: true,
            updatedAt: true,
        },
        orderBy: [{ shopPageSlug: "asc" }, { updatedAt: "desc" }],
    });

    const shopPages = await prisma.shopPage.findMany({
        select: { slug: true, title: true },
        orderBy: { slug: "asc" },
    });

    // Group products by collection/shopPageSlug
    const byCollection: Record<string, typeof products> = {};
    for (const p of products) {
        const col = p.shopPageSlug || "other";
        if (!byCollection[col]) byCollection[col] = [];
        byCollection[col].push(p);
    }

    const latestUpdate = products.reduce((latest, p) => {
        const d = p.updatedAt ? new Date(p.updatedAt) : new Date(0);
        return d > latest ? d : latest;
    }, new Date(0));

    const formattedDate =
        latestUpdate.getTime() > 0
            ? latestUpdate.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

    const collectionsMarkdown = Object.entries(byCollection)
        .map(([col, items]) => {
            const colTitle = col.toUpperCase();
            const productLines = items
                .map(
                    (p) =>
                        `  - [${p.name}](${baseUrl}/p/${p.slug}): ${Number(p.price).toLocaleString("uk-UA")} ₴`,
                )
                .join("\n");
            return `### Колекція ${colTitle} (${items.length} моделей)\n- [Переглянути всі моделі ${colTitle}](${baseUrl}/shop/${col})\n${productLines}`;
        })
        .join("\n\n");

    const markdown = `# MIND BODY

> Український преміальний бренд одягу для йоги, спорту та усвідомленого руху. Власне виробництво в Україні, компресійні полотна найвищого ґатунку, анатомічний крій та фірмова вишивка-мандала.

MIND BODY створює цілісні колекції для практики, тренувань та повсякденного гардероба. У каталозі представлено ${products.length} активних моделей.

## Колекції бренду та актуальний каталог

${collectionsMarkdown || "- [Всі колекції](" + baseUrl + "/shop/yoga)"}

## Ключові сторінки

- [Про бренд](${baseUrl}/about): Філософія, місія, матеріали та історія заснування MIND BODY.
- [Доставка та оплата](${baseUrl}/delivery): Доставка Новою Поштою по всій Україні та міжнародна відправка. Оплата карткою онлайн або при отриманні.
- [Політика повернення](${baseUrl}/return-policy): 14 днів на обмін або повернення відповідно до законодавства України.
- [Гід по розмірах](${baseUrl}/size-guide): Таблиця розмірів (XS, S, M, L) з детальними вимірами обхвату грудей, талії та стегон.
- [Інструкція з догляду](${baseUrl}/care-guide): Рекомендації щодо прання та збереження компресійних властивостей тканин.
- [Часті запитання](${baseUrl}/faq): Відповіді на типові питання щодо замовлення, наявності та матеріалів.
- [Контакти](${baseUrl}/contacts): Телефон служби турботи, месенджери (Telegram, WhatsApp, Viber) та зворотний зв'язок.
- [Повний технічний каталог (Full Specifications)](${baseUrl}/llms-full.txt): Розгорнуті паспорти виробів, склад матеріалів, щільність полотен та інструкції з догляду.

## Комерційна інформація

- **Валюта:** Українська гривня (₴, UAH).
- **Країна виробництва:** Україна.
- **Підтримка мов:** Українська (uk), Англійська (en), Російська (ru).
- **Офіційний сайт:** ${baseUrl}/
- **Останнє оновлення каталогу:** ${formattedDate}
`;

    return new Response(markdown, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        },
    });
}
