---
name: mindbody-design-system
description: Authoritative reference for the MindBody brand — colors, typography, spacing, radii, shadows, motion, z-index. Use whenever building or reviewing UI for the MindBody site so the result matches what's already in `app/app.css`. Pulls from the actual CSS custom properties, so this is the contract, not a suggestion.
---

# MindBody Design System

These tokens live in `app/app.css` as CSS custom properties. **Treat this
file as the source of truth** — if you need a color/spacing/font that
isn't here, propose adding the token first instead of hard-coding.

The brand is "premium wellness" — Cormorant Garamond display headings,
DM Sans body, restrained teal/sliva/marsala palette on a cream
background. Inspirations are Aesop, Lemaire, and high-end yoga retreats,
not loud athletic e-commerce.

## Palette

### Brand

| Token | Hex | When to use |
|---|---|---|
| `--color-primary` | `#2a5a5a` | Main CTAs, links, brand teal. Default action color. |
| `--color-primary-dark` | `#1e4444` | Hover/active on primary, dark UI sections. |
| `--color-primary-light` | `#4a8a8a` | Subtle accents, decorative gradients. |
| `--color-accent` | `#4b3b6b` | Secondary actions, dropdown highlights (sliva/plum). |
| `--color-accent-light` | `#7a6b9b` | Tags, badges where accent is needed but softer. |
| `--color-marsala` | `#722f37` | **Sale/SALE badges only** — never for normal CTAs. |

### Backgrounds

| Token | Hex | Use |
|---|---|---|
| `--color-bg-cream` | `#faf8f6` | Page background. Default. |
| `--color-bg-soft` | `#f4f1ed` | Section alternation, subtle separation. |
| `--color-bg-white` | `#ffffff` | Cards, modals, contrast surfaces. |

### Text

| Token | Hex | Use |
|---|---|---|
| `--color-text-primary` | `#1a1a1a` | Body copy, headings. Default. |
| `--color-text-secondary` | `#555` | Supporting text, captions. |
| `--color-text-muted` | `#666` | Metadata, "added X ago" labels. |
| `--color-text-subtle` | `#777` | Disabled states, breadcrumbs. |
| `--color-text-placeholder` | `#999` | Input placeholders. |
| `--color-text-white` | `#ffffff` | On dark backgrounds only. |

### State

| Token | Hex | Use |
|---|---|---|
| `--color-error` | `#d32f2f` | Validation errors, destructive. |
| `--color-success` | `#2e7d32` | Confirmations, "order placed". |
| `--color-warning` | `#f9a825` | Stock low, action required. |

### Borders

| Token | Hex | Use |
|---|---|---|
| `--color-border` | `#e8e5e1` | Cards, dividers. Default. |
| `--color-border-light` | `#f0ece8` | Subtle separation, table rows. |
| `--color-border-mid` | `#ddd` | Input borders, more visible. |

## Gradients

| Token | Use |
|---|---|
| `--gradient-brand` | Page-scale brand hero (cream → teal). Footer fade. |
| `--gradient-hero` | 135° hero band on landing/about (cream → light-teal → teal). |
| `--gradient-card` | Card hover lift effect (cream → faint teal). |
| `--gradient-values` | Dark section behind value propositions (deep teal). |

## Typography

```
--font-display: "Cormorant Garamond", "Georgia", serif    /* H1-H3, hero */
--font-accent:  "Italiana", "Georgia", serif              /* eyebrow tags */
--font-body:    "DM Sans", system-ui sans-serif           /* everything else */
--font-script:  "Cormorant Garamond" italic               /* "sport wear" tag */
```

**Rules of thumb:**

- **Headings** (H1-H3): Cormorant Garamond, `--leading-tight`,
  `--tracking-tight`. Display sizes from `--text-3xl` upward.
- **H4-H6**: DM Sans, semibold, `--leading-snug`.
- **Body**: DM Sans, regular, `--leading-relaxed`, `--text-base`.
- **Eyebrow / labels**: DM Sans uppercase, `--tracking-widest`,
  `--text-xs`, color `--color-primary`.
- **Italic script flourish** (e.g. "sport wear" under MIND BODY logo):
  Cormorant Garamond italic, used sparingly — once per section max.

### Type scale (rem-based, 16px root)

```
--text-xs:   0.75rem  /* 12px — eyebrow labels, captions  */
--text-sm:   0.875rem /* 14px — fine print               */
--text-base: 1rem     /* 16px — body default             */
--text-lg:   1.125rem /* 18px — emphasized body          */
--text-xl:   1.25rem  /* 20px — small headings           */
--text-2xl:  1.5rem   /* 24px — H4                       */
--text-3xl:  2rem     /* 32px — H3                       */
--text-4xl:  2.5rem   /* 40px — H2 / section titles      */
--text-5xl:  3.5rem   /* 56px — H1                       */
--text-6xl:  4rem     /* 64px — hero display only        */
```

### Line height + letter spacing

