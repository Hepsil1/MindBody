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
import { HTML_LANG, localizePath, type Locale } from "../i18n/config";

const apiKey = env.RESEND_API_KEY;
// KNOWN LOOSE END (2026-06-26 domain retirement): still saleid.icu on purpose.
// mindbody-sportwear.com is NOT yet verified as a sending domain in Resend
// (resend.com/domains — DNS TXT/DKIM). Switching this before that's done would
// break every transactional email (order confirmations). Once verified, update
// EMAIL_FROM/EMAIL_REPLY_TO in .env (and this fallback) to @mindbody-sportwear.com.
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

// ---------------------------------------------------------------------------
// Email i18n. Transactional emails follow the storefront language the order
// was placed from (Order.locale). Amounts stay in UAH in every language —
// that's the actual payment currency; en/ru just label it explicitly.
// ---------------------------------------------------------------------------

interface EmailStrings {
    footerTagline: string;
    contactsLabel: string;
    orderEyebrow: (n: number | string) => string;
    orderSubject: (n: number | string) => string;
    orderTitle: string;
    orderThanks: (name: string) => string;
    orderReceived: (n: number | string) => string;
    colItem: string;
    colQty: string;
    colSum: string;
    sizeLabel: string;
    colorLabel: string;
    totalDue: string;
    deliveryLabel: string;
    paymentLabel: string;
    somethingWrong: string;
    orderPreheader: (n: number | string, total: string) => string;
    viewOnSite: string;
    toShop: string;
    greeting: (name: string) => string;
    ttnLabel: string;
    statusShipped: { subject: (n: number | string) => string; title: string; msg: string };
    statusDelivered: { subject: (n: number | string) => string; title: string; msg: string };
    statusCancelled: { subject: (n: number | string) => string; title: string; msg: string };
}

