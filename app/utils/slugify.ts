/**
 * Transliterate Ukrainian/Russian Cyrillic to Latin and produce a URL-safe,
 * lowercase, hyphen-separated slug. Used to auto-generate Product.slug from a
 * (Cyrillic) product name so /p/<slug> URLs and the sitemap work.
 *
 *   slugify("Лонгслів CALM")  -> "lonhsliv-calm"
 *   slugify("Топ «Зоря» 2.0") -> "top-zoria-2-0"
 */
const TRANSLIT: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "h",
    ґ: "g",
    д: "d",
    е: "e",
    є: "ie",
    ж: "zh",
    з: "z",
    и: "y",
    і: "i",
    ї: "i",
    й: "i",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ь: "",
    ю: "iu",
    я: "ia",
    // Russian-only letters that may slip in
    ё: "e",
    ы: "y",
    э: "e",
    ъ: "",
};

export function slugify(input: string): string {
    const lower = (input || "").toLowerCase();
    let out = "";
    for (const ch of lower) {
        out += Object.prototype.hasOwnProperty.call(TRANSLIT, ch) ? TRANSLIT[ch] : ch;
    }
    return out
        .replace(/[^a-z0-9]+/g, "-") // anything non-alphanumeric -> hyphen
        .replace(/-{2,}/g, "-") // collapse repeats
        .replace(/^-+|-+$/g, ""); // trim leading/trailing
}
