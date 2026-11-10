#Requires -Version 5.1
<#
.SYNOPSIS
    Moves real Wasel .env files out of the OneDrive sync tree to a safe
    offsite directory (~\.wasel-secrets), then replaces each project file
    with a placeholder-only stub so the project root stays clean.

.DESCRIPTION
    Run once from the project root:
        powershell -ExecutionPolicy Bypass -File scripts\move-env-offsite.ps1

    What it does:
      1. Creates %USERPROFILE%\.wasel-secrets  (outside OneDrive)
      2. Copies each real .env file there (preserving the original name)
      3. Replaces the project copy with a one-line stub that tells devs
         where the real file lives — no secrets remain in the project tree
      4. Prints the WASEL_ENV_DIR export line to add to your shell profile

    After running:
      - Set $env:WASEL_ENV_DIR = "$env:USERPROFILE\.wasel-secrets" in your
        PowerShell profile (or System env vars) before running npm run dev
      - Verify OneDrive is NOT syncing the offsite directory

.NOTES
    The script never deletes the originals until the copy is verified.
    Run as your normal user — no elevation required.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Config ────────────────────────────────────────────────────────────────────
$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$OffsiteDir   = Join-Path $env:USERPROFILE '.wasel-secrets'
$EnvFiles     = @('.env', '.env.local', '.env.production', '.env.production.local')

$PlaceholderStub = @'
# Real secrets for this file have been moved to %USERPROFILE%\.wasel-secrets\
# by scripts/move-env-offsite.ps1.
#
# To load them, set WASEL_ENV_DIR before starting the dev server:
#   PowerShell:  $env:WASEL_ENV_DIR = "$env:USERPROFILE\.wasel-secrets"
#   Bash/WSL:    export WASEL_ENV_DIR="$HOME/.wasel-secrets"
#
# Then run:  npm run dev
#
# DO NOT add real secrets to this file — it lives inside the project tree
# which may be synced by OneDrive, Dropbox, or similar services.
'@

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step([string]$msg) { Write-Host "`n  → $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    ✓ $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "    ⚠ $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "    ✗ $msg" -ForegroundColor Red }

function Test-IsOneDrivePath([string]$path) {
    return $path -match '[\\/]OneDrive[\\/]'
}

function Test-HasRealSecrets([string]$filePath) {
    # Returns $true if the file contains any non-placeholder secret pattern
    $patterns = @(
        'sk_live_', 'sk_test_', 'pk_live_', 'pk_test_',
        'whsec_', 're_live_', 'SG\.',
        'AC[a-f0-9]{32}',
        'eyJ[A-Za-z0-9\-_]+\.eyJ',
        'sb_publishable_'
    )
    $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return $false }
    foreach ($p in $patterns) {
        if ($content -match $p) { return $true }
    }
    return $false
}

# ── Main ──────────────────────────────────────────────────────────────────────
Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host   "║   Wasel — Move .env files out of OneDrive sync tree  ║" -ForegroundColor Magenta
Write-Host   "╚══════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

# 1. Warn if project root is NOT in OneDrive (script still works, just informational)
if (-not (Test-IsOneDrivePath $ProjectRoot)) {
    Write-Warn "Project root does not appear to be inside OneDrive: $ProjectRoot"
    Write-Warn "The script will still move files — press Ctrl+C to abort, or Enter to continue."
    Read-Host
}

# 2. Create offsite directory
Write-Step "Creating offsite secrets directory: $OffsiteDir"
if (-not (Test-Path $OffsiteDir)) {
    New-Item -ItemType Directory -Path $OffsiteDir -Force | Out-Null
    Write-Ok "Created $OffsiteDir"
} else {
    Write-Ok "Already exists: $OffsiteDir"
}

# Warn if offsite dir is itself inside OneDrive
if (Test-IsOneDrivePath $OffsiteDir) {
    Write-Err "Offsite directory is STILL inside OneDrive: $OffsiteDir"
    Write-Err "Change `$OffsiteDir in this script to a path outside OneDrive and re-run."
    exit 1
}

# 3. Process each env file
$moved = 0
$skipped = 0

foreach ($file in $EnvFiles) {
    $src  = Join-Path $ProjectRoot $file
    $dest = Join-Path $OffsiteDir  $file

    Write-Step "Processing $file"

    if (-not (Test-Path $src)) {
        Write-Warn "Not found — skipping: $src"
        $skipped++
        continue
    }

    # Check if it already looks like a stub (no real secrets)
    if (-not (Test-HasRealSecrets $src)) {
        Write-Ok "No real secrets detected in $file — leaving in place"
        $skipped++
        continue
    }

    # Copy to offsite (overwrite if already there)
    Copy-Item -Path $src -Destination $dest -Force
    Write-Ok "Copied → $dest"

    # Verify the copy is intact
    $srcHash  = (Get-FileHash $src  -Algorithm SHA256).Hash
    $destHash = (Get-FileHash $dest -Algorithm SHA256).Hash
    if ($srcHash -ne $destHash) {
        Write-Err "Hash mismatch after copy — aborting to protect $file"
        exit 1
    }
    Write-Ok "Copy verified (SHA-256 match)"

    # Replace project copy with stub
    Set-Content -Path $src -Value $PlaceholderStub -Encoding UTF8
    Write-Ok "Replaced $src with placeholder stub"
    $moved++
}

# 4. Summary
Write-Host "`n──────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Files moved:   $moved" -ForegroundColor Green
Write-Host "  Files skipped: $skipped" -ForegroundColor Yellow
Write-Host "──────────────────────────────────────────────────────`n" -ForegroundColor DarkGray

if ($moved -gt 0) {
    Write-Host "✅ Done. Real secrets are now in: $OffsiteDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Add this to your PowerShell profile (`$PROFILE):" -ForegroundColor White
    Write-Host "       `$env:WASEL_ENV_DIR = `"$OffsiteDir`"" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  2. Or set it as a permanent System environment variable:" -ForegroundColor White
    Write-Host "       [System.Environment]::SetEnvironmentVariable('WASEL_ENV_DIR', '$OffsiteDir', 'User')" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  3. Verify OneDrive is NOT syncing $OffsiteDir" -ForegroundColor White
    Write-Host "     (it should be outside your OneDrive folder by default)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  4. Run: npm run dev  (Vite will load env from WASEL_ENV_DIR)" -ForegroundColor White
    Write-Host ""

    # Set for current session
    $env:WASEL_ENV_DIR = $OffsiteDir
    Write-Host "  WASEL_ENV_DIR set for this session: $env:WASEL_ENV_DIR" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No files needed moving — project .env files contain no real secrets." -ForegroundColor Cyan
}
