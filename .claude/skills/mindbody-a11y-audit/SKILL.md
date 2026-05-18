---
name: mindbody-a11y-audit
description: WCAG 2.2 AA accessibility checklist focused on what actually breaks for MindBody users — keyboard nav, color contrast against the cream/teal palette, screen-reader paths through checkout, focus management in modals/drawers. Use when reviewing or building any UI that customers touch (PDP, cart, checkout, auth). Skip for admin pages.
---

# MindBody Accessibility Audit

WCAG 2.2 AA is the bar for Ukrainian e-commerce (and basic decency). This
skill is the checklist I run through before saying "ship it" on any
customer-facing change.

## The 7 checks I always run

### 1. Keyboard-only walkthrough

Unplug the mouse. Tab through the page. The flow should be:

- Skip link (the "Перейти до контенту" link in `app/root.tsx`) is the
  **first** tab stop. If not, you broke it.
- Every interactive element gets focus.
- Focus order matches visual order (top→bottom, left→right).
- No focus trap unless the element is a modal/drawer (then trap is
  required AND Escape must close).
- Visible focus ring on every element: 2-3px outline, brand teal
  (`var(--color-primary)`) or white on dark sections.

**Common breaks:** `<div onClick>` without `role="button"` + tabindex,
custom dropdowns that don't trap focus, modals that don't return focus
to the trigger on close.

### 2. Color contrast against our palette

Use the WCAG contrast formula. Our background is `--color-bg-cream`
(`#faf8f6`).

| Foreground | On cream | Verdict |
|---|---|---|
| `--color-text-primary` `#1a1a1a` | 18.5:1 | ✅ |
| `--color-text-secondary` `#555` | 7.6:1 | ✅ |
| `--color-text-muted` `#666` | 5.8:1 | ✅ |
| `--color-text-subtle` `#777` | 4.5:1 | ⚠ exactly at threshold, only for ≥18px text |
| `--color-text-placeholder` `#999` | 2.8:1 | ❌ decorative only |
| `--color-primary` `#2a5a5a` | 6.7:1 | ✅ for links/CTAs |

**Rules:**

- Body text (≤17px regular): contrast ≥ 4.5:1.
- Large text (≥18px regular OR ≥14px bold): ≥ 3:1.
- Non-text UI (focus rings, form borders): ≥ 3:1.
- Never use `#999` placeholder color as actual content.

**Marsala on cream:** `#722f37` on `#faf8f6` = 7.9:1 ✅, so SALE badges
are fine.

### 3. Form fields

For every input/textarea/select in checkout, auth, contact:

- [ ] Has a `<label>` (visible or `.visually-hidden`, not just placeholder)
- [ ] `id`/`for` link the label to the input
- [ ] `autocomplete` attribute set: `email`, `tel`, `name`, `street-address`,
      `postal-code`, `cc-number`, `current-password`, `new-password`
- [ ] `inputmode` set on numeric fields (`tel`, `numeric`, `decimal`)
- [ ] Error messages have `aria-describedby` linking input to message
- [ ] Required fields have `aria-required="true"` (or `required`)
- [ ] Invalid fields have `aria-invalid="true"` during error state
- [ ] Phone formatter doesn't strip leading `+` for international users

**Ukrainian phone**: pattern `+380 (XX) XXX-XX-XX`. `inputmode="tel"`.
`autocomplete="tel"`.

### 4. Images

- [ ] **Decorative** images: `alt=""` (empty, not missing).
- [ ] **Product** images: `alt="<product name>, view N"`.
- [ ] **Logo**: `alt="MIND BODY"`.
- [ ] **Hero/Section background images**: usually decorative, but if it
      carries info ("sale poster"), describe the offer.
- [ ] No `alt="image"`, `alt="picture"`, `alt="<filename>"`.
- [ ] `<img>` has explicit `width`/`height` to prevent layout shift.

### 5. Screen reader paths

Use NVDA or VoiceOver. Listen to these flows end-to-end:

