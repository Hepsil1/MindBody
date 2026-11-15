# MIND BODY — Design System Specification (DESIGN.md)

> **Brand Identity:** Quiet Luxury Athletic & Yoga Wear (Made in Ukraine)  
> **Philosophy:** Understated elegance, body-conscious architecture, supreme fabric tactility, flawless technical execution.  
> **Standard:** Refero Styles Design Specification for AI Agents & Engineers.

---

## 1. Color Palette & Harmony

### Primary & Core Tones

- `--color-bg-canvas`: `#FAF8F5` (Warm Cream / Alabaster — foundational light canvas)
- `--color-surface-pure`: `#FFFFFF` (Pure White — elevated cards, modals, sheets)
- `--color-surface-translucent`: `rgba(255, 255, 255, 0.82)` (Frosted glass backdrops)
- `--color-text-primary`: `#0B0B0C` (Deep Graphite / Charcoal — high contrast readability)
- `--color-text-secondary`: `rgba(11, 11, 12, 0.65)` (Subtle editorial descriptions)
- `--color-text-muted`: `rgba(11, 11, 12, 0.42)` (Microcopy, timestamps, breadcrumbs)

### Brand Signature Accents

- `--color-brand-teal`: `#2A5A68` (Signature Nordic Teal — primary buttons, active swatches, key links)
- `--color-brand-teal-hover`: `#204550` (Deep Teal hover state)
- `--color-brand-teal-soft`: `rgba(42, 90, 104, 0.08)` (Subtle pill backgrounds & active rings)
- `--color-brand-plum`: `#5A2C3E` (Deep Plum / Marsala — secondary collection accent)
- `--color-brand-plum-soft`: `rgba(90, 44, 62, 0.08)` (Plum highlight tint)

### Functional & Feedback Tones

- `--color-border-subtle`: `rgba(11, 11, 12, 0.08)` (Crisp border dividers)
- `--color-border-hover`: `rgba(42, 90, 104, 0.28)` (Interactive element border)
- `--color-scarcity`: `#B45309` (Warm Amber / Terracotta — tasteful scarcity badge)
- `--color-scarcity-bg`: `rgba(245, 158, 11, 0.09)` (Scarcity badge surface)
- `--color-success`: `#15803D` (Forest Green — order success, verified inventory)
- `--color-error`: `#B91C1C` (Crimson — validation errors)

---

## 2. Typography Hierarchy (Onest)

The brand exclusively employs **Onest** (sans-serif) for its humanist geometric rhythm, balanced apertures, and immaculate Cyrillic/Latin glyph design.

| Level                 | Size / Line-Height | Weight | Letter-Spacing | Usage                                       |
| :-------------------- | :----------------- | :----- | :------------- | :------------------------------------------ |
| **Hero Display**      | 48px – 64px / 1.1  | 400    | -0.02em        | Hero headline, editorial covers             |
| **Section Title**     | 28px – 34px / 1.2  | 500    | -0.015em       | Catalog headings, Complete the Look         |
| **Product Title**     | 24px – 28px / 1.25 | 600    | -0.01em        | PDP main title                              |
| **Subtitle / Kicker** | 11px – 13px / 1.4  | 700    | +0.14em        | Uppercase kickers (`ДОПОВНИТИ ОБРАЗ`)       |
| **Body Large**        | 16px – 18px / 1.55 | 400    | normal         | Main editorial descriptions, PDP accordions |
| **Body Regular**      | 14px – 15px / 1.5  | 400    | normal         | Cart item descriptions, forms, inputs       |
| **Caption / Fine**    | 12px – 13px / 1.4  | 500    | +0.02em        | Specs, shipping notes, size chips           |
| **Micro Badge**       | 10px – 11px / 1.2  | 600    | +0.08em        | NEW, SALE, Scarcity badges                  |

---

## 3. Spatial System, Radii & Shadows

### Spatial Grid (8pt System)

- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-6`: 24px
- `space-8`: 32px
- `space-12`: 48px
- `space-16`: 64px
- `space-20`: 80px

### Border Radii

- `radius-xs`: 4px (micro badges, tags)
- `radius-sm`: 8px (form inputs, size chips)
- `radius-md`: 12px (dropdowns, small cards)
- `radius-lg`: 16px (product cards, modals, complete-the-look cards)
- `radius-xl`: 24px (featured hero containers, notification banners)
- `radius-pill`: 9999px (action pills, category filter tags, CTA buttons)

### Elevation & Soft Shadows

- `shadow-sm`: `0 2px 8px rgba(11, 11, 12, 0.04)`
- `shadow-md`: `0 8px 24px rgba(42, 90, 104, 0.08)`
- `shadow-lg`: `0 16px 40px rgba(42, 90, 104, 0.12)`
- `shadow-floating`: `0 20px 48px -10px rgba(11, 11, 12, 0.18)` (Sticky bars & drawers)
- `backdrop-blur`: `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`

---

## 4. Component Design Contracts

### Primary CTA Button (`.btn-primary`)

- Height: 48px (52px on mobile for touch comfort).
- Background: `#2A5A68`, Color: `#FFFFFF`.
- Hover: `#204550`, Transform: `translateY(-1px)`, Shadow: `0 8px 20px rgba(42, 90, 104, 0.25)`.
- Active: Transform: `translateY(0)`, Shadow: none.
- Border radius: 12px (or 9999px for pill variant).

### Secondary Button (`.btn-secondary`)

- Height: 48px.
- Background: `transparent`, Color: `#2A5A68`, Border: `1px solid rgba(42, 90, 104, 0.3)`.
- Hover: `background: rgba(42, 90, 104, 0.05)`, Border: `rgba(42, 90, 104, 0.6)`.

### Scarcity Badge (`.scarcity-badge`)

- Subtle amber tint (`#B45309`), background `rgba(245, 158, 11, 0.09)`, border `1px solid rgba(245, 158, 11, 0.2)`.
- Content: _«Останній екземпляр у розмірі [S]»_ or _«Залишилось лише [N] од.»_.
- Placement: directly adjacent to size selector or above buy CTA.

### Mobile Sticky Bar (`.mobile-sticky-actions`)

- Fixed bottom, `z-index: 90`.
- Background: `rgba(255, 255, 255, 0.94)`, `backdrop-filter: blur(16px)`.
- Top border: `1px solid rgba(11, 11, 12, 0.08)`.
- Safe area inset support: `padding-bottom: max(12px, env(safe-area-inset-bottom))`.

---

## 5. Micro-Interactions & Motion Principles

1. **Duration & Easing:**
    - Standard transitions: `0.25s - 0.35s`.
    - Bezier curve: `cubic-bezier(0.16, 1, 0.3, 1)` (silk-smooth deceleration).
2. **Silk Cart Feedback:**
    - On adding an item, the bag icon executes a scale bounce `1 -> 1.25 -> 0.95 -> 1` over `400ms`.
    - Cart counter badge scales in with fade.
3. **Card Lift:**
    - Product cards lift `-4px` on hover with transition to `shadow-md`.
    - Image scales `1 -> 1.04` within overflow hidden container.
4. **Number Ticker:**
    - Price updates fade and slide vertically by `4px` rather than abrupt jumps.

---

## 6. Language & Copy Guidelines

- **Primary language:** Ukrainian (`uk`), strictly authentic, elegant, literate.
- **Tone:** Professional, respectful, confident, body-positive (_«Створено для повної свободи рухів»_).
- **Prohibited:** Aggressive sales pressure, clickbait countdown clocks, misleading "free shipping" claims (strictly: _«За тарифами перевізника "Нова Пошта"»_).
