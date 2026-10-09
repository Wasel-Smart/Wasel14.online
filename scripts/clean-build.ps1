<#
.SYNOPSIS
  Clean, gated production build for Wasel web. Produces a verified dist/ and a release/ bundle.

.DESCRIPTION
  Run from anywhere:   powershell -ExecutionPolicy Bypass -File scripts\clean-build.ps1
  Recommended:         run from a copy of the repo OUTSIDE OneDrive (e.g. C:\dev\Wasel14.online)
                       and with WASEL_ENV_DIR pointing at a folder outside the sync tree.

  Steps (any failure stops the run):
    1. Preflight   Node >= 20, git state, OneDrive warning
    2. Clean       removes dist/ and Vite caches (node_modules only with -FreshInstall)
    3. Gates       type-check, lint, unit tests, secrets scan, env-exposure scan,
                   route contract, translation drift
    4. Build       npm run build  (tsc + vite build + PWA manifest + service-worker stamp)
    5. Verify      scripts/verify-dist.mjs, then scripts/verify-release.mjs
    6. Package     moves source maps out of dist/, zips dist/, writes SHA-256 + RELEASE.txt

  Nothing is deployed by this script.

.PARAMETER FreshInstall    Delete node_modules and run `npm ci --include=dev` first.
.PARAMETER SkipTests       Skip unit tests (NOT recommended for a release).
.PARAMETER SkipEnvCheck    Continue even if `npm run env:check` fails. The final summary will say so.
.PARAMETER KeepSourcemaps  Leave .map files inside dist/ (they will be publicly downloadable if deployed).
#>
[CmdletBinding()]
param(
  [switch]$FreshInstall,
  [switch]$SkipTests,
  [switch]$SkipEnvCheck,
  [switch]$KeepSourcemaps
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$warnings = New-Object System.Collections.Generic.List[string]
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Invoke-Step {
  param([string]$Name, [scriptblock]$Body, [switch]$AllowFailure)
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  & $Body
  if ($global:LASTEXITCODE -ne 0) {
    if ($AllowFailure) {
      $warnings.Add("$Name FAILED (exit $($global:LASTEXITCODE)) and was allowed to continue.")
      Write-Warning "$Name failed but is allowed to continue."
      $global:LASTEXITCODE = 0
    } else {
      throw "Step failed: $Name (exit $($global:LASTEXITCODE))"
    }
  }
}

# 1. Preflight ---------------------------------------------------------------
Invoke-Step 'Preflight' {
  $nodeVersion = (node --version).TrimStart('v')
  $major = [int]($nodeVersion.Split('.')[0])
  if ($major -lt 20) { throw "Node $nodeVersion is too old. package.json requires >=20 (CI uses 22)." }
  Write-Host "Node $nodeVersion, npm $(npm --version)"
  if ($major -ne 22) { $warnings.Add("Node $nodeVersion differs from CI (22). Build output may differ from CI.") }

  if ($root -match 'OneDrive|Dropbox|Google Drive|iCloud') {
    $warnings.Add("Project is inside a cloud-synced folder ($root). Installs can corrupt and env files are synced off-machine.")
    Write-Warning "Project is inside a cloud-synced folder. Build in a copy outside OneDrive for the release."
  }

  if (Get-Command git -ErrorAction SilentlyContinue) {
    $dirty = git status --porcelain
    if ($dirty) {
      $count = ($dirty | Measure-Object).Count
      $warnings.Add("Working tree has $count uncommitted change(s). A release should be built from a clean commit.")
      Write-Warning "$count uncommitted change(s) in the working tree."
    }
  }

  if (-not $env:WASEL_ENV_DIR) {
    Write-Host "WASEL_ENV_DIR is not set: Vite will read env files from the project root."
  } else {
    Write-Host "WASEL_ENV_DIR = $env:WASEL_ENV_DIR"
  }
}

# 2. Clean -------------------------------------------------------------------
Invoke-Step 'Clean' {
  foreach ($path in @('dist', 'node_modules\.vite', 'node_modules\.cache')) {
    if (Test-Path $path) { Remove-Item $path -Recurse -Force; Write-Host "removed $path" }
  }
  Get-ChildItem -Path $root -Filter '*.tsbuildinfo' -File -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Force; Write-Host "removed $($_.Name)" }

  if ($FreshInstall) {
    if (Test-Path 'node_modules') { Remove-Item 'node_modules' -Recurse -Force; Write-Host 'removed node_modules' }
    npm ci --include=dev
  } elseif (-not (Test-Path 'node_modules')) {
    throw 'node_modules is missing. Re-run with -FreshInstall.'
  }
}