**Add-to-cart flow:**
"Product Name, link" → "Choose size, group" → "Size M, radio, not
selected" → "Add to cart, button" → "Toast: Added to cart" announced
via `aria-live="polite"`.

**Checkout flow:**
Each step's heading announced. Form errors announced via
`aria-live="assertive"` region. Order total updates announced when
qty changes.

**Auth flow:**
Login form labeled, error "Невірний email або пароль" reaches the
screen reader (we did this via API JSON → toast).

### 6. Focus management in dynamic UI

| Component | Required behaviour |
|---|---|
| Cart drawer opens | Focus moves to drawer close button or first interactive |
| Cart drawer closes | Focus returns to "cart" trigger button |
| Modal opens | Focus moves into modal, trapped inside |
| Modal closes (Escape OR backdrop click) | Focus returns to trigger |
| Toast appears | NOT moved (toast is polite, not assertive) |
| Validation error appears | Focus moves to FIRST invalid field |
| Page navigates client-side | Focus moves to `<main>` or h1, scroll resets |

The `vaul` and `sonner` libraries (already installed, see Phase 6 plan)
handle most of this — when integrating, double-check focus behaviour
with keyboard.

### 7. Touch targets (mobile-specific)

- Minimum 44 × 44 CSS px (Apple HIG) / 48 × 48 dp (Material).
- 8px minimum gap between adjacent targets.
- Hamburger button, social icons, cart icon, search icon all need to
  meet this. (Header already does, but easy to break when adding new
  icons.)

## Quick tools

### Manual

- **Lighthouse** (Chrome DevTools → Lighthouse → Accessibility) — run on
  /, /product/<id>, /checkout. Target score ≥ 95.
- **axe DevTools** browser extension — catches things Lighthouse misses
  (ARIA misuse).
- **NVDA** (Windows) or **VoiceOver** (Mac) — actually use the site
  with eyes closed.

### Programmatic (suggested for future)

- `eslint-plugin-jsx-a11y` — catches obvious mistakes at lint time.
  Easy add for Phase 7.
- `@axe-core/playwright` — automated a11y assertions in E2E tests.

## E-commerce-specific WCAG 2.2 gotchas

These are the patterns that hit our exact flow:

**Cart quantity steppers** — `<button aria-label="Increase quantity">`
+ `<input type="number" aria-label="Quantity">`. Don't replace input
with non-interactive `<span>`.

**Sale price** — when displaying both original (struck-through) and
sale price, mark the original with `<s>` AND wrap the sale price with
`aria-label="Sale price 990 hryvnia, was 1390 hryvnia"`. Screen readers
otherwise read "1,390 990" with no context.

**Size selector** — radio group, NOT a button group. Out-of-stock
sizes get `aria-disabled="true"` + visible style, but stay in DOM so
screen readers know they exist.

**Filters/facets** — use checkboxes, not custom toggles. Group with
`<fieldset><legend>Категорія</legend>`. Live result count announced
via `aria-live="polite"`.

**Free shipping threshold** — "До безкоштовної доставки ще 210 ₴" must
be in the DOM, not in a CSS pseudo-element. Otherwise screen readers
don't announce progress when total changes.

**Order confirmation** — after success, focus moves to "Замовлення №X
прийнято" heading. Confirmation number is the first reading target.

## Things I will NEVER skip on a customer-facing PR

1. Tab through the new UI keyboard-only.
2. Check contrast on every new color/text combination.
3. Confirm all `<img>` have explicit alt (or `alt=""` if decorative).
4. Verify focus management if there's a modal/drawer/popover.
5. Run Lighthouse Accessibility on the page; report the score.

## Open audits to schedule

These haven't been done end-to-end yet:

- Full Lighthouse run on every public route (we have ~46 routes).
- Screen reader pass through checkout with a real Nova Poshta address.
- Mobile keyboard test (Android Talkback + iOS VoiceOver).
- Contrast check on admin panel dark theme (separate from public site).
