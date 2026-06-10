// Email service — server-side only. Wraps Resend SDK.
//
// Usage:
//   import { sendEmail, renderOrderConfirmation } from "./email.server";
//   await sendEmail({
//     to: customer.email,
//     subject: `Замовлення №${order.number} прийнято`,
//     html: renderOrderConfirmation({ order, customer }),
//   });
//
// Designed to fail soft: if RESEND_API_KEY is missing or send fails, the
// caller's main flow (order creation, signup) still completes. We just
// log the issue and skip the email.

import { Resend } from "resend";
import { env } from "./env.server";
import { logger } from "./logger.server";
import { prisma } from "../db.server";

const apiKey = env.RESEND_API_KEY;
const FROM_EMAIL = env.EMAIL_FROM ?? "hello@saleid.icu";
const FROM_NAME = env.EMAIL_FROM_NAME ?? "MIND BODY";
const REPLY_TO = env.EMAIL_REPLY_TO ?? FROM_EMAIL;
const SITE_URL = env.SITE_URL;

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailArgs {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    tags?: Array<{ name: string; value: string }>;
    // List-Unsubscribe link (per RFC 2369) — Gmail uses this for one-click unsubscribe.
    // Significantly improves deliverability + reduces spam folder risk.
    unsubscribeUrl?: string;
}

// Strip HTML to a plain-text fallback. Email clients that can't render HTML
// (or that score messages) prefer having both. Spam filters explicitly look
// for HTML-only messages and penalise them.
function htmlToText(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<\/?(p|div|h[1-6]|li|tr|td|br)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
}

export async function sendEmail(
    args: SendEmailArgs,
): Promise<{ ok: boolean; id?: string; error?: string }> {
    if (!resend) {
        logger.warn({ to: args.to }, "[email] RESEND_API_KEY not set — skipping send");
        return { ok: false, error: "not_configured" };
    }
    try {
        // Build standard mail headers that improve deliverability.
        const headers: Record<string, string> = {};
        if (args.unsubscribeUrl) {
            // Gmail / Apple Mail / Outlook honour List-Unsubscribe-Post for
            // one-click unsubscribe (RFC 8058) — a key signal for inbox vs spam.
            headers["List-Unsubscribe"] = `<${args.unsubscribeUrl}>`;
            headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
        }

        const res = await resend.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: args.to,
            subject: args.subject,
            html: args.html,
            text: args.text || htmlToText(args.html),
            replyTo: args.replyTo ?? REPLY_TO,
            tags: args.tags,
            headers: Object.keys(headers).length ? headers : undefined,
        });
        if (res.error) {
            logger.error({ err: res.error, to: args.to }, "[email] Resend error");
            return { ok: false, error: res.error.message };
        }
        return { ok: true, id: res.data?.id };
    } catch (e) {
        logger.error({ err: e, to: args.to }, "[email] unexpected send error");
        const message = e instanceof Error ? e.message : "send_failed";
        return { ok: false, error: message };
    }
}

// ---------------------------------------------------------------------------
// Templates
//
// Brand palette mirrors site CSS vars:
//   cream  #faf8f6   primary #2a5a5a   primary-dark #1e4444
//   accent #4B3B6B   text    #1a1a1a   secondary #555
//
// Premium tone, Cormorant for the eyebrow / titles where Gmail respects fallbacks.
// Inlined styles only — email clients don't honour <style> reliably.
// ---------------------------------------------------------------------------

const ESCAPE: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};
function esc(s: unknown): string {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPE[c]);
}
function money(n: number) {
    return `${(n || 0).toLocaleString("uk-UA")} ₴`;
}

