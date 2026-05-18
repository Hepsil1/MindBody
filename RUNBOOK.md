# MindBody Operations Runbook

Quick-reference for running, deploying, recovering, and rotating MindBody
on the Windows VPS. This is the document I wish existed when saleid.icu
showed an infinite loading screen on 2026-05-18 — keep it tidy.

---

## Architecture in one paragraph

`saleid.icu` resolves via Cloudflare → Caddy (PM2 service `caddy`) on the
VPS, which `reverse_proxy`s to a React Router 7 server on `localhost:3000`
(PM2 service `mindbody`). The React Router server reads PostgreSQL via
Prisma (`mindbody_db` on `localhost:5432`). Static client assets are
served by Caddy directly from `C:\mindbody\build\client\`.

PM2 keeps both services running and survives reboots via Windows Task
Scheduler (see `scripts/start.bat` — owned by user).

---

## Deploy

**Always use the script — never raw `npm run build` on the VPS** (that's
how we caused the 2026-05-18 loading-screen incident: assets rotated
under PM2's feet).

```powershell
npm run deploy
# or:
pwsh scripts/deploy.ps1
```

The script:

1. Checks PM2 has the `mindbody` process and the git tree is clean.
2. `npx react-router build` (skips `prisma generate` because PM2 holds
   the Prisma DLL; generate manually after schema changes — see below).
3. `pm2 restart mindbody --update-env`.
4. Curls `https://saleid.icu`, parses `entry.client-*.js` out of the
   HTML, and confirms it returns 200. If not, you have an asset/manifest
   mismatch — re-run the script.

If a step fails, PM2 keeps the previous process — there's no half-way
state.

---

## Rollback

**Code:**

```powershell
git revert <bad-sha>      # or
git reset --hard <good-sha>
npm run deploy
```

**Database (if a migration broke things):**

```powershell
# 1. Pick the most recent good backup
ls C:\mindbody\backups\mindbody_db_*.sql.gz | Sort-Object LastWriteTime -Descending

# 2. Restore into a *fresh* DB first to confirm it works (NEVER restore
#    over the live one until you've validated):
$env:PGPASSWORD = "<from .env>"
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -h localhost -U postgres mindbody_db_restore
gzip -d -c C:\mindbody\backups\mindbody_db_<ts>.sql.gz | & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U postgres -d mindbody_db_restore

# 3. Spot-check counts:
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -d mindbody_db_restore -c "SELECT count(*) FROM `"Order`""

# 4. Only then swap DATABASE_URL in .env to point at the restore, or
#    drop and rename:
#    DROP DATABASE mindbody_db_old;  ALTER DATABASE mindbody_db RENAME TO mindbody_db_old;  ALTER DATABASE mindbody_db_restore RENAME TO mindbody_db;
# 5. pm2 restart mindbody
```

---

## Backups

**Manual run:**

```powershell
npm run backup:db
# or:
pwsh scripts/backup-db.ps1
```

Produces `C:\mindbody\backups\mindbody_db_<YYYYMMDD_HHmmss>.sql.gz`,
gzip-compressed. Retention: last 7 days, older dumps pruned
automatically.

**Nightly automation (scheduled task):**

The task is registered as `MindBody DB Backup`, runs daily at 03:00 as
`SYSTEM`. If it ever fails (`schtasks /query /tn "MindBody DB Backup" /v`
shows `Last Result` != `0`):

```powershell
# Quick fix: re-register with the correct PowerShell path.
schtasks /delete /tn "MindBody DB Backup" /f
schtasks /create /tn "MindBody DB Backup" `
  /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\mindbody\scripts\backup-db.ps1" `
  /sc daily /st 03:00 /ru SYSTEM /f
```

> **Known issue (2026-05-18):** the task was first created with
> `pwsh.exe` which isn't on the SYSTEM PATH. Use `powershell.exe` (or
> the absolute path to `C:\Program Files\PowerShell\7\pwsh.exe`)
> instead.

**Restore from a dump:** see Rollback section above.

---

## Health check

```bash
curl https://saleid.icu/api/health
# {"status":"ok","db":"ok","uptime_ms":12345,"ts":"..."}
```

Returns `503 {"status":"degraded","db":"down"}` if Postgres is
unreachable. Wire this into UptimeRobot / Cloudflare HC; never trust
the home page as a health signal (HTML can render fine while the React
bundle 404s — that was the 2026-05-18 incident).

---

## Database schema changes

PM2 holds `node_modules\.prisma\client\query_engine-windows.dll.node`
open, so plain `prisma generate` fails with `EPERM`. Routine:

```powershell
# 1. Update prisma/schema.prisma
# 2. Apply the change to the live DB. For renames, prefer hand-written SQL
#    via `prisma db execute --file ...` over `migrate dev` (the latter
#    can DROP+ADD, losing data).
npx prisma db execute --file backups/<your_migration>.sql --schema prisma/schema.prisma