# 3. Gates -------------------------------------------------------------------
Invoke-Step 'Type-check (app)'           { npm run type-check:app }
Invoke-Step 'Lint'                       { npm run lint }
if ($SkipTests) {
  $warnings.Add('Unit tests were skipped (-SkipTests).')
} else {
  Invoke-Step 'Unit tests'               { npm run test:unit }
}
Invoke-Step 'Secrets scan'               { npm run secrets:check }
Invoke-Step 'Env exposure scan'          { npm run env:check } -AllowFailure:$SkipEnvCheck
Invoke-Step 'Route contract'             { npm run check:routes }
Invoke-Step 'Translation drift'          { node scripts/verify-translations.mjs }

# 4. Build -------------------------------------------------------------------
Invoke-Step 'Production build'           { npm run build }

# 5/6. Package (source maps out first so the release check can be strict) -----
$releaseDir = Join-Path $root "release\$stamp"
Invoke-Step 'Move source maps out of dist' {
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
  $maps = Get-ChildItem -Path 'dist' -Recurse -Filter '*.map' -File
  if ($KeepSourcemaps) {
    $warnings.Add("Source maps kept inside dist/ ($($maps.Count) files). They will be publicly downloadable.")
    return
  }
  $mapRoot = Join-Path $releaseDir 'sourcemaps'
  foreach ($map in $maps) {
    $relative = $map.FullName.Substring((Resolve-Path 'dist').Path.Length).TrimStart('\')
    $target = Join-Path $mapRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Move-Item $map.FullName $target
  }
  Write-Host "moved $($maps.Count) source maps to $mapRoot (upload to Sentry, keep private)"
}

Invoke-Step 'Verify dist wiring'         { node scripts/verify-dist.mjs }
Invoke-Step 'Verify release hygiene' {
  if ($KeepSourcemaps) { node scripts/verify-release.mjs --allow-sourcemaps } else { node scripts/verify-release.mjs }
}

Invoke-Step 'Package release' {
  $zip = Join-Path $releaseDir 'wasel-web-dist.zip'
  Compress-Archive -Path (Join-Path $root 'dist\*') -DestinationPath $zip -Force
  $hash = (Get-FileHash $zip -Algorithm SHA256).Hash
  $commit = 'unknown'
  if (Get-Command git -ErrorAction SilentlyContinue) { $commit = (git rev-parse HEAD 2>$null) }
  $buildTime = ([regex]::Match((Get-Content 'dist\index.html' -Raw), 'name="build-time" content="([^"]+)"')).Groups[1].Value

  $lines = @(
    "Wasel web release $stamp",
    "commit:      $commit",
    "node:        $(node --version)",
    "build-time:  $buildTime",
    "zip:         $(Split-Path $zip -Leaf)",
    "sha256:      $hash",
    "sourcemaps:  $(if ($KeepSourcemaps) { 'INSIDE dist (public)' } else { 'sourcemaps\ (private)' })"
  )
  if ($warnings.Count -gt 0) { $lines += ''; $lines += 'WARNINGS:'; $lines += ($warnings | ForEach-Object { "  - $_" }) }
  $lines | Set-Content (Join-Path $releaseDir 'RELEASE.txt') -Encoding UTF8
  Write-Host ($lines -join "`n")
}

Write-Host ""
if ($warnings.Count -gt 0) {
  Write-Host "BUILD OK WITH $($warnings.Count) WARNING(S):" -ForegroundColor Yellow
  $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
} else {
  Write-Host 'CLEAN BUILD OK. No warnings.' -ForegroundColor Green
}
Write-Host "Release bundle: $releaseDir"
