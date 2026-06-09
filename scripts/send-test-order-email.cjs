// One-off: send the production order-confirmation template to a test address.
// Run: node scripts/send-test-order-email.cjs
//
// Renders the same HTML as app/utils/email.server.ts → renderOrderConfirmation
// so the test recipient sees exactly what a real customer would after checkout.

require("dotenv/config");
const { Resend } = require("resend");

const TO = "pepsig8778@gmail.com";

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPE[c]);
const money = (n) => `${(n || 0).toLocaleString("uk-UA")} ₴`;

const SITE_URL = process.env.SITE_URL || "https://saleid.icu";
const FROM_EMAIL = process.env.EMAIL_FROM || "hello@saleid.icu";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "MIND BODY";
const REPLY_TO = process.env.EMAIL_REPLY_TO || FROM_EMAIL;

const data = {
    orderNumber: 10042,
    customerName: "Тестовий Клієнт",
    items: [
        { name: "Комбінезон Brown Velvet", quantity: 1, price: 1990, size: "M", color: "Шоколад" },
        { name: "Топ Aurora Sand", quantity: 2, price: 690, size: "S", color: "Пісок" },
    ],
    deliveryMethod: "Нова Пошта — відділення",
    deliveryAddress: "м. Київ, відділення №3 (вул. Хрещатик, 22)",
    paymentMethod: "Оплата при отриманні (накладений платіж)",
};
data.total = data.items.reduce((s, it) => s + it.price * it.quantity, 0);

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
          <td style="padding:12px 0; border-bottom:1px solid #f0ede9; text-align:center; color:#555;">${it.quantity}</td>
          <td style="padding:12px 0; border-bottom:1px solid #f0ede9; text-align:right; font-weight:600;">${money(it.price * it.quantity)}</td>
        </tr>`,
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
    <div style="margin-top:24px; padding:16px; background:#faf8f6; border-radius:12px;">
        <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin-bottom:6px;">Доставка</div>
        <div style="font-size:14px; color:#1a1a1a;">${esc(data.deliveryMethod)}<br>${esc(data.deliveryAddress)}</div>
    </div>
    <div style="margin-top:12px; padding:16px; background:#faf8f6; border-radius:12px;">
        <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#888; margin-bottom:6px;">Оплата</div>
        <div style="font-size:14px; color:#1a1a1a;">${esc(data.paymentMethod)}</div>
    </div>
    <p style="font-size:13px; color:#888; line-height:1.6; margin:24px 0 0;">
        Якщо щось не так — просто дай нам знати, відповівши на цей email.
    </p>`;

const html = `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Дякуємо за замовлення</title>
  </head>
  <body style="margin:0; padding:0; background:#faf8f6; font-family:'Helvetica Neue', Arial, sans-serif; color:#1a1a1a;">
    <span style="display:none !important; visibility:hidden; opacity:0; max-height:0; overflow:hidden;">Замовлення №${esc(data.orderNumber)} прийнято. Сума: ${money(data.total)}.</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(20,40,40,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#2a5a5a 0%,#1e4444 100%); padding:32px 32px; text-align:center;">
                <div style="color:rgba(255,255,255,0.7); font-size:11px; letter-spacing:0.3em; text-transform:uppercase; margin-bottom:8px;">Замовлення №${esc(data.orderNumber)}</div>
                <div style="font-family:'Cormorant Garamond', Georgia, serif; color:#ffffff; font-size:28px; line-height:1.2; letter-spacing:-0.01em;">Дякуємо за замовлення</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
                <div style="text-align:center; margin-top:32px;">
                  <a href="${esc(SITE_URL)}/profile" style="display:inline-block; background:#2a5a5a; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:999px; font-weight:600; letter-spacing:0.02em;">Подивитись на сайті</a>
                </div>
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

(async () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error("RESEND_API_KEY missing in .env");
        process.exit(1);
    }
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: TO,
        subject: `[TEST] Замовлення №${data.orderNumber} прийнято — MIND BODY`,
        html,
        replyTo: REPLY_TO,
        tags: [{ name: "type", value: "test_order_confirmation" }],
    });
    if (res.error) {
        console.error("FAIL:", JSON.stringify(res.error, null, 2));
        process.exit(2);
    }
    console.log("OK id=" + res.data?.id + " to=" + TO);
})();
