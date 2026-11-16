/**
 * Shared color palette used by product cards, PDP color selector, and any
 * place that needs to render a color swatch from a colour-code stored in DB.
 *
 * Values are calibrated to the real fabrics in the studio photos (muted,
 * not Tailwind primaries), so a navy jumpsuit never shows a bright-blue dot.
 * "blue" in the catalogue is the dark ink-blue Supplex (SWEET BERRY, ICE
 * CREAM, CHINCHILLA), so it sits next to navy rather than cobalt.
 *
 * Keep the keys in lowercase. When DB contains a code we don't know about,
 * we fall back to the raw value (which may itself be a valid CSS color).
 */
export const COLOR_MAP: Record<string, string> = {
    black: "#1a1a1a",
    white: "#f4f1ec",
    blue: "#262c45",
    pink: "#c8517a",
    green: "#3e4c37",
    gray: "#5b5b60",
    grey: "#5b5b60",
    red: "#b3262f",
    purple: "#5b3a6a",
    yellow: "#d6b25a",
    orange: "#c86a3a",
    teal: "#1f4d52",
    brown: "#4b3128",
    navy: "#23283d",
    beige: "#e2d6c3",
    marsala: "#722F37",
    lavender: "#b3a6c9",
    mint: "#b7d6c6",
    cream: "#f3eee3",
    sliva: "#4b3b6b",
    nude: "#dcc3ad",
};

export function getColorHex(code: string | undefined | null): string {
    if (!code) return "#e8e5e1";
    const key = String(code).trim().toLowerCase();
    return COLOR_MAP[key] ?? code;
}

/**
 * Ukrainian display names for the palette codes. FilterConfig's own colour
 * labels take precedence where present; this is the fallback so codes the
 * config doesn't know (marsala, lavender…) never leak raw slugs into the UI.
 */
export const COLOR_LABELS: Record<string, string> = {
    black: "Чорний",
    white: "Білий",
    blue: "Синій",
    pink: "Рожевий",
    green: "Зелений",
    gray: "Сірий",
    grey: "Сірий",
    red: "Червоний",
    purple: "Фіолетовий",
    yellow: "Жовтий",
    orange: "Помаранчевий",
    teal: "Бірюзовий",
    brown: "Коричневий",
    navy: "Темно-синій",
    beige: "Бежевий",
    marsala: "Марсала",
    lavender: "Лавандовий",
    mint: "М'ятний",
    cream: "Кремовий",
};

export function getColorLabel(code: string | undefined | null): string {
    if (!code) return "";
    const key = String(code).trim().toLowerCase();
    return COLOR_LABELS[key] ?? code;
}
