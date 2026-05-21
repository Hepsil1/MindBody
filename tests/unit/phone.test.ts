import { describe, it, expect } from "vitest";
import { formatPhoneUA, getPhoneDigits } from "../../app/utils/phone";

describe("formatPhoneUA", () => {
    it("formats a bare local number (0XX...)", () => {
        expect(formatPhoneUA("0671234567")).toBe("+380 (67) 123-45-67");
    });

    it("formats a number that already has the 380 prefix", () => {
        expect(formatPhoneUA("380671234567")).toBe("+380 (67) 123-45-67");
    });

    it("strips a + and re-adds it consistently", () => {
        expect(formatPhoneUA("+380671234567")).toBe("+380 (67) 123-45-67");
    });

    it("strips arbitrary punctuation/whitespace", () => {
        expect(formatPhoneUA("+38 (067) 123-45-67")).toBe("+380 (67) 123-45-67");
        expect(formatPhoneUA("067 123 4567")).toBe("+380 (67) 123-45-67");
    });

    it("handles partial input as the user is still typing", () => {
        expect(formatPhoneUA("067")).toBe("+380 (67) ");
        expect(formatPhoneUA("06712")).toBe("+380 (67) 12");
        expect(formatPhoneUA("0671234")).toBe("+380 (67) 123-4");
    });

    it("normalises 80-prefixed numbers (legacy SMS share format)", () => {
        // Some carriers historically shared numbers as "80671234567"
        expect(formatPhoneUA("80671234567")).toBe("+380 (67) 123-45-67");
    });
});

describe("getPhoneDigits", () => {
    it("extracts only digits from a formatted number", () => {
        expect(getPhoneDigits("+380 (67) 123-45-67")).toBe("380671234567");
    });

    it("returns empty string for input without digits", () => {
        expect(getPhoneDigits("not a phone")).toBe("");
    });
});