# 3. Stop PM2 so the DLL is released, regen, restart.
pm2 stop mindbody
npx prisma generate
npm run deploy        # builds + pm2 restart in one step
```

> **Open issue:** the original `20260101000000_init` migration isn't
> registered in `_prisma_migrations` (DB was created via `db push`),
> so `prisma migrate dev` doesn't work. Schema changes go through
> `prisma db execute` until we baseline migrations properly.

---

## Caddy (HTTPS + headers + static assets)

**Config:** `C:\mindbody\Caddyfile`

**Apply changes (graceful, no downtime):**

```powershell
& "C:\mindbody\caddy.exe" validate --config C:\mindbody\Caddyfile  # ALWAYS validate first
& "C:\mindbody\caddy.exe" reload --config C:\mindbody\Caddyfile
```

**Hard restart (use only if reload fails):**

```powershell
pm2 restart caddy
```

**Active security headers (verify with `curl -sI https://saleid.icu`):**

- `strict-transport-security: max-age=31536000; includeSubDomains; preload`
- `x-content-type-options: nosniff`
- `x-frame-options: SAMEORIGIN`
- `referrer-policy: strict-origin-when-cross-origin`
- `permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), ...`
- `x-permitted-cross-domain-policies: none`
- `cross-origin-opener-policy: same-origin`

**Not yet enabled:** `Content-Security-Policy`. Plan = roll out
report-only first, gather violations, then enforce. See comment block
in `Caddyfile`.

---

## Service restart cheatsheet

```powershell
pm2 list                          # see status
pm2 restart mindbody              # app server only
pm2 restart caddy                 # reverse proxy only
pm2 logs mindbody --lines 100     # tail logs
pm2 describe mindbody             # full process info
```

Logs:

- Caddy access log: `C:\mindbody\caddy_access.log` (JSON)
- PM2 app stdout/stderr: `C:\Users\Administrator\.pm2\logs\` (default)

---

## Secrets / .env

`C:\mindbody\.env` is git-ignored. Confirmed via:

```bash
git log --all --full-history -- .env    # must return zero commits
```

To rotate any key:

1. Generate new value (provider dashboard or `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` for `SESSION_SECRET`).
2. Update `.env` on the VPS.
3. `pm2 restart mindbody --update-env` so the new process reads it.

**Outstanding rotations:**

- `RESEND_API_KEY` — comment in `.env` says "KEY EXPOSED IN CHAT,
  ROTATE AFTER INTEGRATION" but never rotated. Do this when convenient.

---

## Domains

- `saleid.icu` — the active domain. Caddy block in `Caddyfile`. TLS via
  Cloudflare proxied.
- `mindbody.com.ua` — **NOT configured in Caddyfile**. The codebase has
  fallbacks pointing here (e.g. `email.server.ts` uses
  `https://mindbody.com.ua` if `SITE_URL` env is unset), but the domain
  itself doesn't respond. If you want to enable it, add a sibling block
  to `Caddyfile`:

```
mindbody.com.ua {
    redir https://saleid.icu{uri} permanent
}
```

---

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on PRs:

1. `npm ci --legacy-peer-deps`
2. `npx prisma generate`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run format:check`
6. `npm run test` (72 unit tests)
7. `npm run build` (with placeholder env vars)

A red step blocks merge. To unblock CI without merging, push a fix
commit — never `--no-verify` or skip steps.

---

## Common incidents

### Infinite loading screen on saleid.icu

Symptom: HTML loads, brand sun spinner spins forever, no errors visible.

Cause: client assets in `build/client/assets/` are newer than what the
PM2-cached server `manifest` expects (or vice versa). The HTML
references hashed chunk filenames that 404 on disk.

Diagnosis:

```bash
# Pull the entry chunk URL out of the HTML, then HEAD-request it.
curl -s https://saleid.icu | grep -oE '/assets/entry\.client-[A-Za-z0-9_-]+\.js'
curl -sI https://saleid.icu/assets/entry.client-XXX.js   # should be 200
```

Fix: `npm run deploy`.

### `EPERM: rename query_engine-windows.dll.node`

You ran `npm run build` or `npx prisma generate` while PM2 was holding
the Prisma DLL open. Either stop PM2 first (`pm2 stop mindbody`), or
build without prisma generate (`npx react-router build`) if the Prisma
client doesn't need regenerating.

### "Listen EADDRINUSE: address already in use 3000"

PM2 is already serving on port 3000 — don't `npm run dev` on the VPS.
Use the local dev machine for that.

---

## Open questions / things still to do

- Sentry / GlitchTip monitoring — code prep ready (Phase 5.4); needs DSN
  to activate. Worth it for catching client-side errors before users
  report them.
- CSRF protection on mutation routes (Phase 5.1) — high risk, hot path,
  needs careful rollout.
- Multi-admin accounts (Phase 5.2) — currently one shared
  `ADMIN_PASSWORD` in `.env`; need a real `Admin` table.
- `admin/slides.tsx` is still 2374 lines with 42 `any`s — Phase 4 split
  is the biggest remaining cleanup.
- Resend API key rotation (see Secrets section).
