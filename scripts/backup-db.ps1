# PostgreSQL backup script for the MindBody database.
#
# Why: there is currently no automated backup. A disk failure, accidental
# DROP, or corrupted migration would lose all customer/order data. This
# script + a Windows scheduled task gives us a 7-day rolling window of
# nightly dumps that can be restored on a fresh Postgres in minutes.
#
# Usage (manual):
#   pwsh scripts/backup-db.ps1
# Or via npm:
#   npm run backup:db
#
# Restore (manual, on staging first):
#   1. createdb mindbody_db_restore
#   2. gzip -d -c backups/mindbody_db_20260518_030000.sql.gz | psql -d mindbody_db_restore
#
# Reads DATABASE_URL from .env (no hard-coded credentials).
#
# Output: backups/mindbody_db_<YYYYMMDD_HHmmss>.sql.gz
# Retention: 7 days, oldest dumps pruned automatically.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile  = Join-Path $repoRoot ".env"
$backupDir = Join-Path $repoRoot "backups"

if (-not (Test-Path $envFile)) {
    Write-Error ".env not found at $envFile - cannot read DATABASE_URL."
    exit 1
}

# ---- Parse DATABASE_URL from .env -----------------------------------------
# Format: postgresql://user:password@host:port/dbname?schema=public
$envLines = Get-Content $envFile
$dbUrlLine = $envLines | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $dbUrlLine) {
    Write-Error "DATABASE_URL not found in .env"
    exit 1
}
$dbUrlRaw = $dbUrlLine -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''

# postgresql://user:password@host:port/dbname?...
$pattern = '^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)'
if ($dbUrlRaw -notmatch $pattern) {
    Write-Error "DATABASE_URL did not match expected postgresql://user:pwd@host:port/db format"
    exit 1
}
$pgUser = $Matches[1]
$pgPass = $Matches[2]
$pgHost = $Matches[3]
$pgPort = if ($Matches[4]) { $Matches[4] } else { "5432" }
$pgDb   = $Matches[5]

# ---- Locate pg_dump --------------------------------------------------------
$pgDumpExe = $null
$pgRoot = "C:\Program Files\PostgreSQL"
if (Test-Path $pgRoot) {
    # Pick the newest installed version (16/17/...) and use its pg_dump.
    $newest = Get-ChildItem $pgRoot -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($newest) {
        $candidate = Join-Path $newest.FullName "bin\pg_dump.exe"
        if (Test-Path $candidate) { $pgDumpExe = $candidate }
    }
}
# Fallback to PATH lookup if the standard install dir wasn't found.
if (-not $pgDumpExe) {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { $pgDumpExe = $cmd.Source }
}
if (-not $pgDumpExe) {
    Write-Error "pg_dump not found. Install PostgreSQL or put pg_dump on PATH."
    exit 1
}

# ---- Prepare output --------------------------------------------------------
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile  = Join-Path $backupDir "mindbody_db_$timestamp.sql"
$gzFile    = "$dumpFile.gz"

Write-Host "==> pg_dump $pgDb -> $gzFile" -ForegroundColor Cyan

# Set password via env var so it doesn't appear on the command line / in
# Process Explorer.
$env:PGPASSWORD = $pgPass
try {
    & $pgDumpExe -h $pgHost -p $pgPort -U $pgUser -d $pgDb -F p -f $dumpFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pg_dump exited with code $LASTEXITCODE"
        exit 1
    }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# ---- Compress + verify -----------------------------------------------------
# Built-in Compress-Archive produces .zip; for .sql.gz we use the .NET
# GZipStream API to get a smaller single-file gz that's restore-friendly.
$bytes = [System.IO.File]::ReadAllBytes($dumpFile)
$gzStream = [System.IO.File]::Create($gzFile)
$gzip = New-Object System.IO.Compression.GZipStream($gzStream, [System.IO.Compression.CompressionLevel]::Optimal)
$gzip.Write($bytes, 0, $bytes.Length)
$gzip.Close()
$gzStream.Close()
Remove-Item $dumpFile -Force

$sizeKB = [Math]::Round((Get-Item $gzFile).Length / 1024, 1)
Write-Host "  [OK] $gzFile ($sizeKB KB)" -ForegroundColor Green

# ---- Retention: keep last 7 days ------------------------------------------
$cutoff = (Get-Date).AddDays(-7)
$pruned = 0
Get-ChildItem $backupDir -Filter "mindbody_db_*.sql.gz" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Remove-Item $_.FullName -Force
        $pruned++
    }
if ($pruned -gt 0) {
    Write-Host "  [OK] pruned $pruned old backup(s) older than 7 days" -ForegroundColor Green
}

Write-Host "==> Backup complete." -ForegroundColor Green
