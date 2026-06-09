# Pre-launch migration baseline (2026-06-09)

Before launch the migration history was rebuilt into a **single clean UTF-8
baseline**, because the prior history was unusable:

- `mindbody_db` (prod) was created entirely with `prisma db push` — it had **no
  `_prisma_migrations` ledger at all**, so `prisma migrate deploy` had never run.
- The old `20260101000000_init` migration was **UTF-16 LE**, which makes
  `migrate deploy` fail with P3015 on any fresh DB.
- The history was **incomplete**: `Product.slug/metaTitle/metaDescription/fabric/
sleeve` and `Category.moodType` were applied out-of-band (db push) with no
  migration file, so the migrations did not reproduce the real schema.

## What was done

1. Archived the three old migrations to `prisma/migrations_archive/` (kept, not
   deleted) + recorded the exact prod delta in
   `prisma/migrations_archive/applied_prod_delta_20260609.sql`.
2. Generated one UTF-8 baseline from `schema.prisma`:
   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
--script` → `prisma/migrations/0_init/migration.sql` (+ `migration_lock.toml`).
   Validated: applies cleanly to an empty DB, and
   `migrate diff --from-url <fresh> --to-schema-datamodel` = _empty_ (no drift).
3. Brought prod up to the schema with the **purely additive** delta (Order P0
   columns + `InventoryMovement` + `OrderStatusHistory` + indexes/FK) applied via
   `psql`. Verified `migrate diff --from-url <prod> --to-schema-datamodel` = empty.
4. Baselined the ledger: `prisma migrate resolve --applied 0_init` →
   `_prisma_migrations` created, `migrate status` = **up to date**.
5. `prisma generate` re-run (typed client now knows InventoryMovement /
   OrderStatusHistory / Order P0 fields / Product slug,fabric,sleeve / Category
   moodType — the raw-SQL crutch is now optional, not required).
6. Backfilled `Product.slug` for the 35 legacy rows (47/47 unique, 0 missing).
7. Cleared **test** operational data only — `Order`, `OrderItem`, `Customer`,
   `InventoryMovement`, `OrderStatusHistory` truncated. Catalog/content preserved
   (Product 47, Category 6, ShopPage 6, Slide 1, Review 9, PromoCode 3,
   FilterConfig 1, NewsletterSubscriber 11).

## Going forward

- `prisma migrate deploy` now works on fresh DBs (CI / new VPS) — one UTF-8
  baseline reproduces the full schema.
- Future schema changes: `prisma migrate dev --name <change>` (no more db push,
  no more hand-written psql migrations).
- Backups taken before the operation: `backups/mindbody_db_*.sql.gz` (nightly +
  one pre-op) and `backups/prelaunch_full.sql` (raw).

## Verification (2026-06-09, post-deploy)

Deploy = `scripts/deploy.ps1` (image variants → react-router build → `pm2 restart
mindbody` → smoke). Build clean, PM2 online, entry chunk 200.

- **migrate deploy proof**: a fresh `mindbody_test` brought up purely with
  `prisma migrate deploy` (0_init) — "All migrations have been successfully
  applied." (The thing that was broken before now works.)
- **Prod public smoke**: `/`, `/shop/*`, `/p/<slug>`, `/checkout`, `/wishlist`,
  `/faq`, `/about`, `/admin` → 200; `/product/<id>` → 301 → `/p/<slug>`; cards
  link only to `/p/<slug>`; canonical + JSON-LD correct; sitemap lists `/p/<slug>`;
  headers OK (HTML no-cache, assets immutable, HSTS, X-Frame-Options).
  (`/cart` 404 is expected — cart is a `CartDrawer` overlay, not a route.)
- **Prod admin walkthrough** (`scripts/_prelaunch_admin_walk.mjs`, read-only):
  10/10 admin pages render with a real session (products/orders/categories/
  inventory/slides/shop-pages/reviews/promo/customers).
- **Functional lifecycle** (against fresh `mindbody_test` + dev server, current
  committed code, schema verified identical to prod): p0 24/24, product-quality
  4/4, categories 7/7, inventory 10/10 — order atomicity, stock decrement +
  InventoryMovement, idempotency, oversell protection, cancel→restore, paid-delete
  guard, status state-machine + history, publish-quality gate, image→webp.

Note: the slug-URL harness shows 2 "failures" that are false negatives — it picks
a product via `findFirst` that lands on shop page 2 (the listing paginates via
`slice(0, displayCount)`), so the rendered HTML / top search results don't include
that exact product. The feature itself is verified working manually.
