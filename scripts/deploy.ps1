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

$ErrorActionPreference = "Stop"

Write-Host "==> [1/4] Pre-flight checks" -ForegroundColor Cyan

# PM2 must be reachable so we know we can restart at the end.
$pm2Status = pm2 jlist 2>$null | ConvertFrom-Json
if (-not ($pm2Status | Where-Object { $_.name -eq "mindbody" })) {
    Write-Error "PM2 process 'mindbody' not found. Run: pm2 start ecosystem.config.cjs"
    exit 1
}

# Warn if the working tree has uncommitted changes — easy to deploy the wrong code.
$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Warning "Working tree has uncommitted changes:"
    Write-Host $gitStatus
    $confirm = Read-Host "Deploy anyway? (y/N)"
    if ($confirm -ne "y") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "==> [2/4] Building (skipping prisma generate — PM2 holds the DLL)" -ForegroundColor Cyan
& npx react-router build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. PM2 process is untouched."
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
    Write-Error "saleid.icu returned $($root.StatusCode) — investigate before celebrating."
    exit 1
}

# Pick one chunk from the rendered HTML and verify it actually exists.
$entryMatch = $root.Content | Select-String -Pattern '/assets/entry\.client-[A-Za-z0-9_-]+\.js' -AllMatches
if ($entryMatch.Matches.Count -eq 0) {
    Write-Warning "Could not find entry.client chunk in HTML — smoke check inconclusive."
} else {
    $entryUrl = "https://saleid.icu" + $entryMatch.Matches[0].Value
    $entryRes = Invoke-WebRequest -Uri $entryUrl -UseBasicParsing -Method Head
    if ($entryRes.StatusCode -ne 200) {
        Write-Error "Entry chunk $entryUrl returned $($entryRes.StatusCode). HTML references a stale asset — try running deploy.ps1 again."
        exit 1
    }
    Write-Host "  ✓ $entryUrl -> 200" -ForegroundColor Green
}

Write-Host "==> Deploy complete." -ForegroundColor Green