const EMAIL_STRINGS: Record<Locale, EmailStrings> = {
    uk: {
        footerTagline: "Спортивний одяг створений в Україні",
        contactsLabel: "контакти",
        orderEyebrow: (n) => `Замовлення №${n}`,
        orderSubject: (n) => `Замовлення №${n} прийнято · MIND BODY`,
        orderTitle: "Дякуємо за замовлення",
        orderThanks: (name) => `${name}, дякуємо за замовлення в&nbsp;MIND BODY ✨`,
        orderReceived: (n) =>
            `Ми отримали замовлення <strong>№${n}</strong> і вже починаємо комплектувати. Як тільки відправимо — пришлемо ТТН для відстеження.`,
        colItem: "Товар",
        colQty: "К-сть",
        colSum: "Сума",
        sizeLabel: "Розмір",
        colorLabel: "Колір",
        totalDue: "До сплати",
        deliveryLabel: "Доставка",
        paymentLabel: "Оплата",
        somethingWrong: "Якщо щось не так — просто дай нам знати, відповівши на цей email.",
        orderPreheader: (n, total) => `Замовлення №${n} прийнято. Сума: ${total}.`,
        viewOnSite: "Подивитись на сайті",
        toShop: "До магазину",
        greeting: (name) => `${name}, вітаємо!`,
        ttnLabel: "Номер для відстеження (ТТН):",
        statusShipped: {
            subject: (n) => `Замовлення №${n} відправлено`,
            title: "Замовлення в дорозі",
            msg: "Ваше замовлення відправлено Новою Поштою. Очікуйте на SMS від перевізника про прибуття у відділення.",
        },
        statusDelivered: {
            subject: (n) => `Замовлення №${n} доставлено`,
            title: "Замовлення доставлено",
            msg: "Ваше замовлення доставлено. Дякуємо, що обрали MIND BODY 💚 Будемо вдячні за відгук про товар.",
        },
        statusCancelled: {
            subject: (n) => `Замовлення №${n} скасовано`,
            title: "Замовлення скасовано",
            msg: "Ваше замовлення було скасовано. Якщо це сталося помилково — просто напишіть нам у відповідь на цей лист.",
        },
    },
    en: {
        footerTagline: "Sportswear made in Ukraine",
        contactsLabel: "contacts",
        orderEyebrow: (n) => `Order #${n}`,
        orderSubject: (n) => `Order #${n} confirmed · MIND BODY`,
        orderTitle: "Thank you for your order",
        orderThanks: (name) => `${name}, thank you for shopping with&nbsp;MIND BODY ✨`,
        orderReceived: (n) =>
            `We've received order <strong>#${n}</strong> and are already putting it together. As soon as it ships, we'll send you the tracking number.`,
        colItem: "Item",
        colQty: "Qty",
        colSum: "Total",
        sizeLabel: "Size",
        colorLabel: "Color",
        totalDue: "Total due (UAH)",
        deliveryLabel: "Delivery",
        paymentLabel: "Payment",
        somethingWrong: "If anything looks off, just reply to this email and we'll sort it out.",
        orderPreheader: (n, total) => `Order #${n} confirmed. Total: ${total}.`,
        viewOnSite: "View on the site",
        toShop: "Back to the shop",
        greeting: (name) => `${name}, good news!`,
        ttnLabel: "Tracking number (TTN):",
        statusShipped: {
            subject: (n) => `Order #${n} shipped`,
            title: "Your order is on its way",
            msg: "Your order has been shipped via Nova Poshta. The carrier will text you when it arrives at the pickup branch.",
        },
        statusDelivered: {
            subject: (n) => `Order #${n} delivered`,
            title: "Order delivered",
            msg: "Your order has been delivered. Thank you for choosing MIND BODY 💚 We'd love to hear your review.",
        },
        statusCancelled: {
            subject: (n) => `Order #${n} cancelled`,
            title: "Order cancelled",
            msg: "Your order has been cancelled. If this happened by mistake, just reply to this email.",
        },
    },
    ru: {
        footerTagline: "Спортивная одежда, созданная в Украине",
        contactsLabel: "контакты",
        orderEyebrow: (n) => `Заказ №${n}`,
        orderSubject: (n) => `Заказ №${n} принят · MIND BODY`,
        orderTitle: "Спасибо за заказ",
        orderThanks: (name) => `${name}, спасибо за заказ в&nbsp;MIND BODY ✨`,
        orderReceived: (n) =>
            `Мы получили заказ <strong>№${n}</strong> и уже начинаем его собирать. Как только отправим — пришлём ТТН для отслеживания.`,
        colItem: "Товар",
        colQty: "Кол-во",
        colSum: "Сумма",
        sizeLabel: "Размер",
        colorLabel: "Цвет",
        totalDue: "К оплате (грн)",
        deliveryLabel: "Доставка",
        paymentLabel: "Оплата",
        somethingWrong: "Если что-то не так — просто ответьте на это письмо, мы всё решим.",
        orderPreheader: (n, total) => `Заказ №${n} принят. Сумма: ${total}.`,
        viewOnSite: "Посмотреть на сайте",
        toShop: "В магазин",
        greeting: (name) => `${name}, отличные новости!`,
        ttnLabel: "Номер для отслеживания (ТТН):",
        statusShipped: {
            subject: (n) => `Заказ №${n} отправлен`,
            title: "Заказ в пути",
            msg: "Ваш заказ отправлен Новой Почтой. Ожидайте SMS от перевозчика о прибытии в отделение.",
        },
        statusDelivered: {
            subject: (n) => `Заказ №${n} доставлен`,
            title: "Заказ доставлен",
            msg: "Ваш заказ доставлен. Спасибо, что выбрали MIND BODY 💚 Будем благодарны за отзыв о товаре.",
        },
        statusCancelled: {
            subject: (n) => `Заказ №${n} отменён`,
            title: "Заказ отменён",
            msg: "Ваш заказ был отменён. Если это произошло по ошибке — просто напишите нам в ответ на это письмо.",
        },
    },
};

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
    locale?: Locale;
}): string {
    const locale = opts.locale ?? "uk";
    const S = EMAIL_STRINGS[locale];
    return `<!doctype html>
<html lang="${HTML_LANG[locale]}">
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
                MIND BODY · ${esc(S.footerTagline)}<br />
                <a href="${SITE_URL}" style="color:#2a5a5a; text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a> ·
                <a href="${SITE_URL}${localizePath("/contacts", locale)}" style="color:#2a5a5a; text-decoration:none;">${esc(S.contactsLabel)}</a>
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
    /** Storefront language of the order — picks the email language. */
    locale?: Locale;
}

/** Subject line for the confirmation email in the order's language. */
export function orderConfirmationSubject(orderNumber: number | string, locale: Locale): string {
    return EMAIL_STRINGS[locale].orderSubject(orderNumber);
}

export function renderOrderConfirmation(data: OrderEmailData): string {
    const locale = data.locale ?? "uk";
    const S = EMAIL_STRINGS[locale];
    const itemsRows = data.items
        .map(
            (it) => `
        <tr>
          <td style="padding:12px 0; border-bottom:1px solid #f0ede9;">
            <div style="font-weight:600;">${esc(it.name)}</div>
            <div style="color:#888; font-size:13px; margin-top:2px;">
              ${it.size ? `${S.sizeLabel}: ${esc(it.size)}` : ""}
              ${it.size && it.color ? " · " : ""}
              ${it.color ? `${S.colorLabel}: ${esc(it.color)}` : ""}
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
            ${S.orderThanks(esc(data.customerName))}
        </p>
        <p style="font-size:15px; line-height:1.6; color:#555; margin:0 0 24px;">
            ${S.orderReceived(esc(data.orderNumber))}
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <thead>
                <tr>
                    <th style="text-align:left; padding:8px 0; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; border-bottom:1px solid #ddd;">${esc(S.colItem)}</th>
                    <th style="text-align:center; padding:8px 0; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; border-bottom:1px solid #ddd;">${esc(S.colQty)}</th>
                    <th style="text-align:right; padding:8px 0; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; border-bottom:1px solid #ddd;">${esc(S.colSum)}</th>
                </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding:16px 0 0; font-size:15px; color:#555;">${esc(S.totalDue)}</td>
                    <td style="padding:16px 0 0; font-size:18px; font-weight:700; text-align:right; color:#2a5a5a;">${money(data.total)}</td>
                </tr>
            </tfoot>
        </table>

        ${
            data.deliveryMethod || data.deliveryAddress
                ? `
        <div style="margin-top:24px; padding:16px; background:#faf8f6; border-radius:12px;">
            <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin-bottom:6px;">${esc(S.deliveryLabel)}</div>
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
            <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin-bottom:6px;">${esc(S.paymentLabel)}</div>
            <div style="font-size:14px; color:#1a1a1a;">${esc(data.paymentMethod)}</div>
        </div>`
                : ""
        }

        <p style="font-size:13px; color:#888; line-height:1.6; margin:24px 0 0;">
            ${esc(S.somethingWrong)}
        </p>
    `;

    return shell({
        preheader: S.orderPreheader(data.orderNumber, money(data.total)),
        title: S.orderTitle,
        eyebrow: S.orderEyebrow(data.orderNumber),
        bodyHtml,
        cta: { label: S.viewOnSite, href: `${SITE_URL}${localizePath("/profile", locale)}` },
        locale,
    });
}

const NEWSLETTER_STRINGS: Record<
    Locale,
    {
        subject: string;
        preheader: string;
        title: string;
        welcome: string;
        promise: string;
        gift: string;
        unsub: (link: string) => string;
        cta: string;
    }
> = {
    uk: {
        subject: "Ласкаво просимо у MIND BODY",
        preheader: "Промокод WELCOME10 на перше замовлення всередині.",
        title: "Ласкаво просимо",
        welcome: "Ласкаво просимо у спільноту MIND BODY ✨",
        promise:
            "Тепер ти першою дізнаєшся про нові колекції, лімітовані дропи та приватні знижки — раз на місяць, без спаму.",
        gift: `Поки що — приготували невеличкий подарунок: промокод <strong style="color:#2a5a5a;">WELCOME10</strong> дає знижку 10% на перше замовлення.`,
        unsub: (link) =>
            `Якщо передумаєш — можеш <a href="${link}" style="color:#888; text-decoration:underline;">відписатись одним кліком</a>.`,
        cta: "Перейти в магазин",
    },
    en: {
        subject: "Welcome to MIND BODY",
        preheader: "Your WELCOME10 promo code for the first order is inside.",
        title: "Welcome",
        welcome: "Welcome to the MIND BODY community ✨",
        promise:
            "You'll be the first to hear about new collections, limited drops and private discounts — once a month, no spam.",
        gift: `To get you started, here's a little gift: promo code <strong style="color:#2a5a5a;">WELCOME10</strong> takes 10% off your first order.`,
        unsub: (link) =>
            `Changed your mind? You can <a href="${link}" style="color:#888; text-decoration:underline;">unsubscribe in one click</a>.`,
        cta: "Visit the shop",
    },
    ru: {
        subject: "Добро пожаловать в MIND BODY",
        preheader: "Промокод WELCOME10 на первый заказ внутри.",
        title: "Добро пожаловать",
        welcome: "Добро пожаловать в сообщество MIND BODY ✨",
        promise:
            "Теперь вы первыми будете узнавать о новых коллекциях, лимитированных дропах и закрытых скидках — раз в месяц, без спама.",
        gift: `А пока — небольшой подарок: промокод <strong style="color:#2a5a5a;">WELCOME10</strong> даёт скидку 10% на первый заказ.`,
        unsub: (link) =>
            `Передумали? Можно <a href="${link}" style="color:#888; text-decoration:underline;">отписаться в один клик</a>.`,
        cta: "Перейти в магазин",
    },
};

