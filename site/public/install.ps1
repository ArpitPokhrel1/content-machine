# Content Machine installer for Windows.
#   irm https://content.tarjun.com/install.ps1 | iex
# Installs (or updates) Content Machine in %USERPROFILE%\ContentMachine, signs you in with your
# Google account, and connects it to Claude Code / Codex as the "content-machine" MCP server.
# Everything runs on your computer. Images and videos are saved in ContentMachine\Outputs.

$ErrorActionPreference = "Stop"
$Site = "https://content.tarjun.com"
$Dir = if ($env:CONTENT_MACHINE_HOME) { $env:CONTENT_MACHINE_HOME } else { Join-Path $HOME "ContentMachine" }

Write-Host "`nContent Machine installer" -ForegroundColor Cyan
Write-Host "Install folder: $Dir`n"

function Ensure($name, $wingetId, $why, [switch]$Required) {
  if (Get-Command $name -ErrorAction SilentlyContinue) { Write-Host "  ok  $name"; return }
  Write-Host "  --  $name is missing ($why)" -ForegroundColor Yellow
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    if ($Required) { throw "Install $name manually, then run this installer again." }
    return
  }
  winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements | Out-Null
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  if ($Required -and -not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name was installed but isn't on PATH yet. Open a NEW PowerShell window and run the installer again."
  }
}

Write-Host "Checking tools..."
Ensure "node" "OpenJS.NodeJS.LTS" "required" -Required
Ensure "gcloud" "Google.CloudSDK" "Google sign-in" -Required
Ensure "ffmpeg" "Gyan.FFmpeg" "contact sheets"

$code = if ($env:CONTENT_MACHINE_CODE) { $env:CONTENT_MACHINE_CODE } else { Read-Host "`nYour access code" }
$tmp = Join-Path ([IO.Path]::GetTempPath()) "content-machine.tar.gz"
try {
  Invoke-WebRequest "$Site/api/download" -Headers @{ "x-access-code" = $code.Trim() } -OutFile $tmp -UseBasicParsing
} catch {
  throw "Download refused. Check your access code (it is case-sensitive)."
}

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
# Extracting over an existing install updates the tool; Tool\.env and Outputs are never in the bundle, so they're kept.
tar -xzf $tmp -C $Dir
Remove-Item $tmp -Force
Write-Host "  ok  files in $Dir"

Set-Location $Dir
node Tool/scripts/setup.mjs
Write-Host "`nAll set. Open Claude Code (or Codex) and ask: 'Use content-machine to make an image pack from this script: ...'" -ForegroundColor Green
