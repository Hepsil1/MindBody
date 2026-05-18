---
name: ecommerce-cro-principles
description: E-commerce conversion-rate-optimisation principles tailored to MindBody — Ukrainian market, Nova Poshta delivery, COD/online card payments, premium positioning. Distilled from Baymard Institute research, NN/g, and what's actually moved the needle on UA stores. Use when reviewing the PDP, cart, checkout, or any flow where "would this lose me a sale" matters.
---

# E-commerce CRO Principles (MindBody-tuned)

Baymard has 70K hours of UX research on checkout — most of their
findings apply globally. Where Ukrainian-specific patterns matter
(Nova Poshta, Monobank/PrivatBank cues, COD culture), I've noted it.

## Above-the-fold rule of 3 seconds

Within 3 seconds of landing on **the home page**, a visitor must
understand:

1. **What** we sell (clothing for yoga / sport / dance — visible from
   hero image alone)
2. **Why** us (Ukrainian-made, premium fabrics — the value-prop strip)
3. **Where** to go next (clear CTA — "Переглянути колекцію")

Within 3 seconds of landing on **a PDP**, they must see:

1. **Photo** (large, dominant, ideally white background OR lifestyle —
   pick one and be consistent across catalog)
2. **Name** (large enough to read without scrolling)
3. **Price** (with sale comparison if applicable)
4. **Add to cart CTA** (visible without scrolling, even on mobile)

If any of those four require scrolling, conversion drops measurably.

## PDP (product detail page) priority order

Top to bottom, no exceptions:

1. **Gallery** — minimum 4 photos, ≥1 lifestyle photo, ≥1 on-model
   photo. Pinch-to-zoom on mobile. Thumbnails or swipe nav.
2. **Breadcrumbs** (above gallery) — "Головна / Одяг / Костюм" — both
   for SEO and orientation.
3. **Name + brand**.
4. **Price + sale price** (with original struck through if discounted +
   percentage badge).
5. **Color/size selector** — color swatches, size buttons. Out-of-stock
   visibly muted (NOT hidden — see Baymard "Apparel size availability").
6. **Stock signal** — "В наявності" or "Залишилось 2" only when stock
   is genuinely low (creates urgency without being annoying).
7. **Add to cart button** — large, brand-colored, never grey.
8. **"Купити в один клік"** — Ukrainian customers expect this; we
   already have it in checkout flow.
9. **Trust strip** — "Безкоштовна доставка від 2000₴ · Повернення 14
   днів · Українське виробництво" right below CTA.
10. **Description** — collapsed accordion if long; expand by default
    if short (<150 chars).
11. **Care/size table** — accordion. Critical for premium apparel.
12. **Reviews** — 3-5 visible, link to "all reviews".
13. **Related products** — last, not first.

## Cart page priority

1. **List of items** with thumbnail, name, size/color, qty stepper,
   unit price, line total.
2. **Remove** (X button or "Видалити" link, NEVER hidden behind
   "edit" mode).
3. **Promo code** — collapsed by default unless user has used one
   before (Baymard: visible promo field tells unhappy users they're
   missing a deal).
4. **Order summary** — subtotal, shipping (if known), discount (if
   applied), total in large bold.
5. **CTA: Оформити замовлення** — primary color, full width.
6. **Continue shopping** — secondary link.
7. **Trust signals** — payment methods row, return policy, contact.

## Checkout principles

### One page vs multi-step

We're multi-step (Cart / Оформлення / Готово) — that's fine for our
volume. **Don't add more steps.** Baymard: every additional step costs
~10% conversion.

### Guest checkout

**Mandatory.** Already implemented. Email is optional in
`OrderCreateSchema`. Never force account creation before order is
placed.

### Field reduction

Every field is a friction point. We currently ask for: name, email
(optional), phone, city, warehouse. That's good.

**Don't add:**
- Date of birth
- Gender
- Address line 2 (Nova Poshta resolves to warehouses)
- Confirm email
- Confirm password

**Do consider adding:**
- Telegram username (optional, helpful for support contact)
- Postal code (Nova Poshta delivers without it, skip)

### Address entry

For Ukraine: **city autocomplete** + **warehouse autocomplete** beats
manual address fields. We already use Nova Poshta API for this —
keep it. Don't break it.

