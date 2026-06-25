/**
 * English dictionary. KEY = exact Ukrainian source string (the uk locale
 * renders keys as-is, so uk never needs a dictionary). Params use {name}
 * placeholders substituted by translate().
 *
 * Keep alphabetical-ish grouping by feature area; long content-page prose
 * lives at the bottom.
 */
export const en: Record<string, string> = {
    // --- wishlist auth gate ---
    "Збережіть улюблені товари": "Save your favourites",
    "Увійдіть або зареєструйтеся, щоб зберігати обране та повертатися до нього будь-коли":
        "Sign in or create an account to save items and come back to them anytime",
    "Товар буде збережено після входу": "The item will be saved after sign‑in",

    // --- checkout: cart-price reconciliation ---
    "Ціни в кошику оновлено до актуальних.": "Cart prices have been updated to the current ones.",
    "Деякі товари більше недоступні — їх прибрано з кошика.":
        "Some items are no longer available — they were removed from your cart.",
    "Ціни оновилися. Кошик перераховано — перевірте суму та оформіть ще раз.":
        "Prices have changed. Your cart was recalculated — check the total and place the order again.",

    // --- delivery (no free shipping — always carrier tariff) ---
    "За тарифами перевізника": "At carrier's rates",
    "Доставка за тарифами перевізника": "Delivery at the carrier's rates",
    "Вартість доставки — за тарифами Нової Пошти": "Delivery cost — at Nova Poshta rates",
    "Український бренд спортивного одягу для жінок та дітей. Йога, гімнастика, акробатика. Доставка Новою Поштою по всій Україні.":
        "Ukrainian sportswear brand for women and kids. Yoga, gymnastics, acrobatics. Nova Poshta delivery across Ukraine.",

    // --- profile completion (first Google sign-in) ---
    "Вітаємо в MIND BODY!": "Welcome to MIND BODY!",
    "Залиште ім'я та номер телефону — вони потрібні, щоб ми підтвердили та доставили ваше замовлення.":
        "Leave your name and phone number — we need them to confirm and deliver your order.",
    "Ваше ім'я": "Your name",
    Пізніше: "Later",
    "Збереження...": "Saving...",
    "Дякуємо! Профіль збережено.": "Thank you! Your profile has been saved.",

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