/** Subject for the newsletter welcome email in the visitor's language. */
export function newsletterWelcomeSubject(locale: Locale): string {
    return NEWSLETTER_STRINGS[locale].subject;
}

export function renderNewsletterWelcome(data: {
    email: string;
    unsubKey?: string;
    locale?: Locale;
}): string {
    const locale = data.locale ?? "uk";
    const N = NEWSLETTER_STRINGS[locale];
    const unsubLink = data.unsubKey
        ? `${SITE_URL}/api/newsletter?unsub=${data.unsubKey}`
        : `${SITE_URL}`;
    const bodyHtml = `
        <p style="font-size:16px; line-height:1.6; color:#1a1a1a; margin:0 0 16px;">
            ${N.welcome}
        </p>
        <p style="font-size:15px; line-height:1.7; color:#555; margin:0 0 16px;">
            ${N.promise}
        </p>
        <p style="font-size:15px; line-height:1.7; color:#555; margin:0 0 16px;">
            ${N.gift}
        </p>
        <p style="font-size:13px; color:#888; line-height:1.6; margin-top:24px;">
            ${N.unsub(esc(unsubLink))}
        </p>
    `;

    return shell({
        preheader: N.preheader,
        title: N.title,
        eyebrow: "MIND BODY · Newsletter",
        bodyHtml,
        cta: { label: N.cta, href: `${SITE_URL}${localizePath("/", locale)}` },
        locale,
    });
}

