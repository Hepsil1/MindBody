import { describe, it, expect } from "vitest";
import {
    RegisterSchema,
    LoginSchema,
    ReviewSchema,
    OrderCreateSchema,
    ContactSchema,
    formatZodErrors,
} from "../../app/utils/validation";

// All schemas live in app/utils/validation.ts. These tests pin the
// happy-path contract + the error messages we surface to users on the
// API boundary.

describe("RegisterSchema", () => {
    const valid = {
        name: "Іван Петренко",
        email: "ivan@example.com",
        password: "secret123",
        phone: "+380501112233",
    };

    it("accepts a valid payload", () => {
        expect(RegisterSchema.parse(valid)).toMatchObject({
            name: "Іван Петренко",
            email: "ivan@example.com",
            password: "secret123",
        });
    });

    it("lowercases + trims the email", () => {
        const parsed = RegisterSchema.parse({ ...valid, email: "  IVAN@Example.COM  " });
        expect(parsed.email).toBe("ivan@example.com");
    });

    it("rejects names under 2 chars", () => {
        const res = RegisterSchema.safeParse({ ...valid, name: "I" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Ім'я занадто коротке");
    });

    it("rejects malformed email", () => {
        const res = RegisterSchema.safeParse({ ...valid, email: "not-an-email" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Невірний формат email");
    });

    it("rejects passwords under 6 chars", () => {
        const res = RegisterSchema.safeParse({ ...valid, password: "abc" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Пароль занадто короткий");
    });

    it("allows missing phone (optional)", () => {
        const { phone: _phone, ...withoutPhone } = valid;
        expect(RegisterSchema.safeParse(withoutPhone).success).toBe(true);
    });
});

describe("LoginSchema", () => {
    it("accepts a valid login payload", () => {
        const parsed = LoginSchema.parse({ email: "user@x.com", password: "anything" });
        expect(parsed.email).toBe("user@x.com");
    });

    it("rejects an empty password", () => {
        const res = LoginSchema.safeParse({ email: "user@x.com", password: "" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Пароль обов'язковий");
    });

    it("rejects a malformed email", () => {
        const res = LoginSchema.safeParse({ email: "nope", password: "secret" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Невірний формат email");
    });
});

describe("ReviewSchema", () => {
    const valid = {
        productId: "prod-123",
        authorName: "Анна",
        rating: 5,
        text: "Чудовий товар, рекомендую!",
    };

    it("accepts a valid review", () => {
        expect(ReviewSchema.parse(valid)).toEqual(valid);
    });

    it("rejects rating outside 1-5", () => {
        expect(ReviewSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
        expect(ReviewSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    });

    it("rejects non-integer rating", () => {
        expect(ReviewSchema.safeParse({ ...valid, rating: 4.5 }).success).toBe(false);
    });

    it("rejects review text shorter than 3 chars", () => {
        const res = ReviewSchema.safeParse({ ...valid, text: "no" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Відгук занадто короткий");
    });

    it("rejects review text over 1000 chars", () => {
        const res = ReviewSchema.safeParse({ ...valid, text: "a".repeat(1001) });
        expect(res.success).toBe(false);
    });
});

describe("OrderCreateSchema", () => {
    const validOrder = {
        customer: {
            name: "Олена Шевченко",
            email: "olena@example.com",
            phone: "+380501112233",
            city: "Київ",
            warehouse: "Відділення №42",
        },
        items: [
            {
                id: "prod-1",
                name: "Лосини FLOW",
                price: 1290,
                quantity: 1,
                size: "M",
                color: "black",
            },
        ],
        total: 1290,
    };

    it("accepts a valid order with defaults filled in", () => {
        const parsed = OrderCreateSchema.parse(validOrder);
        // Defaults from schema
        expect(parsed.shippingCost).toBe(0);
        expect(parsed.paymentMethod).toBe("cod");
        expect(parsed.deliveryMethod).toBe("novaposhta");
        expect(parsed.comment).toBe("");
    });

    it("rejects an empty cart", () => {
        const res = OrderCreateSchema.safeParse({ ...validOrder, items: [] });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Кошик порожній");
    });

    it("rejects negative or zero total", () => {
        expect(OrderCreateSchema.safeParse({ ...validOrder, total: 0 }).success).toBe(false);
        expect(OrderCreateSchema.safeParse({ ...validOrder, total: -100 }).success).toBe(false);
    });

    it("rejects items with quantity > 100", () => {
        const overstuffed = {
            ...validOrder,
            items: [{ ...validOrder.items[0], quantity: 101 }],
        };
        expect(OrderCreateSchema.safeParse(overstuffed).success).toBe(false);
    });

    it("rejects phone shorter than 10 chars", () => {
        const res = OrderCreateSchema.safeParse({
            ...validOrder,
            customer: { ...validOrder.customer, phone: "123" },
        });
        expect(res.success).toBe(false);
    });

    it("lowercases customer email", () => {
        const parsed = OrderCreateSchema.parse({
            ...validOrder,
            customer: { ...validOrder.customer, email: "OLENA@EXAMPLE.COM" },
        });
        expect(parsed.customer.email).toBe("olena@example.com");
    });

    it("accepts a guest with an empty email string (normalized, not rejected)", () => {
        const res = OrderCreateSchema.safeParse({
            ...validOrder,
            customer: { ...validOrder.customer, email: "" },
        });
        expect(res.success).toBe(true);
        expect(res.data?.customer.email).toBe("");
    });

    it("accepts an idempotencyKey", () => {
        const parsed = OrderCreateSchema.parse({
            ...validOrder,
            idempotencyKey: "11111111-2222-3333-4444-555555555555",
        });
        expect(parsed.idempotencyKey).toBe("11111111-2222-3333-4444-555555555555");
    });
});

describe("ContactSchema", () => {
    it("accepts a 3+ char contact string", () => {
        expect(ContactSchema.parse({ contact: "+380501112233" }).contact).toBe("+380501112233");
        expect(ContactSchema.parse({ contact: "test@x.com" }).contact).toBe("test@x.com");
    });

    it("rejects 2-char or shorter contact", () => {
        const res = ContactSchema.safeParse({ contact: "ab" });
        expect(res.success).toBe(false);
        expect(res.error?.issues[0].message).toBe("Введіть номер телефону або email");
    });

    it("trims whitespace", () => {
        expect(ContactSchema.parse({ contact: "  +380501112233  " }).contact).toBe("+380501112233");
    });
});

describe("formatZodErrors", () => {
    it("joins multiple issue messages with '; '", () => {
        const res = RegisterSchema.safeParse({ name: "I", email: "bad", password: "x" });
        expect(res.success).toBe(false);
        const formatted = formatZodErrors(res.error!);
        // Each schema-level error gets surfaced verbatim; order matches issues array.
        expect(formatted).toContain("Ім'я занадто коротке");
        expect(formatted).toContain("Невірний формат email");
        expect(formatted).toContain("Пароль занадто короткий");
        expect(formatted.split("; ").length).toBeGreaterThanOrEqual(3);
    });
});
