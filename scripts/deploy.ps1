# Production deploy: build fresh assets + restart PM2 atomically.
#
# Why this script exists:
# Running `npm run build` alone is dangerous on the VPS — it rewrites
# build/client/assets/ with new hashed filenames while the long-running
# PM2 process keeps the OLD manifest in memory. The server then renders
# HTML that references chunks that no longer exist on disk, and the site
# shows an infinite loading screen until PM2 is restarted.
#
# Usage:
#   pwsh scripts/deploy.ps1
# Or via npm:
#   npm run deploy
#
# What it does (in order):
#   1. Fail-fast checks (PM2 running, git tree state)
#   2. npx react-router build (prisma generate skipped — PM2 holds the DLL)
#   3. pm2 restart mindbody --update-env
#   4. Smoke-check that saleid.icu returns 200 and HTML/JS chunks match disk
#
# If step 2 fails, PM2 keeps the previous process — no downtime.
# If step 3 fails, you'll see it immediately in `pm2 logs mindbody`.

# -Migrate: run `prisma migrate deploy` before the build. Safe while PM2 is
# running — migrate deploy uses the schema engine, NOT the query-engine DLL
# that PM2 locks (the EPERM gotcha applies only to `prisma generate`). App
# code that needs new tables before a clean generate uses raw SQL (the
# moodType / SiteSetting pattern).
param(
    [switch]$Migrate
)

# Don't use $ErrorActionPreference = "Stop" — it turns every native
# command's stderr line (like Vite's harmless build warnings) into a
# fatal exception. We check $LASTEXITCODE explicitly after each call.
$ErrorActionPreference = "Continue"

Write-Host "==> [1/4] Pre-flight checks" -ForegroundColor Cyan

# PM2 must be reachable so we know we can restart at the end.
# `pm2 jlist` returns JSON but on Windows PS 5.1 ConvertFrom-Json
# chokes on duplicate keys (USERNAME vs username env vars), so we
# parse with a text grep instead.
$pm2List = pm2 list 2>$null | Out-String
if ($pm2List -notmatch "\bmindbody\b") {
    Write-Error "PM2 process 'mindbody' not found. Run: pm2 start ecosystem.config.cjs"
    exit 1
}

# Warn if the working tree has uncommitted modifications. We only care
# about TRACKED files that are dirty (M/A/D) — untracked files (??) are
# typically local-only scripts the operator hasn't added to git and they
# don't make the build different. Read-Host doesn't work in non-interactive
# shells, so this is a warning only.
$gitStatus = git status --porcelain 2>$null | Where-Object { $_ -notmatch '^\?\?' }
if ($gitStatus) {
    Write-Warning "Working tree has uncommitted MODIFIED files:"
    Write-Host ($gitStatus -join "`n")
    Write-Host "Continuing anyway. Re-run after committing if this wasn't intentional." -ForegroundColor Yellow
}

if ($Migrate) {
    Write-Host "==> [1b/4] Applying pending DB migrations (prisma migrate deploy)" -ForegroundColor Cyan
    & npx prisma migrate deploy 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Migration FAILED. PM2 process untouched, build skipped." -ForegroundColor Red
        exit 1
    }
}

Write-Host "==> [2a/4] Generating image variants (responsive srcset)" -ForegroundColor Cyan
# Idempotent — skips variants newer than their master.  First-time
# run on a fresh checkout takes ~30s, subsequent runs ~1s.  Without
# this step, `srcset` attrs in JSX point at non-existent URLs and
# the browser falls back to the master (no perf win).
& node scripts/generate-image-variants.mjs 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Image variant generation FAILED. PM2 process untouched." -ForegroundColor Red
    exit 1
}

Write-Host "==> [2b/4] Building (skipping prisma generate - PM2 holds the DLL)" -ForegroundColor Cyan
# Pipe stderr to stdout so we see Vite's harmless warnings but
# don't trigger PS's RemoteException trap.
& npx react-router build 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build FAILED. PM2 process is untouched." -ForegroundColor Red
    exit 1
}

Write-Host "==> [3/4] Restarting PM2 mindbody" -ForegroundColor Cyan
& pm2 restart mindbody --update-env
if ($LASTEXITCODE -ne 0) {
    Write-Error "PM2 restart failed. Check: pm2 logs mindbody"
    exit 1
}

# Give the new process a few seconds to settle before smoke-testing.
Start-Sleep -Seconds 3

Write-Host "==> [4/4] Smoke checks" -ForegroundColor Cyan
$root = (Invoke-WebRequest -Uri "https://saleid.icu" -UseBasicParsing -MaximumRedirection 5)
if ($root.StatusCode -ne 200) {
    Write-Error "saleid.icu returned $($root.StatusCode) - investigate before celebrating."
    exit 1
}

# Pick one chunk from the rendered HTML and verify it actually exists.
$entryMatch = $root.Content | Select-String -Pattern '/assets/entry\.client-[A-Za-z0-9_-]+\.js' -AllMatches
if ($entryMatch.Matches.Count -eq 0) {
    Write-Warning "Could not find entry.client chunk in HTML - smoke check inconclusive."
} else {
    $entryUrl = "https://saleid.icu" + $entryMatch.Matches[0].Value
    $entryRes = Invoke-WebRequest -Uri $entryUrl -UseBasicParsing -Method Head
    if ($entryRes.StatusCode -ne 200) {
        Write-Error "Entry chunk $entryUrl returned $($entryRes.StatusCode). HTML references a stale asset - try running deploy.ps1 again."
        exit 1
    }
    Write-Host "  [OK] $entryUrl -> 200" -ForegroundColor Green
}

Write-Host "==> Deploy complete." -ForegroundColor Green