```
--leading-none:    1     /* numeric badges, tight UI       */
--leading-tight:   1.1   /* headings                       */
--leading-snug:    1.25  /* sub-headings, dense UI         */
--leading-normal:  1.5   /* utility default                */
--leading-relaxed: 1.6   /* body copy                      */

--tracking-tight:   -0.02em /* large display headings      */
--tracking-normal:   0      /* everything by default       */
--tracking-wide:     0.05em /* small caps labels           */
--tracking-wider:    0.1em  /* uppercase nav, buttons      */
--tracking-widest:   0.2em  /* eyebrow tags, breadcrumbs   */
```

## Spacing

Use the scale — don't reach for arbitrary px.

```
--space-xs:  4px       /* tight: icon ↔ text gap        */
--space-sm:  8px       /* form rows, badges             */
--space-md:  16px      /* default gap                   */
--space-lg:  24px      /* card padding                  */
--space-xl:  32px      /* section internal              */
--space-2xl: 48px
--space-3xl: 64px
--space-4xl: 96px
--space-5xl: 128px
--space-section: 120px /* vertical rhythm between
                         site-wide sections             */
```

## Layout

```
--container-max:     1440px
--container-padding: 80px   /* desktop side gutter      */
--grid-columns:      12
--grid-gutter:       24px
```

Mobile: container padding drops to `var(--space-md)` (16px). Header
becomes `--header-height-mobile: 60px` (vs 80px on desktop).

## Radii

```
--radius-sm:   4px    /* form inputs, small badges     */
--radius-md:   8px    /* default cards, buttons        */
--radius-lg:   16px   /* feature cards                 */
--radius-xl:   24px   /* hero card, special CTAs       */
--radius-full: 9999px /* pills, avatars, FAB           */
```

## Shadows

```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)    /* hairline, hover indicator */
--shadow-md: 0 4px 6px rgba(0,0,0,0.07)    /* default card resting       */
--shadow-lg: 0 10px 25px rgba(0,0,0,0.10)  /* card hover, dropdown       */
--shadow-xl: 0 20px 50px rgba(0,0,0,0.15)  /* modal, drawer              */
```

## Motion

```
--transition-fast:  0.15s ease                      /* hovers       */
--transition-base:  0.3s  ease                      /* page sections */
--transition-slow:  0.5s  ease                      /* hero, drawer */
--transition-spring: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)
                                                    /* pop-ins, like CTAs */
```

Always respect `prefers-reduced-motion` (the `SmartSunParticles` canvas
component already does this — copy that pattern when adding animations).

## Z-index scale

```
--z-dropdown: 100
--z-sticky:   200   /* sticky header on scroll          */
--z-fixed:    300   /* fixed FAB, floating social icons */
--z-modal:    400
--z-popover:  500   /* tooltips, hover popovers         */
--z-tooltip:  600   /* absolute top — error toasts      */
```

If you need a new layer, add a token to `app/app.css` rather than a
literal `z-index: 9999`.

## Component patterns we already have

When building a new UI, check whether one of these existing patterns
fits before inventing a new one:

- **ProductCard** (`app/components/ProductCard.tsx`) — image, name, price,
  optional SALE/NEW badge, hover-flip secondary image, quick view.
- **CategoryCard** (`app/components/CategoryCard.tsx`) — bg image with
  cropped-position support, title, optional subtitle, CTA arrow.
- **HeroSlider** (`app/components/HeroSlider.tsx`) — triptych or single
  layout, auto-advancing, accessible dot navigation.
- **Toast** (`app/components/Toast.tsx`) — success/error/warning/info,
  auto-dismiss. Use via the `useToast()` hook.
- **CartDrawer** (`app/components/CartDrawer.tsx`) — slide-in from right.
- **SmartSunParticles** (`app/components/SmartSunParticles.tsx`) — canvas
  background that pauses on scroll and respects reduced-motion.

## Things to NEVER do

1. **Hard-code a hex or px** in a new component. Use a token.
2. **Introduce a new font family.** We have three; that's the system.
3. **Use marsala (`#722f37`) for anything other than sale states.**
4. **Reach for `z-index: 9999`** — pick a layer token.
5. **Skip `--leading-tight`/`--tracking-tight` on display headings** —
   Cormorant looks loose without them.
6. **Center-align body paragraphs of 3+ lines** — keep them left-aligned;
   center is for short hero strings only.

## Things to ALWAYS do

1. **Mobile-first**: every new style needs a mobile path before desktop
   polish.
2. **Test focus-visible** — the brand teal needs a visible focus ring,
   not invisible "look ma, no outline".
3. **Respect `prefers-reduced-motion`** for any animation > 200ms.
4. **Use `<Link>` from react-router** for in-app navigation, not `<a>`.
5. **Lazy-load images below the fold** with `loading="lazy"` +
   `decoding="async"`.

## Where the design lives

| Layer | File |
|---|---|
| Tokens (this file) | `app/app.css` (top, `:root` block) |
| Global base styles | `app/app.css` (after `:root`) |
| Page-specific | `app/styles/<page>.css` |
| Component scoped | inline `style={{}}` or component-local |

`app/styles/home.css` is the largest (76 KB) — when you need a pattern
that doesn't exist, prefer adding to a small focused file rather than
appending to home.css.
