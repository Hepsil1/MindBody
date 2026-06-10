/**
 * Shared color palette used by product cards, PDP color selector, and any
 * place that needs to render a color swatch from a colour-code stored in DB.
 *
 * Keep the keys in lowercase. When DB contains a code we don't know about,
 * we fall back to the raw value (which may itself be a valid CSS color).
 */
export const COLOR_MAP: Record<string, string> = {
    black: "#1a1a1a",
    white: "#ffffff",
    blue: "#3b82f6",
    pink: "#ec4899",
    green: "#22c55e",
    gray: "#6b7280",
    grey: "#6b7280",
    red: "#ef4444",
    purple: "#a855f7",
    yellow: "#eab308",
    orange: "#f97316",
    teal: "#14b8a6",
    brown: "#78350f",
    navy: "#1e3a8a",
    beige: "#f5f5dc",
    marsala: "#722F37",
    lavender: "#b8a8d8",
    mint: "#a7e3c0",
    cream: "#faf8f6",
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
