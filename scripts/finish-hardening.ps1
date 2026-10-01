# Wasel - finish-hardening.ps1
# Run from PowerShell:  powershell -ExecutionPolicy Bypass -File .\scripts\finish-hardening.ps1
#
# Does the parts of the hardening checklist that need your machine:
#   1. Commit all changes to master (aborts if anything secret-looking is staged)
#   2. Move real .env* files out of OneDrive and set WASEL_ENV_DIR
#   3. Scan full git history for secrets (report only, never rewrites history)
#   4. Probe whether the Supabase gateway blocks webhook calls (the verify_jwt issue)
#
# It does NOT rotate provider credentials (that needs your Stripe / Twilio / Supabase /
# Google / Meta / Resend / SendGrid / Vercel logins) and it never force-pushes or rewrites history.

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

function Confirm-Step($message) {
  $answer = Read-Host "$message (y/N)"
  return $answer -eq 'y'
}

# ---------------------------------------------------------------- 1. Commit
Write-Host "`n== 1. Commit to master ==" -ForegroundColor Cyan

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'master') {
  Write-Host "Currently on '$branch'. Switching to master."
  git checkout master
}

Write-Host "Running the secret scanner before staging anything..."
npm run secrets:check
if ($LASTEXITCODE -ne 0) {
  throw "secrets:check failed. Fix the findings above (rotate + redact) before committing."
}

git add -A

$risky = git diff --cached --name-only | Select-String -Pattern '_git_hygiene_quarantine|client_secret|(^|/)\.env($|\.local$|\.production$|\.development$|\.staging$)|\.pem$|\.key$|\.p12$|\.pfx$|service-account|wasel-planning-with-ai\.json'
if ($risky) {
  git reset | Out-Null
  Write-Host "ABORTED. These staged files look like secrets, nothing was committed:" -ForegroundColor Red
  $risky | ForEach-Object { Write-Host "  $_" }
  throw "Remove them from the index (and add to .gitignore), then re-run."
}

git status --short
if (Confirm-Step "Commit the staged changes to master") {
  # The husky pre-commit hook runs lint + type-check + unit tests. If it fails, fix the
  # reported problem; do not bypass it with --no-verify.
  git commit -m "chore: security hardening, CI fixes, node 22, devcontainer, accurate review docs" `
             -m "- verify-oauth-config no longer fails in CI (no .env there by design)
- ci.yml / security.yml: Node 22, least-privilege permissions, concurrency, timeouts
- devcontainer: replace unrelated .NET/MSSQL template with Node 22
- .env.example: drop old Google client id / Facebook app id
- docs: remove partial Twilio key id, add external-secrets guidance, rewrite REVIEW_REPORT"
  if (Confirm-Step "Push master to origin") { git push origin master }
}

# ---------------------------------------------------------------- 2. Env files
Write-Host "`n== 2. Move real env files out of OneDrive ==" -ForegroundColor Cyan

$dest = Join-Path $env:USERPROFILE '.wasel-secrets'
New-Item -ItemType Directory -Force $dest | Out-Null
# Owner-only access on the secrets folder.
icacls $dest /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null

$envFiles = '.env', '.env.local', '.env.production', '.env.development', '.env.staging'
$copied = @()
foreach ($f in $envFiles) {
  if (Test-Path $f) {
    Copy-Item $f (Join-Path $dest $f) -Force
    $copied += $f
  }
}

[Environment]::SetEnvironmentVariable('WASEL_ENV_DIR', $dest, 'User')
$env:WASEL_ENV_DIR = $dest
Write-Host "WASEL_ENV_DIR set to $dest (restart terminals / VS Code to pick it up)."
Write-Host "Copied with original names: $($copied -join ', ')"

if ($copied.Count -gt 0 -and (Confirm-Step "Delete the originals from the OneDrive folder now")) {
  foreach ($f in $copied) { Remove-Item $f -Force }
  Write-Host "Deleted. OneDrive may still hold them in its recycle bin / version history for ~30 days:"
  Write-Host "  empty the OneDrive recycle bin and treat these values as exposed until rotated."
}
Write-Host "Note: mobile\.env* files (if any) are not moved automatically."

if (Test-Path '_git_hygiene_quarantine') {
  Write-Host "`nThe quarantine folder still exists. Delete it ONLY after rotating the Google OAuth client:"
  Write-Host "  Remove-Item -Recurse -Force .\_git_hygiene_quarantine"
}

# ---------------------------------------------------------------- 3. History scan
Write-Host "`n== 3. Scan git history for secrets (report only) ==" -ForegroundColor Cyan

if (Get-Command gitleaks -ErrorAction SilentlyContinue) {
  gitleaks detect --source . --log-opts="--all" --redact --report-path "$env:TEMP\wasel-gitleaks.json"
  if ($LASTEXITCODE -eq 0) { Write-Host "gitleaks: no leaks found in history." -ForegroundColor Green }
  else { Write-Host "gitleaks found leaks. Report: $env:TEMP\wasel-gitleaks.json" -ForegroundColor Red }
}
else {
  Write-Host "gitleaks not installed (winget install gitleaks). Falling back to a pattern search..."
  $hits = git log --all --oneline -G "(sk_live_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{24,}|GOCSPX-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{16,}|AC[a-f0-9]{32}|SG\.[A-Za-z0-9_-]{22}\.)"
  if ($hits) {
    Write-Host "Commits that added/removed secret-looking strings:" -ForegroundColor Red
    $hits
  } else { Write-Host "No matches for the common secret patterns." -ForegroundColor Green }
}
foreach ($p in '.env', '.env.local', '.env.production') {
  $log = git log --all --oneline -- $p
  if ($log) { Write-Host "$p appears in history:" -ForegroundColor Red; $log }
}
Write-Host "`nIf anything was found: rotate those credentials first, then scrub history:"
Write-Host "  pip install git-filter-repo"
Write-Host "  git filter-repo --invert-paths --path <file>      # or --replace-text replacements.txt"
Write-Host "  git push --force-with-lease origin --all          # coordinate with collaborators"

# ---------------------------------------------------------------- 4. Webhook gate probe
Write-Host "`n== 4. Does the Supabase gateway block webhooks? ==" -ForegroundColor Cyan

$base = 'https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071'
foreach ($route in '/payments/webhooks/stripe', '/communications/webhooks/twilio') {
  $body = ''
  $status = 'n/a'
  try {
    $r = Invoke-WebRequest -Method Post -Uri ($base + $route) -Body '{}' -ContentType 'application/json' -SkipHttpErrorCheck
    $body = $r.Content
    $status = $r.StatusCode
  } catch { $body = $_.Exception.Message }
  Write-Host "$route -> HTTP $status"
  if ($body -match 'Missing authorization header|Invalid JWT|"code"\s*:\s*401') {
    Write-Host "  BLOCKED by the Supabase gateway (verify_jwt). Webhooks will fail. Split webhooks into" -ForegroundColor Red
    Write-Host "  their own function with verify_jwt = false, or deploy with --no-verify-jwt." -ForegroundColor Red
  } else {
    Write-Host "  Reached the handler (response: $body). The gateway is not blocking it." -ForegroundColor Green
  }
}
Write-Host "`nThen confirm end to end:  stripe trigger checkout.session.completed"
Write-Host "`nDone. Credential rotation is still manual: see docs\CREDENTIAL_ROTATION_GUIDE.md."
