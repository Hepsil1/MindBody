/**
 * Format an arbitrary phone input as +380 (XX) XXX-XX-XX.
 *
 * Accepts user input in any common Ukrainian shape — `0671234567`,
 * `+380671234567`, `380671234567`, `67-12-34-567` — and produces the
 * canonical display form. Non-digits are stripped, prefixes are
 * normalised, and the result is built up segment-by-segment so the
 * caret stays in a sensible place if used as an `onChange` formatter.
 *
 * Lives in app/utils/phone.ts instead of inside checkout.tsx so the
 * helper can be reused by profile pages, the contact form, and any
 * future Telegram/SMS feature without copy-pasting.
 */
export function formatPhoneUA(value: string): string {
    const digits = value.replace(/\D/g, "");
    let d = digits;
    if (d.startsWith("80")) d = "3" + d;
    else if (d.startsWith("0")) d = "38" + d;
    else if (!d.startsWith("380") && !d.startsWith("3")) d = "380" + d;

    let result = "+380";
    const rest = d.slice(3);
    if (rest.length > 0) result += " (" + rest.slice(0, 2);
    if (rest.length >= 2) result += ") ";
    if (rest.length > 2) result += rest.slice(2, 5);
    if (rest.length > 5) result += "-" + rest.slice(5, 7);
    if (rest.length > 7) result += "-" + rest.slice(7, 9);
    return result;
}

/** Strip everything except digits — for storing/submitting to the API. */
export function getPhoneDigits(formatted: string): string {
    return formatted.replace(/\D/g, "");
}
