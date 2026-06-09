# Backlog

Tracked follow-ups, prioritized. P0 (order/stock integrity) is done — see
`docs/deploy-p0-order-stock-integrity.md` and the `stage1: p0 order stock
integrity` commit.

## P1 — do in Stage 1.1 or early Stage 2

### Move idempotency key into the initial order INSERT (or a dedicated table)

**Why:** today `createOrder` (`app/services/order.server.ts`) creates the Order
via typed `tx.order.create(...)` and then sets `idempotencyKey` with a separate
raw `UPDATE` (the typed client can't set the un-regenerated column). There is a
**narrow crash window** between the INSERT and that UPDATE: if the process dies
in between, an order exists with `idempotencyKey = NULL`, so a client retry with
the same key would not dedupe and could create a duplicate order.

The fast-path pre-check + the `idempotencyKey` unique index cover the normal
double-submit / concurrent cases (verified in `scripts/p0-e2e.mjs`), so this is
**not COD-blocking** — but it must be closed before relying on idempotency under
crash/retry storms.

**Options:**

- A. After `prisma generate` (see deploy note §4–5), write `idempotencyKey` in the
  same typed `tx.order.create(...)` — one statement, atomic. (Simplest.)
- B. Keep raw SQL but do a single raw `INSERT INTO "Order" (..., "idempotencyKey")`
  with `ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING id`, then insert items.
- C. Dedicated `IdempotencyKey` table written _before_ order creation (reserve →
  create → mark), for a fuller idempotency story across all mutating endpoints.

**Recommendation:** A once the client is regenerated; B if it must ship before that.

### Use the readable slug as the canonical product URL (kill the UUID "code" in URLs)

**Problem (reported):** product URLs on the site are `/product/<uuid>` — a long
hex "code" — everywhere customers see them. Slugs already exist and transliterate
Cyrillic→Latin correctly (`app/utils/slugify.ts`: "Лонгслів CALM" → `lonhsliv-calm`,
auto-generated on save via `ensureUniqueSlug`), but the slug is used **only** as a
301 entry point: `/p/<slug>` → 301 → `/product/<uuid>`. So the pretty URL never sticks.

**Current state (code):**

- Links use `/product/<id>`: `components/ProductCard.tsx` (×2), `product.$id.tsx`
  related cards + `canonical`, `wishlist.tsx`, `components/Header.tsx`,
  `shop.$category(.$subcategory).tsx` JSON-LD.
- `p.$slug.tsx` redirects slug → `/product/<id>` (the wrong direction for pretty URLs).
- `sitemap` already prefers `/p/<slug>`.

**Recommended approach (Option A):**

1. Serve the PDP at `/p/<slug>` (move/share the `product.$id.tsx` loader+component);
   make `/product/<id>` a 301 → `/p/<slug>` (reverse of today) for back-compat with
   existing UUID links/bookmarks.
2. Set `canonical` + OG/JSON-LD `url` to `/p/<slug>`.
3. Update link sources to `/p/<slug>` — requires threading `slug` into every product
   **card** payload (shop/home/search/related/wishlist/header loaders).

**Caveats / why it's its own increment (not bolted onto P0/state-machine):**

- Wishlist & cart persist products in **localStorage by id** — slug must be added to
  the stored shape or resolved on render, or links fall back to `/product/<id>` (the
  301 covers it, but for an instant pretty URL the slug should be in the card data).
- Touches many loaders + components → needs its own verification pass (Playwright:
  card → pretty URL, old UUID link → 301, canonical correct, wishlist link works).

Priority **P2** (SEO/UX, customer-visible, not revenue/data-blocking).

**DONE (stage2)** — implemented per Option A. PDP now lives at `/p/<slug>`;
`/product/<id>` 301-redirects active products to their slug URL (404 for
draft/archived/missing/no-slug); canonical + JSON-LD use `/p/<slug>`; all catalog
cards (shop/subcategory/search/home/related), the wishlist (via `/api/products/slugs`

- `useProductSlugs`, still storing id), and the header search dropdown link to
  `/p/<slug>`. Verified by `scripts/slug-url-e2e.mjs` (11/11) + Playwright.

> **PROD DEPLOY (required):** run `node -r dotenv/config scripts/backfill-slugs.mjs`
> against prod so every existing product gets a slug — otherwise active products
> with a null slug 404 on `/product/<id>` and their cards fall back to a 404 link.
> New products get a slug automatically on save.

## Done

### Normalize empty email string to undefined before checkout validation — DONE (stage1)

`OrderCustomerSchema.email` previously rejected `email: ""` (`.email()` ran before
`.optional().default("")`). Fixed with a `z.preprocess` that maps empty/whitespace
to `undefined` so guest checkout (no email) validates. Test:
`tests/unit/validation.test.ts` → "accepts a guest with an empty email string".

## Stage 2 — scope (next, after P0 commit)

Allowed:

- Prisma/TS/Zod **enum** statuses (product / order / payment) + backfill of existing string values.
- **Order state-machine** (allowed transitions, confirmation on cancel/return, history already in place).
- **`/admin/categories`** route — extract Category CRUD + reorder out of the `slides.tsx` monolith.
- **InventoryMovement UI** (admin journal) + manual stock adjustment flow.
- Product **quality checklist** (block publish when price/photo/category/stock/fabric/sleeve missing).
- **SVG/upload hardening** (allowlist or serve as `application/octet-stream`).

Explicitly **NOT** in Stage 2 (do not start):

- ProductVariant, RBAC, dashboard widgets, analytics, large redesign, big checkout/slides refactor.
