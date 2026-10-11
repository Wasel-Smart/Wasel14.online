<#
.SYNOPSIS
  Plans (default) or applies Wasel's non-secret Vercel variables.

.DESCRIPTION
  DRY RUN BY DEFAULT. Nothing changes unless you pass -Apply.

  What it manages
    1. Public, non-secret VITE_* values with a known correct production value
       (URLs, safety flags, notification flags). Written as plain variables so
       they stay readable by `vercel env pull` and verifiable.
    2. Public values you supply in a local, untracked file (Sentry DSN,
       App Insights string, Stripe publishable key, Maps key, ...).
    3. Removal of dead duplicate names (VITE_APP_URL_1, VITE_SUPABASE_URL1, ...).
       The app reads exact names only, so suffixed copies do nothing.

  What it never touches
    Server secrets (Stripe secret, Supabase service role, Twilio, Resend, CLIQ_*,
    worker secrets). Set those with the Vercel dashboard or `supabase secrets set`.
    Values that look like server secrets in your values file are refused.

.PARAMETER Apply
  Make the changes. Without it the script only prints the plan.

.PARAMETER SkipRemove
  Do not remove the dead duplicate variables.

.PARAMETER EnforceTwoFactor
  Set VITE_ENFORCE_TWO_FACTOR_AUTH=true. Leave this off until 2FA enrolment has
  been tested end to end, because enforcement blocks payments and sensitive
  actions for users who have not enrolled.

.PARAMETER ValuesFile
  KEY=value lines for the public values you must supply yourself.
  Default: %USERPROFILE%\.wasel-secrets\.env.values  (keep it outside the repo)

.EXAMPLE
  .\scripts\vercel-env-sync.ps1                 # plan only
  .\scripts\vercel-env-sync.ps1 -Apply          # apply
