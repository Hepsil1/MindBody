# Deploy note — P0 order/stock integrity (stage1)

This change adds new DB objects (`InventoryMovement`, `OrderStatusHistory`,
`Order.idempotencyKey / appliedPromoCode / discountAmount / emailStatus`) and
new server code that reads/writes them **via raw SQL** (the Prisma client could
not be regenerated — see §3). Deploying it safely needs a short maintenance
window. Read this before pushing to prod (`mindbody_db`, PM2 `mindbody` on :3000).

---

## 1. Why you must not run a bare `react-router build` over the live `build/`

The running PM2 `mindbody` process holds the **asset manifest in memory** and
serves hashed chunks from `build/client/assets/`. `react-router build` **deletes
and regenerates** those files with new content hashes. If you build **without
immediately restarting PM2**, the still-running old process serves HTML that
references chunk filenames that no longer exist on disk → 404 → the "permanent
loading screen" bug (the `root.tsx` 4s backstop only hides the symptom).

**Rule:** build and PM2 restart must happen together. Use `scripts/deploy.ps1`
(it builds, then restarts PM2). Never run `npm run build` / `react-router build`
standalone against a live, un-restarted server. (This is why the P0 work was
verified on a separate dev server on :3001 instead of building.)

## 2. Apply the SQL migration with `psql` (NOT `prisma migrate deploy`)

The migration is additive + idempotent (`IF NOT EXISTS`, inline FK):
`prisma/migrations/20260601130000_p0_order_stock_integrity/migration.sql`.

```powershell
# In the maintenance window, after backing up the DB:
$env:PGPASSWORD = "<prod db password>"   # or read from .env like backup-db.ps1
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -p 5432 -U postgres `
    -d mindbody_db `
    -f prisma\migrations\20260601130000_p0_order_stock_integrity\migration.sql
```

It is safe to re-run (no data loss, no-ops if already applied).

## 3. Why `prisma migrate deploy` is currently broken (P3015)

`prisma/migrations/20260101000000_init/migration.sql` is **UTF-16 encoded** (a
PowerShell `Out-File` artifact). `prisma migrate deploy` can't read it and aborts
with **P3015 "Could not find the migration file"** — even though `_init` is
already applied on prod. So we apply new migrations by hand with `psql -f`.

Optional, to keep `_prisma_migrations` consistent for future tooling, mark the
new migration as applied after running it:

```sql
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid(), '', now(), '20260601130000_p0_order_stock_integrity', now(), 1)
ON CONFLICT DO NOTHING;
```

(Fixing the UTF-16 init file is a separate clean-up — re-baselining migrations —
and is tracked in `docs/backlog.md`.)

## 4. Regenerate the Prisma client in the maintenance window

The new tables/columns are accessed via raw SQL **only because** PM2 holds the
query-engine DLL (`node_modules/.prisma/client/query_engine-windows.dll.node`),
so `prisma generate` can't overwrite it. In the maintenance window, with PM2
already stopped for the deploy:

```powershell
& "$env:APPDATA\npm\pm2.cmd" stop mindbody    # frees the DLL lock
npx prisma generate                           # regenerate typed client
# ...deploy/build...
& "$env:APPDATA\npm\pm2.cmd" start mindbody    # or restart
```

## 5. After `generate`: drop the raw SQL

Once the client is regenerated it knows the new models, so the raw SQL can be
replaced with typed access (optional clean-up, not required for correctness):

- `app/services/order.server.ts` — `idempotencyKey/appliedPromoCode/discountAmount`
  `UPDATE`, the dedupe `SELECT`, and the `OrderStatusHistory` insert → typed
  `tx.order.update(...)` / `tx.orderStatusHistory.create(...)`.
- `app/services/inventory.server.ts` — `writeMovement` raw insert →
  `tx.inventoryMovement.create(...)`.
- `app/routes/admin/orders/$id.tsx` — loader raw `SELECT` of emailStatus/history,
  `writeHistory` insert → typed.

Keep the pure `planOrderDecrement` / `computeDiscount` helpers (they're unit-tested).

## 6. Maintenance-window order of operations

1. `npm run backup:db` (fresh dump).
2. `psql -f ...migration.sql` against `mindbody_db` (§2). Verify the new tables exist.
3. `pm2 stop mindbody` → `npx prisma generate` (§4).
4. Deploy code via `scripts/deploy.ps1` (build + `pm2 restart`/`start`) (§1).
5. Smoke-check: place a test order on the live site → order in `/admin/orders`,
   stock decremented, an `InventoryMovement` row written; cancel it → stock restored.
6. (Optional) replace raw SQL with typed access (§5) in a follow-up PR.

## Rollback

- Code: `git revert` the stage1 commit (or redeploy the previous build).
- DB: the migration is additive — leaving the new columns/tables in place is
  harmless even on old code. If you must remove them, restore the pre-deploy
  dump from `backups/`.
