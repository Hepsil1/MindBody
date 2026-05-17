import { z } from "zod";

// ===== Register API =====
// IMPORTANT: in Zod 4, .email() validates BEFORE .trim() applies in the chain.
// So we must .trim() the input first, otherwise "  user@x.com  " fails
// validation with "Невірний формат email" even though it's a perfectly valid
// address with stray whitespace from a copy-paste.
export const RegisterSchema = z.object({
    name: z.string().trim().min(2, "Ім'я занадто коротке").max(100),
    email: z.string().trim().toLowerCase().email("Невірний формат email").max(100),
    phone: z.string().max(20).optional().nullable(),
    password: z.string().min(6, "Пароль занадто короткий").max(100),
});

// ===== Login API =====
export const LoginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Невірний формат email").max(100),
    password: z.string().min(1, "Пароль обов'язковий").max(100),
});

// ===== Review API =====
export const ReviewSchema = z.object({
    productId: z.string().min(1, "productId обов'язковий"),
    authorName: z.string().min(2, "Ім'я занадто коротке").max(50).trim(),
    rating: z.number().int().min(1).max(5),
    text: z.string().min(3, "Відгук занадто короткий").max(1000).trim(),
});

// ===== Order Create API =====
// Same Zod-4 whitespace-before-validation gotcha as RegisterSchema above.
const OrderCustomerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(100).optional().default(""),
    phone: z.string().trim().min(10).max(20),
    city: z.string().trim().min(1).max(100),
    warehouse: z.string().trim().min(1).max(200),
});

const OrderItemSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    price: z.number().positive(),
    quantity: z.number().int().min(1).max(100),
    size: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
});

export const OrderCreateSchema = z.object({
    customer: OrderCustomerSchema,
    items: z.array(OrderItemSchema).min(1, "Кошик порожній"),
    total: z.number().positive(),
    shippingCost: z.number().min(0).optional().default(0),
    paymentMethod: z.string().optional().default("cod"),
    deliveryMethod: z.string().optional().default("novaposhta"),
    comment: z.string().max(500).optional().default(""),
    promoCode: z.string().max(50).optional().nullable(),
});

// ===== Contact API =====
export const ContactSchema = z.object({
    contact: z.string().min(3, "Введіть номер телефону або email").max(100).trim(),
});

// Helper: format Zod errors for response
export function formatZodErrors(error: z.ZodError): string {
    return error.issues.map((e) => e.message).join("; ");
}
