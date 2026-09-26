# Content Machine: first-time setup on Windows.
# Right-click → "Run with PowerShell", or in a terminal from this folder:  .\setup.ps1
# Pass -Maps to also install the Map Animation Studio.
param([switch]$Maps)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Need($name, $wingetId, $why) {
  if (Get-Command $name -ErrorAction SilentlyContinue) { return $true }
  Write-Host "`n$name is not installed ($why)." -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $answer = Read-Host "Install it now with winget? (Y/n)"
    if ($answer -eq "" -or $answer -match "^[Yy]") {
      winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
      Write-Host "Installed. Close this window, open a new terminal, and run .\setup.ps1 again so the new PATH is picked up." -ForegroundColor Cyan
      exit 0
    }
  }
  return $false
}

if (-not (Need "node" "OpenJS.NodeJS.LTS" "required")) {
  Write-Host "Install Node.js 22 LTS from https://nodejs.org, then run .\setup.ps1 again." -ForegroundColor Red
  exit 1
}
Need "ffmpeg" "Gyan.FFmpeg" "contact sheets and video fixes" | Out-Null
Need "gcloud" "Google.CloudSDK" "Google Cloud login; skip if you use a Gemini API key" | Out-Null

$argsList = @()
if ($Maps) { $argsList += "--maps" }
node Tool/scripts/setup.mjs @argsList
