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