#>
[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$SkipRemove,
  [switch]$EnforceTwoFactor,
  [string]$Environment = 'production',
  [string]$ValuesFile = (Join-Path $env:USERPROFILE '.wasel-secrets\.env.values')
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

# ── Configuration ───────────────────────────────────────────────────────────────

# Public values (project ref is public; it is in config.toml and .env.example).
$projectRef = 'zexlxabdcsjefptmjhuq'
$desired = [ordered]@{
  VITE_APP_NAME                       = 'Wasel'
  VITE_APP_URL                        = 'https://www.wasel14.online'   # canonical host; apex must redirect here
  VITE_APP_ORIGIN                     = 'https://www.wasel14.online'
  VITE_AUTH_CALLBACK_PATH             = '/app/auth/callback'
  VITE_MODE                           = 'production'
  VITE_SUPABASE_URL                   = "https://$projectRef.supabase.co"
  VITE_EDGE_FUNCTIONS_BASE_URL        = "https://$projectRef.supabase.co/functions/v1"
  VITE_EDGE_FUNCTION_NAME             = 'make-server-0b1f4071'
  # Production safety flags: explicit, never inherited.
  VITE_ENABLE_DEMO_DATA               = 'false'
  VITE_ENABLE_SYNTHETIC_TRIPS         = 'false'
  VITE_ALLOW_DIRECT_SUPABASE_FALLBACK = 'false'
  # Two-factor: UI on (backend endpoints are live per .env.example); enforcement is opt-in.
  VITE_ENABLE_TWO_FACTOR_AUTH         = 'true'
  VITE_ENFORCE_TWO_FACTOR_AUTH        = $(if ($EnforceTwoFactor) { 'true' } else { 'false' })
  VITE_ENABLE_EMAIL_NOTIFICATIONS     = 'true'
  VITE_ENABLE_SMS_NOTIFICATIONS       = 'true'
  VITE_ENABLE_WHATSAPP_NOTIFICATIONS  = 'true'
}

# Public values you supply in $ValuesFile. Only these names are read from it.
$fromFileNames = @(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SENTRY_DSN',
  'VITE_APP_INSIGHTS_CONNECTION_STRING',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_ANALYTICS_ENDPOINT',
  'VITE_TELEMETRY_TOKEN',
  'VITE_EVENT_BROKER_WORKER_SECRET',
  'VITE_SUPPORT_EMAIL',
  'VITE_SUPPORT_PHONE_NUMBER',
  'VITE_SUPPORT_SMS_NUMBER',
  'VITE_SUPPORT_WHATSAPP_NUMBER'
)

# Dead names: the app resolves exact names only (src/utils/env/resolvers.ts), and
# .env.example marks the last four as unread or deprecated.
$dead = @(
  'VITE_ALLOW_DIRECT_SUPABASE_FALLBACK_1','VITE_ANALYTICS_ENDPOINT_1','VITE_APP_LEGACY_ORIGIN_1',
  'VITE_APP_NAME_1','VITE_APP_ORIGIN_1','VITE_APP_URL_1','VITE_AUTH_CALLBACK_PATH_1','VITE_CDN_URL_1',
  'VITE_CORRIDOR_SALT_LABEL_1','VITE_CURRENCY_STORAGE_KEY_1','VITE_DATA_PATH_1',
  'VITE_EDGE_FUNCTIONS_BASE_URL_1','VITE_EDGE_FUNCTION_NAME_1','VITE_ENABLE_DEMO_DATA_1',
  'VITE_ENABLE_EMAIL_NOTIFICATIONS_1','VITE_ENABLE_SMS_NOTIFICATIONS_1','VITE_ENABLE_SYNTHETIC_TRIPS_1',
  'VITE_ENABLE_TWO_FACTOR_AUTH_1','VITE_ENABLE_WHATSAPP_NOTIFICATIONS_1','VITE_FACEBOOK_APP_ID_1',
  'VITE_FIND_RIDE_SALT_LABEL_1','VITE_FIND_RIDE_TRIP_SALT_LABEL_1','VITE_GOOGLE_CLIENT_ID_1',
  'VITE_GOOGLE_MAPS_API_KEY_1','VITE_MOBILITY_SALT_LABEL_1','VITE_PACKAGES_SALT_LABEL_1',
  'VITE_PACKAGE_SEND_SALT_LABEL_1','VITE_PACKAGE_TRACK_SALT_LABEL_1','VITE_SENTRY_DSN_1',
  'VITE_SENTRY_ENVIRONMENT_1','VITE_STRIPE_PUBLISHABLE_KEY_1','VITE_SUPABASE_ANON_KEY1',
  'VITE_SUPABASE_ANON_KEY_1','VITE_SUPABASE_PUBLISHABLE_KEY_1','VITE_SUPABASE_URL1','VITE_SUPABASE_URL_1',
  'VITE_SUPPORT_EMAIL_1','VITE_SUPPORT_PHONE_NUMBER_1','VITE_SUPPORT_SMS_NUMBER_1',
  'VITE_SUPPORT_WHATSAPP_NUMBER_1','VITE_MODE_PRODUCTION','VITE_ENABLE_WHATSAPP_NOTIFICATIONS_TRUE',
  'VITE_SENTRY_ENVIRONMENT','VITE_DATA_PATH','VITE_GOOGLE_CLIENT_ID','VITE_FACEBOOK_APP_ID'
)

# Not in the project's env contract and not read by Sentry init. Probably inert,
# but this script does not remove them until you have confirmed that.
$unverified = @(
  'VITE_ENABLE_SENTRY','VITE_ENABLE_CLIQ','VITE_ENABLE_ANALYTICS','VITE_ENABLE_GOOGLE_MAPS',
  'VITE_ENABLE_STRIPE','VITE_ENABLE_CDN'
)

# ── Helpers ───────────────────────────────────────────────────────────────────

function Test-Placeholder([string]$Value) {
  return [string]::IsNullOrWhiteSpace($Value) -or
    ($Value -match 'PASTE_YOUR|YOUR_[A-Z_]*HERE|YOUR_KEY|YOUR_DSN|placeholder|SET_REAL|SENSITIVE')
}

function Test-ServerSecret([string]$Value) {
  return $Value -match 'sk_(live|test)_|whsec_|re_live_|^SG\.[A-Za-z0-9_-]{20}|\bAC[a-f0-9]{32}\b'
}

function Read-EnvFile([string]$Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $map[$k] = $v
  }
  return $map
}

function Invoke-Vercel([string[]]$VercelArgs) {
  $out = & vercel @VercelArgs 2>&1
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($out | Out-String).Trim() }
}

# ── Pre-flight ──────────────────────────────────────────────────────────────────

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  throw 'The Vercel CLI is not on PATH. Install it with: npm i -g vercel'
}
if (-not (Test-Path '.vercel\project.json')) {
  throw 'This folder is not linked to a Vercel project. Run: vercel link'
}

# ── Build the plan ──────────────────────────────────────────────────────────────

$fileValues = Read-EnvFile $ValuesFile
$setFromFile = [ordered]@{}
$skipped = @()
foreach ($name in $fromFileNames) {
  if (-not $fileValues.ContainsKey($name)) { $skipped += "$name (not in values file)"; continue }
  $v = [string]$fileValues[$name]
  if (Test-Placeholder $v)  { $skipped += "$name (placeholder or empty)"; continue }
  if (Test-ServerSecret $v) { $skipped += "$name (REFUSED: looks like a server secret)"; continue }
  $setFromFile[$name] = $v
}

Write-Host ''
Write-Host "Vercel plan for environment '$Environment'" -ForegroundColor Cyan
Write-Host ('-' * 64)

Write-Host "`nSET (non-secret, plain variables):" -ForegroundColor Green
foreach ($k in $desired.Keys) { Write-Host ('  {0,-38} = {1}' -f $k, $desired[$k]) }