### Payment methods order

1. **Card online** (Monobank/PrivatBank acquiring) — default for new
   customers if available
2. **Накладений платіж** (COD) — Ukrainian customers expect this,
   pay 30-50₴ extra
3. **Apple Pay / Google Pay** — once integrated, surface for mobile
   users

### Trust signals throughout checkout

- Lock icon next to "Безпечна оплата"
- "Ваші дані захищені, ми не передаємо їх третім особам"
- Express delivery times: "Зазвичай доставка займає 1-3 дні"
- 24/7 support: Telegram + Viber + WhatsApp icons visible in footer
  on every checkout step (we have this — keep it)

## Trust signals (site-wide)

In rough priority of impact:

1. **Real product photography** (lifestyle + flat-lay) — never use
   stock or AI-generated.
2. **Українське виробництво** badge/mention — UA customers strongly
   prefer local brands.
3. **Reviews with photos** — 4+ star avg, "verified purchase" tag.
4. **Return policy visible** in 1 click from any page.
5. **Real contact info** — phone number, address, business hours.
6. **Social proof** — Instagram feed embed (we have this), follower
   count, real customer photos.
7. **Press mentions / partnerships** — if/when relevant.
8. **Stock counts** — only show when genuinely low ("залишилось 2").
   Constant "low stock" everywhere reads as manipulation.

## Pricing display rules

- **Currency**: ₴ symbol AFTER the number with a non-breaking space:
  `1 290 ₴`. Localize with `toLocaleString("uk-UA")`.
- **Sale**: original struck-through, sale price in `--color-marsala`,
  percentage badge top-left of product image.
- **Free shipping threshold**: "Безкоштовна доставка від 2000₴" —
  visible in cart with progress meter ("ще 210 ₴ до безкоштовної
  доставки").
- **No "from" prices** unless the same item has variants at different
  price points.
- **Round prices**: avoid 1289₴; use 1290₴ or 1290₴. Avoids decision
  fatigue.

## Abandoned cart recovery

We don't have this yet. When we do:

- **Hour 1**: nothing (let them think).
- **Hour 24**: gentle reminder email — "Ваш кошик чекає".
- **Day 3**: 5-10% discount code, expires in 48h.
- **Day 7**: stop. Don't be annoying.

Requires customer to be logged in OR to have entered email at checkout
step 1. Don't email guests who never reached the email field.

## Reduce cognitive load

- **One CTA per section.** If a section has "buy now", "add to
  wishlist", "share", and "compare", the user does nothing.
- **Don't ask for opinions during purchase.** "How did you hear about
  us?" goes in post-purchase survey, not checkout.
- **Country-specific copy.** "Зробити замовлення" is more natural for
  UA than "Замовити" (which sounds bureaucratic). Test wording.

## Mobile patterns we should respect

- **Sticky add-to-cart on PDP** (we have it — "ОБЕРІТЬ РОЗМІР" / price
  bar at bottom on mobile).
- **Bottom-sheet drawer** for filters and cart (use `vaul`, already
  installed).
- **Thumb-zone CTAs** — primary action in the bottom third of the
  viewport on mobile.
- **No hovers on mobile** — every state must work with tap.

## Things that look like CRO but actually hurt

- **Countdown timers** ("only 2 hours left!") — feel scammy on premium
  brands. Don't add unless genuinely temporary.
- **Exit-intent popups** with discount codes — train users to abandon
  cart for a discount.
- **"X people bought this in the last hour"** — feels like Amazon,
  not Aesop. Wrong vibe for our positioning.
- **Forced newsletter signup popup** — kills bounce rate. Use inline
  newsletter form in footer instead.
- **Auto-playing video with sound** in hero — instant tab close.

## Metrics to watch (once we have analytics)

In order of importance:

1. **Checkout completion rate** (orders / cart-step-3 entries).
2. **Add-to-cart rate** (carts / PDP views).
3. **PDP conversion rate** (orders containing item X / views of X).
4. **Search use rate** (searches / sessions). High = nav is confusing
   OR users are finding niche items easily — investigate either way.
5. **Repeat purchase rate** (after 90 days, after 1 year).

Don't optimize for: bounce rate alone (premium brands get high
research-mode bouncing — that's fine), page views per session, time
on site.
