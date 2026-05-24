/**
 * Ukrainian plural form selector.
 *
 * Three forms based on the last digit:
 *  - 1 (ends in 1, except 11): singular (товар)
 *  - 2-4 (ends in 2/3/4, except 12-14): few (товари)
 *  - 0, 5-9, 11-14: many (товарів)
 *
 * @example
 *   pluralizeUA(1, "товар", "товари", "товарів")   // "товар"
 *   pluralizeUA(3, "товар", "товари", "товарів")   // "товари"
 *   pluralizeUA(5, "товар", "товари", "товарів")   // "товарів"
 *   pluralizeUA(21, "товар", "товари", "товарів")  // "товар" (ends in 1)
 *   pluralizeUA(12, "товар", "товари", "товарів")  // "товарів" (11-14 → many)
 */
export function pluralizeUA(count: number, singular: string, few: string, many: string): string {
    const n = Math.abs(Math.trunc(count));
    const mod100 = n % 100;
    const mod10 = n % 10;

    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return singular;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

/** Convenience: returns "5 товарів" / "3 товари" / "1 товар". */
export function countLabel(count: number, singular: string, few: string, many: string): string {
    return `${count} ${pluralizeUA(count, singular, few, many)}`;
}