Write-Host "`nSET from $ValuesFile (values hidden):" -ForegroundColor Green
if ($setFromFile.Count -eq 0) { Write-Host '  (none)' }
foreach ($k in $setFromFile.Keys) { Write-Host "  $k" }

if ($skipped.Count) {
  Write-Host "`nSKIPPED:" -ForegroundColor Yellow
  $skipped | ForEach-Object { Write-Host "  $_" }
}

if (-not $SkipRemove) {
  Write-Host "`nREMOVE (dead duplicate names, safe: nothing reads them):" -ForegroundColor Magenta
  Write-Host "  $($dead.Count) names, e.g. VITE_APP_URL_1, VITE_SUPABASE_URL1, VITE_MODE_PRODUCTION"
}

Write-Host "`nNOT TOUCHED (confirm unused first, then remove by hand):" -ForegroundColor Yellow
Write-Host "  $($unverified -join ', ')"
Write-Host '  Check:  Get-ChildItem src,supabase,api -Recurse -Include *.ts,*.tsx | Select-String ''VITE_ENABLE_(SENTRY|CLIQ|ANALYTICS|GOOGLE_MAPS|STRIPE|CDN)'''

if (-not $Apply) {
  Write-Host "`nDRY RUN: nothing was changed. Re-run with -Apply to make these changes.`n" -ForegroundColor Cyan
  return
}

# ── Apply ───────────────────────────────────────────────────────────────────────

$help = Invoke-Vercel @('env', 'add', '--help')
if ($help.Output -notmatch '--value') {
  throw 'This Vercel CLI does not support `env add --value`. Update it (npm i -g vercel) and retry.'
}

$backupDir = Split-Path -Parent $ValuesFile
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backup = Join-Path $backupDir ('env.backup-{0:yyyyMMdd-HHmmss}' -f (Get-Date))
Write-Host "`nBacking up readable variables to $backup" -ForegroundColor Cyan
$pull = Invoke-Vercel @('env', 'pull', $backup, "--environment=$Environment", '--yes')
if ($pull.ExitCode -ne 0) { throw "Backup failed, nothing was changed.`n$($pull.Output)" }

$failures = New-Object System.Collections.Generic.List[string]

function Set-VercelVar([string]$Name, [string]$Value) {
  $r = Invoke-Vercel @('env', 'add', $Name, $Environment, '--value', $Value, '--force', '--yes')
  if ($r.ExitCode -ne 0) {
    # Some variables (for example Sensitive ones) cannot be overwritten in place.
    $null = Invoke-Vercel @('env', 'rm', $Name, $Environment, '--yes')
    $r = Invoke-Vercel @('env', 'add', $Name, $Environment, '--value', $Value, '--yes')
  }
  if ($r.ExitCode -eq 0) { Write-Host "  set      $Name" -ForegroundColor Green }
  else { Write-Host "  FAILED   $Name" -ForegroundColor Red; $failures.Add($Name) }
}

Write-Host "`nSetting variables..." -ForegroundColor Cyan
foreach ($k in $desired.Keys)      { Set-VercelVar $k ([string]$desired[$k]) }
foreach ($k in $setFromFile.Keys)  { Set-VercelVar $k ([string]$setFromFile[$k]) }

if (-not $SkipRemove) {
  Write-Host "`nRemoving dead duplicates..." -ForegroundColor Cyan
  foreach ($name in $dead) {
    $r = Invoke-Vercel @('env', 'rm', $name, $Environment, '--yes')
    if ($r.ExitCode -eq 0)                               { Write-Host "  removed  $name" -ForegroundColor Magenta }
    elseif ($r.Output -match 'not found|does not exist|No Environment Variable') { Write-Host "  absent   $name" -ForegroundColor DarkGray }
    else                                                 { Write-Host "  FAILED   $name" -ForegroundColor Red; $failures.Add($name) }
  }
}

Write-Host ''
if ($failures.Count) {
  Write-Host "Finished with $($failures.Count) failure(s): $($failures -join ', ')" -ForegroundColor Red
} else {
  Write-Host 'Finished with no failures.' -ForegroundColor Green
}

Write-Host @"

Next steps
  1. Redeploy so the build picks up the new values:   vercel --prod
  2. Verify what production holds:
       vercel env pull "`$env:USERPROFILE\.wasel-secrets\.env.verify" --environment=production --yes
       node --env-file="`$env:USERPROFILE\.wasel-secrets\.env.verify" scripts/verify-live-integrations.mjs --production
  3. If the VITE_ values come back as [SENSITIVE], your Vercel team enforces Sensitive variables
     (Team Settings -> Security). Public VITE_ values gain nothing from that, so exempt them.
  4. Delete $backup and .env.verify when you are done; they hold your production variables.
"@