function shell(opts: {
    preheader: string;
    title: string;
    eyebrow?: string;
    bodyHtml: string;
    cta?: { label: string; href: string };
}): string {
    return `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(opts.title)}</title>
  </head>
  <body style="margin:0; padding:0; background:#faf8f6; font-family:'Helvetica Neue', Arial, sans-serif; color:#1a1a1a;">
    <span style="display:none !important; visibility:hidden; opacity:0; max-height:0; overflow:hidden;">${esc(opts.preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(20,40,40,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#2a5a5a 0%,#1e4444 100%); padding:32px 32px; text-align:center;">
                <div style="color:rgba(255,255,255,0.7); font-size:11px; letter-spacing:0.3em; text-transform:uppercase; margin-bottom:8px;">${esc(opts.eyebrow || "MIND BODY")}</div>
                <div style="font-family:'Cormorant Garamond', Georgia, serif; color:#ffffff; font-size:28px; line-height:1.2; letter-spacing:-0.01em;">${esc(opts.title)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${opts.bodyHtml}
                ${
                    opts.cta
                        ? `
                <div style="text-align:center; margin-top:32px;">
                  <a href="${esc(opts.cta.href)}" style="display:inline-block; background:#2a5a5a; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:999px; font-weight:600; letter-spacing:0.02em;">${esc(opts.cta.label)}</a>
                </div>`
                        : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px; border-top:1px solid #efece8; color:#888; font-size:12px; line-height:1.6; text-align:center;">
                MIND BODY · Спортивний одяг створений в Україні<br />
                <a href="${SITE_URL}" style="color:#2a5a5a; text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a> ·
                <a href="${SITE_URL}/contacts" style="color:#2a5a5a; text-decoration:none;">контакти</a>
              </td>
            </tr>
          </table>
          <div style="color:#aaa; font-size:11px; margin-top:16px;">© ${new Date().getFullYear()} MIND BODY</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface OrderEmailItem {
    name: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
    image?: string;
}

export interface OrderEmailData {
    orderNumber: number | string;
    customerName: string;
    customerEmail?: string;
    items: OrderEmailItem[];
    total: number;
    deliveryMethod?: string;
    deliveryAddress?: string;
    paymentMethod?: string;
}

export function renderOrderConfirmation(data: OrderEmailData): string {
    const itemsRows = data.items
        .map(
            (it) => `
        <tr>
          <td style="padding:12px 0; border-bottom:1px solid #f0ede9;">
            <div style="font-weight:600;">${esc(it.name)}</div>
            <div style="color:#888; font-size:13px; margin-top:2px;">
              ${it.size ? `Розмір: ${esc(it.size)}` : ""}
              ${it.size && it.color ? " · " : ""}
              ${it.color ? `Колір: ${esc(it.color)}` : ""}
            </div>
          </td>
          <td style="padding:12px 0; border-bottom:1px solid #f0ede9; text-align:center; color:#555;">
            ${it.quantity}
          </td>
          <td style="padding:12px 0; border-bottom:1px solid #f0ede9; text-align:right; font-weight:600;">
            ${money(it.price * it.quantity)}
          </td>
        </tr>
    `,
        )
        .join("");

    const bodyHtml = `
        <p style="font-size:16px; line-height:1.6; color:#1a1a1a; margin:0 0 16px;">
            ${esc(data.customerName)}, дякуємо за замовлення в&nbsp;MIND BODY ✨
        </p>
        <p style="font-size:15px; line-height:1.6; color:#555; margin:0 0 24px;">
            Ми отримали замовлення <strong>№${esc(data.orderNumber)}</strong> і вже починаємо комплектувати.
            Як тільки відправимо — пришлемо ТТН для відстеження.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <thead>
                <tr>
                    <th style="text-align:left; padding:8px 0; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; border-bottom:1px solid #ddd;">Товар</th>
                    <th style="text-align:center; padding:8px 0; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; border-bottom:1px solid #ddd;">К-сть</th>
                    <th style="text-align:right; padding:8px 0; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; border-bottom:1px solid #ddd;">Сума</th>
                </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding:16px 0 0; font-size:15px; color:#555;">До сплати</td>
                    <td style="padding:16px 0 0; font-size:18px; font-weight:700; text-align:right; color:#2a5a5a;">${money(data.total)}</td>
                </tr>
            </tfoot>
        </table>

        ${
            data.deliveryMethod || data.deliveryAddress
                ? `
        <div style="margin-top:24px; padding:16px; background:#faf8f6; border-radius:12px;">
            <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin-bottom:6px;">Доставка</div>
            <div style="font-size:14px; color:#1a1a1a;">
                ${esc(data.deliveryMethod || "")}${data.deliveryAddress ? "<br>" + esc(data.deliveryAddress) : ""}
            </div>
        </div>`
                : ""
        }

        ${
            data.paymentMethod
                ? `
        <div style="margin-top:12px; padding:16px; background:#faf8f6; border-radius:12px;">
            <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin-bottom:6px;">Оплата</div>
            <div style="font-size:14px; color:#1a1a1a;">${esc(data.paymentMethod)}</div>
        </div>`
                : ""
        }

        <p style="font-size:13px; color:#888; line-height:1.6; margin:24px 0 0;">
            Якщо щось не так — просто дай нам знати, відповівши на цей email.
        </p>
    `;

    return shell({
        preheader: `Замовлення №${data.orderNumber} прийнято. Сума: ${money(data.total)}.`,
        title: "Дякуємо за замовлення",
        eyebrow: `Замовлення №${data.orderNumber}`,
        bodyHtml,
        cta: { label: "Подивитись на сайті", href: `${SITE_URL}/profile` },
    });
}

export function renderNewsletterWelcome(data: { email: string; unsubKey?: string }): string {
    const unsubLink = data.unsubKey
        ? `${SITE_URL}/api/newsletter?unsub=${data.unsubKey}`
        : `${SITE_URL}`;
    const bodyHtml = `
        <p style="font-size:16px; line-height:1.6; color:#1a1a1a; margin:0 0 16px;">
            Ласкаво просимо у спільноту MIND BODY ✨
        </p>
        <p style="font-size:15px; line-height:1.7; color:#555; margin:0 0 16px;">
            Тепер ти першою дізнаєшся про нові колекції, лімітовані дропи та приватні знижки —
            раз на місяць, без спаму.
        </p>
        <p style="font-size:15px; line-height:1.7; color:#555; margin:0 0 16px;">
            Поки що — приготували невеличкий подарунок: промокод <strong style="color:#2a5a5a;">WELCOME10</strong> дає
            знижку 10% на перше замовлення.
        </p>
        <p style="font-size:13px; color:#888; line-height:1.6; margin-top:24px;">
            Якщо передумаєш — можеш <a href="${esc(unsubLink)}" style="color:#888; text-decoration:underline;">відписатись одним кліком</a>.
        </p>
    `;

    return shell({
        preheader: "Промокод WELCOME10 на перше замовлення всередині.",
        title: "Ласкаво просимо",
        eyebrow: "MIND BODY · Newsletter",
        bodyHtml,
        cta: { label: "Перейти в магазин", href: SITE_URL },
    });
}

// ---------------------------------------------------------------------------
// Order status-change notifications ("де моя посилка"). The confirmation email
// already promises a shipping update ("Як тільки відправимо — пришлемо ТТН"),
// so this closes that loop. Only the three customer-relevant transitions are
// emailed; the optional `note` carries the Nova Poshta ТТН (operator-entered).
// ---------------------------------------------------------------------------

const STATUS_EMAIL: Record<
    string,
    { subject: (n: number | string) => string; title: string; msg: string }
> = {
    shipped: {
        subject: (n) => `Замовлення №${n} відправлено`,
        title: "Замовлення в дорозі",
        msg: "Ваше замовлення відправлено Новою Поштою. Очікуйте на SMS від перевізника про прибуття у відділення.",
    },
    delivered: {
        subject: (n) => `Замовлення №${n} доставлено`,
        title: "Замовлення доставлено",
        msg: "Ваше замовлення доставлено. Дякуємо, що обрали MIND BODY 💚 Будемо вдячні за відгук про товар.",
    },
    cancelled: {
        subject: (n) => `Замовлення №${n} скасовано`,
        title: "Замовлення скасовано",
        msg: "Ваше замовлення було скасовано. Якщо це сталося помилково — просто напишіть нам у відповідь на цей лист.",
    },
};

export function renderOrderStatusEmail(data: {
    orderNumber: number | string;
    customerName: string;
    status: string;
    note?: string | null;
}): string | null {
    const cfg = STATUS_EMAIL[data.status];
    if (!cfg) return null;
    const ttn =
        data.status === "shipped" && data.note && data.note.trim()
            ? `<p style="font-size:14px; color:#555; margin:0 0 6px;">Номер для відстеження (ТТН):</p>
               <p style="font-size:20px; font-weight:700; letter-spacing:1px; color:#1e4444; margin:0 0 24px;">${esc(
                   data.note.trim(),
               )}</p>`
            : "";
    const bodyHtml = `
        <p style="font-size:16px; line-height:1.6; color:#1a1a1a; margin:0 0 16px;">
            ${esc(data.customerName)}, вітаємо!
        </p>
        <p style="font-size:15px; line-height:1.7; color:#555; margin:0 0 16px;">
            Замовлення <strong>№${esc(data.orderNumber)}</strong> — ${esc(cfg.msg)}
        </p>
        ${ttn}
    `;
    return shell({
        preheader: cfg.subject(data.orderNumber),
        eyebrow: `Замовлення №${data.orderNumber}`,
        title: cfg.title,
        bodyHtml,
        cta: { label: "До магазину", href: SITE_URL },
    });
}

/**
 * Best-effort customer email on a status change. No-op for non-customer-facing
 * statuses and for guest orders (placeholder @mindbody.local email). NEVER
 * throws — the admin status change must succeed regardless of email outcome.
 */
export async function notifyOrderStatus(
    orderId: string,
    status: string,
    note?: string | null,
): Promise<void> {
    if (!STATUS_EMAIL[status]) return;
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                orderNumber: true,
                customer: { select: { email: true, firstName: true } },
            },
        });
        const email = order?.customer?.email;
        if (!order || !email || email.endsWith("@mindbody.local")) return;
        const html = renderOrderStatusEmail({
            orderNumber: order.orderNumber,
            customerName: order.customer?.firstName || "Вітаємо",
            status,
            note,
        });
        if (!html) return;
        await sendEmail({
            to: email,
            subject: STATUS_EMAIL[status].subject(order.orderNumber),
            html,
            tags: [
                { name: "type", value: "order-status" },
                { name: "status", value: status },
            ],
        });
    } catch (e) {
        logger.error({ err: e, orderId, status }, "[email] order-status notify failed");
    }
}
