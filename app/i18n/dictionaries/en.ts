/**
 * English dictionary. KEY = exact Ukrainian source string (the uk locale
 * renders keys as-is, so uk never needs a dictionary). Params use {name}
 * placeholders substituted by translate().
 *
 * Keep alphabetical-ish grouping by feature area; long content-page prose
 * lives at the bottom.
 */
export const en: Record<string, string> = {
    // --- root / global ---
    "Перейти до контенту": "Skip to content",
    "Помилка!": "Error!",
    "Виникла неочікувана помилка.": "An unexpected error occurred.",
    Помилка: "Error",
    "Сторінку не знайдено.": "Page not found.",
    "Пошук товарів...": "Search products...",
    "Пошук товарів": "Search products",
    Знайти: "Search",
    "На головну": "Back home",

    // --- language gate / switcher ---
    "Оберіть мову": "Choose your language",
    "Ціни — у гривні": "Prices in hryvnia",
    "Ціни — у доларах США": "Prices in US dollars",
    "Мова сайту": "Site language",

    // --- header ---
    "Про бренд": "About us",
    Контакти: "Contacts",
    Профіль: "Profile",
    Увійти: "Sign in",
    Обране: "Wishlist",
    Улюблені: "Wishlist",
    Кошик: "Cart",
    Пошук: "Search",
    "Закрити меню": "Close menu",
    "Відкрити меню": "Open menu",
    "Підкатегорії {label}": "{label} subcategories",
    Закрити: "Close",
    "Пошук...": "Searching...",
    "Нічого не знайдено за запитом «{query}»": "Nothing found for “{query}”",
    товар: "item",
    товари: "items",
    товарів: "items",

    // --- mega-menu / taxonomy ---
    "Всі товари": "All products",
    Переглянути: "View",
    "Переглянути все": "View all",
    Комбінезони: "Jumpsuits",
    Легінси: "Leggings",
    Топи: "Tops",
    Шорти: "Shorts",
    Лонгсліви: "Long sleeves",
    "Футболки, майки": "T-shirts & tanks",
    "Моделі із сітки": "Mesh styles",
    "Комплекти пілон": "Pole dance sets",
    Костюми: "Co-ord sets",
    Сорочки: "Shirts",
    Футболки: "T-shirts",
    Майки: "Tank tops",
    Термо: "Thermal wear",
    "Худі / Світшоти": "Hoodies & sweatshirts",
    Джоггери: "Joggers",
    "Yoga-килимки": "Yoga mats",
    Блоки: "Yoga blocks",
    Колесо: "Yoga wheel",
    Шкарпетки: "Socks",
    Ремені: "Straps",
    Рукав: "Long sleeve",
    "Короткий рукав": "Short sleeve",
    "Без рукава": "Sleeveless",
    "Yoga Колекція": "Yoga Collection",
    "Sport Колекція": "Sport Collection",
    "Dance Колекція": "Dance Collection",
    "Casual Колекція": "Casual Collection",
    "Дитяча Колекція": "Kids Collection",
    "Yoga Інвентар": "Yoga Props",
};
