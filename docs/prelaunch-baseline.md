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