// ---------------------------------------------------------------------------
// Order status-change notifications ("де моя посилка"). The confirmation email
// already promises a shipping update ("Як тільки відправимо — пришлемо ТТН"),
// so this closes that loop. Only the three customer-relevant transitions are
// emailed; the optional `note` carries the Nova Poshta ТТН (operator-entered).
// ---------------------------------------------------------------------------

const STATUS_KEYS = {
    shipped: "statusShipped",
    delivered: "statusDelivered",
    cancelled: "statusCancelled",
} as const;

type EmailedStatus = keyof typeof STATUS_KEYS;

function isEmailedStatus(s: string): s is EmailedStatus {
    return s in STATUS_KEYS;
}

export function renderOrderStatusEmail(data: {
    orderNumber: number | string;
    customerName: string;
    status: string;
    note?: string | null;
    locale?: Locale;
}): string | null {
    if (!isEmailedStatus(data.status)) return null;
    const locale = data.locale ?? "uk";
    const S = EMAIL_STRINGS[locale];
    const cfg = S[STATUS_KEYS[data.status]];
    const ttn =
        data.status === "shipped" && data.note && data.note.trim()
            ? `<p style="font-size:14px; color:#555; margin:0 0 6px;">${esc(S.ttnLabel)}</p>
               <p style="font-size:20px; font-weight:700; letter-spacing:1px; color:#1e4444; margin:0 0 24px;">${esc(
                   data.note.trim(),
               )}</p>`
            : "";
    const bodyHtml = `
        <p style="font-size:16px; line-height:1.6; color:#1a1a1a; margin:0 0 16px;">
            ${S.greeting(esc(data.customerName))}
        </p>
        <p style="font-size:15px; line-height:1.7; color:#555; margin:0 0 16px;">
            <strong>${esc(S.orderEyebrow(data.orderNumber))}</strong> — ${esc(cfg.msg)}
        </p>
        ${ttn}
    `;
    return shell({
        preheader: cfg.subject(data.orderNumber),
        eyebrow: S.orderEyebrow(data.orderNumber),
        title: cfg.title,
        bodyHtml,
        cta: { label: S.toShop, href: `${SITE_URL}${localizePath("/", locale)}` },
        locale,
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
    if (!isEmailedStatus(status)) return;
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

        // Order.locale is raw-SQL territory (column may predate the generated
        // client / the migration) — default uk on any failure.
        let locale: Locale = "uk";
        try {
            const rows = await prisma.$queryRaw<Array<{ locale: string }>>`
                SELECT "locale" FROM "Order" WHERE "id" = ${orderId}
            `;
            const v = rows[0]?.locale;
            if (v === "en" || v === "ru") locale = v;
        } catch {
            // pre-migration DB — Ukrainian email
        }

        const html = renderOrderStatusEmail({
            orderNumber: order.orderNumber,
            customerName: order.customer?.firstName || "Вітаємо",
            status,
            note,
            locale,
        });
        if (!html) return;
        await sendEmail({
            to: email,
            subject: EMAIL_STRINGS[locale][STATUS_KEYS[status]].subject(order.orderNumber),
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
