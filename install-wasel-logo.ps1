# Installs the new Wasel logo pack into this project.
# Usage (from the project root, in PowerShell):
#   .\install-wasel-logo.ps1
#   .\install-wasel-logo.ps1 -Zip "D:\path\to\wasel-logo-pack.zip"
param(
  [string]$Zip = (Join-Path $env:USERPROFILE 'Downloads\wasel-logo-pack.zip')
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Test-Path $Zip)) {
  Write-Error "Zip not found: $Zip`nDownload wasel-logo-pack.zip from the chat, or pass its location with -Zip."
}

Expand-Archive -Path $Zip -DestinationPath $root -Force

$check = Join-Path $root 'public\brand\assets\logos\primary\logo-light-160.png'
if (Test-Path $check) {
  Write-Host 'Logo pack installed. Now run: npm run build   (then hard-refresh the browser)' -ForegroundColor Green
} else {
  Write-Error 'Extraction finished but the new files were not found. Check the zip path.'
}
