import { z } from 'zod';

// ===== Register API =====
export const RegisterSchema = z.object({
    name: z.string().min(2, 'Ім\'я занадто коротке').max(100).trim(),
    email: z.string().email('Невірний формат email').max(100).trim().toLowerCase(),
    phone: z.string().max(20).optional().nullable(),
});

// ===== Review API =====
export const ReviewSchema = z.object({
    productId: z.string().min(1, 'productId обов\'язковий'),
    authorName: z.string().min(2, 'Ім\'я занадто коротке').max(50).trim(),
    rating: z.number().int().min(1).max(5),
    text: z.string().min(3, 'Відгук занадто короткий').max(1000).trim(),
});

// ===== Order Create API =====
const OrderCustomerSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().max(100).trim().toLowerCase(),
    phone: z.string().min(10).max(20).trim(),
    city: z.string().min(1).max(100).trim(),
    warehouse: z.string().min(1).max(200).trim(),
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
    items: z.array(OrderItemSchema).min(1, 'Кошик порожній'),
    total: z.number().positive(),
    shippingCost: z.number().min(0).optional().default(0),
    paymentMethod: z.string().optional().default('cod'),
    deliveryMethod: z.string().optional().default('novaposhta'),
    comment: z.string().max(500).optional().default(''),
    promoCode: z.string().max(50).optional().nullable(),
});

// ===== Contact API =====
export const ContactSchema = z.object({
    contact: z.string().min(3, 'Введіть номер телефону або email').max(100).trim(),
});

// Helper: format Zod errors for response
export function formatZodErrors(error: z.ZodError): string {
    return error.issues.map(e => e.message).join('; ');
}
